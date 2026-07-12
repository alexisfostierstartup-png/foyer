import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getSchemaV3, schemaForCategory } from "@/lib/shopping/attributeSchemaV3";
import { colorFamily, colorFamilies } from "@/lib/color";

const HEX = /^#[0-9a-fA-F]{6}$/;
// Plafond volontaire : au-delà, mieux vaut affiner les filtres qu'écrire en masse à l'aveugle.
const MAX_BULK = 500;

/**
 * Repasse manuelle en MASSE (listing admin, cases à cocher) — deux modes exclusifs :
 *  - body.attr : un attribut structuré (même validation vocab que la repasse 1-par-1).
 *  - body.category : reclassement de catégorie. Le schéma d'attributs change avec la
 *    catégorie → les attrs existants (vocab de l'ANCIENNE catégorie) sont invalidés
 *    (attrs_model retiré) pour qu'un futur passage audit-attrs les ré-extraie proprement,
 *    plutôt que de laisser des valeurs incohérentes avec le nouveau schéma.
 */
export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    ids?: string[];
    attr?: { key?: string; value?: string };
    category?: string;
  };
  const ids = [...new Set((body.ids ?? []).filter(Boolean))];
  if (ids.length === 0) return NextResponse.json({ error: "Aucun produit sélectionné" }, { status: 400 });
  if (ids.length > MAX_BULK) {
    return NextResponse.json({ error: `${ids.length} produits sélectionnés > limite ${MAX_BULK} — affinez les filtres` }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAdmin() as any;

  if (body.category) {
    const category = body.category;
    // Valide contre les catégories RÉELLEMENT en base (même source que le dropdown admin,
    // RPC distinct_catalog_categories) — pas une liste figée qui dérive du référentiel
    // d'attributs et omettrait les catégories à schéma "default" (curtains, cushion...).
    const { data: validCats, error: catErr } = await supabase.rpc("distinct_catalog_categories");
    if (catErr) return NextResponse.json({ error: catErr.message }, { status: 500 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(validCats ?? []).some((r: any) => r.category === category)) {
      return NextResponse.json({ error: `Catégorie « ${category} » inconnue` }, { status: 400 });
    }
    const { data: prods, error: readErr } = await supabase.from("partner_products").select("id, category, metadata").in("id", ids);
    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

    let updated = 0;
    const errors: { id: string; error: string }[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const prod of (prods ?? []) as any[]) {
      if (prod.category === category) { updated++; continue; } // déjà bon, rien à faire
      const metadata = (prod.metadata ?? {}) as Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { attrs, attrs_model, attrs_manual, ...restMetadata } = metadata;
      const { error } = await supabase
        .from("partner_products")
        .update({ category, metadata: restMetadata, updated_at: new Date().toISOString() })
        .eq("id", prod.id);
      if (error) { errors.push({ id: prod.id, error: error.message }); continue; }
      updated++;
    }
    return NextResponse.json({ updated, failed: errors.length, errors: errors.slice(0, 10) });
  }

  const key = body.attr?.key;
  const value = body.attr?.value;
  if (!key || typeof value !== "string" || !value.trim()) {
    return NextResponse.json({ error: "Attribut/valeur manquant" }, { status: 400 });
  }

  const { data: prods, error: readErr } = await supabase
    .from("partner_products")
    .select("id, category, metadata")
    .in("id", ids);
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

  let updated = 0;
  const errors: { id: string; error: string }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const prod of (prods ?? []) as any[]) {
    const schema = getSchemaV3(schemaForCategory(prod.category));
    const attrDef = schema.find((a) => a.key === key);
    if (!attrDef) { errors.push({ id: prod.id, error: `« ${key} » hors schéma ${prod.category}` }); continue; }
    if (attrDef.type === "hex") {
      if (!HEX.test(value)) { errors.push({ id: prod.id, error: "couleur attendue au format #rrggbb" }); continue; }
    } else if (!(attrDef.vocab ?? []).includes(value) && value !== "unknown" && value !== "n/a") {
      errors.push({ id: prod.id, error: `« ${value} » hors vocabulaire de ${key}` }); continue;
    }

    const metadata = (prod.metadata ?? {}) as Record<string, unknown>;
    const attrs = { ...((metadata.attrs ?? {}) as Record<string, unknown>), [key]: value };
    if (attrDef.type === "hex" && key === "color") {
      attrs.color_family = colorFamily(value);
      attrs.color_families = colorFamilies(value);
    }
    const manual = new Set([...((metadata.attrs_manual as string[]) ?? []), key]);

    const { error } = await supabase
      .from("partner_products")
      .update({ metadata: { ...metadata, attrs, attrs_manual: [...manual] }, updated_at: new Date().toISOString() })
      .eq("id", prod.id);
    if (error) { errors.push({ id: prod.id, error: error.message }); continue; }
    updated++;
  }

  return NextResponse.json({ updated, failed: errors.length, errors: errors.slice(0, 10) });
}
