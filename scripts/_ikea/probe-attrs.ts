#!/usr/bin/env npx tsx
/* eslint-disable */
/**
 * AUDIT + PERSIST attrs Gemini (= le backfill, avec stop interactif). Pour une catégorie IKEA :
 * extrait les attributs structurés, LES SAUVEGARDE au fur et à mesure (merge dans metadata.attrs
 * — préserve color_family/color_families déjà présents), SAUTE les produits déjà faits (marqueur
 * metadata.attrs_model), et S'ARRÊTE au 1er "unknown" sur un enum SANS le persister (affiche le
 * produit + attrs + attribut en cause). On enrichit attributeSchemaV3 puis on RELANCE la même
 * commande : le produit unknown est re-tenté, les déjà-faits sont sautés (1 appel/produit).
 *
 * Usage : npx tsx scripts/_ikea/probe-attrs.ts <category> [--limit=N] [--lite] [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const MODEL = process.argv.includes("--lite") ? "gemini-2.5-flash-lite" : "gemini-2.5-flash";

async function main() {
  const cat = process.argv[2];
  if (!cat || cat.startsWith("--")) { console.error("Usage: probe-attrs <category> [--limit=N] [--lite] [--dry]"); process.exit(1); }
  const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.slice(8) ?? 0);
  const dry = process.argv.includes("--dry");
  // Attributs dont un "unknown" est ACCEPTÉ (persisté, ne déclenche PAS le stop) — ex.
  // legs_material souvent indéterminable visuellement (pied fin sombre). La couleur reste captée.
  const accept = new Set((process.argv.find((a) => a.startsWith("--accept="))?.slice(9) ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  // Coercition : "attr:value" → si l'attribut sort "unknown", on le force à value (ex.
  // legs_type:none pour un canapé ras-du-sol). Évite de perdre l'attribut tout en débloquant.
  const coerce: Record<string, string> = {};
  for (const pair of (process.argv.find((a) => a.startsWith("--coerce="))?.slice(9) ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const [k, v] = pair.split(":"); if (k && v) coerce[k] = v;
  }

  const { createSupabaseAdmin } = await import("../../lib/supabase/server");
  const { getVisionProvider } = await import("../../lib/ai/provider");
  const { getSchemaV3, schemaForCategory, buildExtractionPrompt } = await import("../../lib/shopping/attributeSchemaV3");
  const sb = createSupabaseAdmin() as any;

  const schema = getSchemaV3(schemaForCategory(cat));
  const enumKeys = schema.filter((a: any) => a.type === "enum").map((a: any) => a.key);
  const prompt = buildExtractionPrompt(schema);
  console.log(`Schéma '${schemaForCategory(cat)}' : ${schema.map((a: any) => a.key).join(", ")}  | persist=${!dry}`);

  const { data } = await sb.from("partner_products")
    .select("id, name, primary_image_url, product_url, metadata")
    .eq("merchant", "ikea").eq("category", cat).order("id");
  let rows = (data ?? []) as any[];
  if (limit) rows = rows.slice(0, limit);

  const extract = async (url: string): Promise<Record<string, unknown> | null> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const buf = Buffer.from(await (await fetch(url, { headers: { "User-Agent": UA, Accept: "image/jpeg,image/webp" } })).arrayBuffer());
        const res = await getVisionProvider("gemini_vision").analyze(prompt, [buf as any], { model: MODEL });
        return (res.parsed ?? null) as Record<string, unknown> | null;
      } catch { if (attempt === 0) await new Promise((r) => setTimeout(r, 800)); }
    }
    return null;
  };

  let done = 0, skipped = 0, fail = 0, naCount: Record<string, number> = {};
  for (const p of rows) {
    if (!dry && p.metadata?.attrs_model) { skipped++; continue; } // déjà fait → 0 appel
    const attrs = await extract(p.primary_image_url);
    if (!attrs) { fail++; console.log(`  ✗ extraction échouée — ${p.name}`); continue; }
    // Coercition : unknown → valeur forcée (avant calcul des unknowns + persist)
    for (const [k, v] of Object.entries(coerce)) if (String(attrs[k]).toLowerCase() === "unknown") attrs[k] = v;
    const unknowns = enumKeys.filter((k: string) => String(attrs[k]).toLowerCase() === "unknown" && !accept.has(k));
    for (const k of enumKeys) if (String(attrs[k]).toLowerCase() === "n/a") naCount[k] = (naCount[k] ?? 0) + 1;

    if (unknowns.length > 0) {
      // STOP au 1er unknown — NON persisté (sera re-tenté après enrichissement du schéma)
      console.log(`\n🛑 UNKNOWN — ${done} déjà persistés, ${skipped} sautés`);
      console.log(`   Produit : ${p.name}`);
      console.log(`   Image   : ${p.primary_image_url}`);
      console.log(`   URL     : ${p.product_url}`);
      console.log(`   Attrs   : ${JSON.stringify(attrs)}`);
      console.log(`   ⚠️  unknown sur : ${unknowns.join(", ")}`);
      console.log(`   (n/a cumulés : ${JSON.stringify(naCount)})`);
      console.log(`   → enrichis attributeSchemaV3, puis RELANCE : npx tsx scripts/_ikea/probe-attrs.ts ${cat}`);
      process.exit(2); // code 2 = stop sur unknown (le wrapper s'arrête)
    }

    if (!dry) {
      // MERGE : préserve color_family/color_families déjà dans metadata.attrs, ajoute le Gemini
      const merged = { ...(p.metadata?.attrs ?? {}), ...attrs };
      await sb.from("partner_products").update({ metadata: { ...(p.metadata ?? {}), attrs: merged, attrs_model: MODEL } }).eq("id", p.id);
    }
    done++;
    if (done % 20 === 0) console.log(`  …${done} persistés (${skipped} sautés)`);
  }
  console.log(`\n✅ '${cat}' terminé sans unknown : ${done} persistés, ${skipped} déjà faits, ${fail} échecs. (n/a : ${JSON.stringify(naCount)})`);
  process.exit(0);
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
