import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { computeImageEmbedding } from "@/lib/embeddings/jina";
import { getSchemaV3, schemaForCategory } from "@/lib/shopping/attributeSchemaV3";
import { colorFamily, colorFamilies } from "@/lib/color";

const HEX = /^#[0-9a-fA-F]{6}$/;

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = (await request.json()) as {
    partner_tier?: string;
    primary_image_url?: string;
    // Repasse MANUELLE d'un attribut structuré (fiche admin) : { key, value }.
    attr?: { key?: string; value?: string };
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAdmin() as any;

  // 1) Choix de l'image principale (position 1) → recalcule l'embedding cosine.
  if (body.primary_image_url) {
    let embedding: string;
    try {
      embedding = JSON.stringify(await computeImageEmbedding(body.primary_image_url));
    } catch (e) {
      return NextResponse.json(
        { error: `Recalcul embedding échoué: ${e instanceof Error ? e.message : e}` },
        { status: 502 },
      );
    }
    const { data, error } = await supabase
      .from("partner_products")
      .update({ primary_image_url: body.primary_image_url, embedding, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, primary_image_url")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // 2) Repasse manuelle d'un attribut : la valeur est VALIDÉE contre le vocabulaire
  //    du schéma de la catégorie (impossible d'écrire hors enum, ce qui casserait le
  //    scoring structuré). Marquée dans metadata.attrs_manual → une correction humaine
  //    reste identifiable face à un futur backfill modèle.
  if (body.attr?.key) {
    const { key, value } = body.attr;
    if (typeof value !== "string" || !value.trim()) {
      return NextResponse.json({ error: "Valeur manquante" }, { status: 400 });
    }
    const { data: prod, error: readErr } = await supabase
      .from("partner_products")
      .select("id, category, metadata")
      .eq("id", id)
      .maybeSingle();
    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
    if (!prod) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

    const schema = getSchemaV3(schemaForCategory(prod.category));
    const attrDef = schema.find((a) => a.key === key);
    if (!attrDef) {
      return NextResponse.json({ error: `Attribut « ${key} » hors schéma ${prod.category}` }, { status: 400 });
    }
    if (attrDef.type === "hex") {
      if (!HEX.test(value)) return NextResponse.json({ error: "Couleur attendue au format #rrggbb" }, { status: 400 });
    } else if (!(attrDef.vocab ?? []).includes(value) && value !== "unknown" && value !== "n/a") {
      return NextResponse.json({ error: `Valeur « ${value} » hors vocabulaire de ${key}` }, { status: 400 });
    }

    const metadata = (prod.metadata ?? {}) as Record<string, unknown>;
    const attrs = { ...((metadata.attrs ?? {}) as Record<string, unknown>), [key]: value };
    // Couleur corrigée → les familles dérivées suivent (sinon le pré-filtre couleur
    // du matching resterait sur l'ancienne teinte). Calcul local, aucun appel API.
    if (attrDef.type === "hex" && key === "color") {
      attrs.color_family = colorFamily(value);
      attrs.color_families = colorFamilies(value);
    }
    const manual = new Set([...((metadata.attrs_manual as string[]) ?? []), key]);

    const { error } = await supabase
      .from("partner_products")
      .update({
        metadata: { ...metadata, attrs, attrs_manual: [...manual] },
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, attrs });
  }

  // 3) Tier partenaire.
  const validTiers = ["strategic", "standard", "discovery"];
  if (!body.partner_tier || !validTiers.includes(body.partner_tier)) {
    return NextResponse.json({ error: "partner_tier invalide" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("partner_products")
    .update({ partner_tier: body.partner_tier, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, name, partner_tier")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
