#!/usr/bin/env npx tsx
/**
 * PALIER 1 Étape 2 — extraction des attributs structurés du CATALOGUE → metadata.attrs.
 * Gemini flash (vocab V3 fermé + n/a). Idempotent (ne touche que les produits sans attrs,
 * sauf --force). AUTO-HARVEST branché : tout enum "unknown" → appel libre → candidat loggé
 * (attr_vocab_candidates). Batché + throttlé + reprise (comme les backfills embeddings).
 *
 * Usage :
 *   npx tsx scripts/backfill-attrs.ts coffee_table 20      # canary : 20 coffee_table
 *   npx tsx scripts/backfill-attrs.ts all                  # tout le catalogue
 *   npx tsx scripts/backfill-attrs.ts rug 0 --force        # ré-extrait tous les tapis
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const MODEL = process.argv.includes("--lite") ? "gemini-2.5-flash-lite" : "gemini-2.5-flash";
const norm = (s: unknown): string | null => {
  if (typeof s !== "string") return null;
  const v = s.toLowerCase().trim().replace(/\s+/g, " ").replace(/[.;,]+$/, "").slice(0, 40);
  return v && v !== "unknown" && v !== "n/a" && v.length > 1 ? v : null;
};
const freePrompt = (cat: string, attr: string) =>
  `Photo produit d'un(e) ${cat}. L'attribut « ${attr} » ne rentre dans aucune valeur de notre liste fermée. Décris LIBREMENT la valeur de « ${attr} » pour CE produit, en 1-3 mots français. JSON strict : {"label":"..."}`;

async function main() {
  const idsArg = process.argv.find((a) => a.startsWith("--ids="))?.slice(6);
  const catsArg = process.argv[2];
  const limit = Number(process.argv[3] ?? 0); // 0 = pas de limite
  const force = process.argv.includes("--force");
  if (!idsArg && (!catsArg || catsArg.startsWith("--"))) { console.error("Usage: backfill-attrs <cat|all> [limit] [--force] | --ids=a,b,c [--lite]"); process.exit(1); }

  const { createSupabaseAdmin } = await import("../lib/supabase/server");
  const { getVisionProvider } = await import("../lib/ai/provider");
  const { getSchemaV3, schemaForCategory, buildExtractionPrompt, SCHEMA_V3 } = await import("../lib/shopping/attributeSchemaV3");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createSupabaseAdmin() as any;

  const CATS = catsArg === "all" ? Object.keys(SCHEMA_V3).filter((c) => c !== "default").concat(["floor", "lamp", "mirror"]) : catsArg.split(",");

  const extract = async (prompt: string, url: string): Promise<Record<string, unknown> | null> => {
    try {
      const buf = Buffer.from(await (await fetch(url, { headers: { "User-Agent": UA, Accept: "image/jpeg,image/webp" } })).arrayBuffer());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await getVisionProvider("gemini_vision").analyze(prompt, [buf as any], { model: MODEL });
      return (res.parsed ?? null) as Record<string, unknown> | null;
    } catch { return null; }
  };

  // Mode --ids : ré-extrait des produits PRÉCIS (toutes catégories), force-overwrite.
  if (idsArg) {
    const ids = idsArg.split(",").map((s) => s.trim()).filter(Boolean);
    const { data } = await sb.from("partner_products").select("id, category, primary_image_url, metadata").in("id", ids);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of (data ?? []) as any[]) {
      const schema = getSchemaV3(schemaForCategory(p.category));
      const enumKeys = schema.filter((a) => a.type === "enum").map((a) => a.key);
      const attrs = await extract(buildExtractionPrompt(schema), p.primary_image_url);
      if (!attrs) { console.log(`✗ ${p.id} (${p.category})`); continue; }
      for (const k of enumKeys) {
        if (String(attrs[k]).toLowerCase() !== "unknown") continue;
        const free = await extract(freePrompt(p.category, k), p.primary_image_url);
        const label = norm(free?.label);
        if (label) await sb.rpc("bump_vocab_candidate", { p_category: p.category, p_attribute: k, p_label: label, p_example: p.id });
      }
      await sb.from("partner_products").update({ metadata: { ...(p.metadata ?? {}), attrs, attrs_model: MODEL } }).eq("id", p.id);
      console.log(`✓ ${String(p.category).padEnd(12)} ${JSON.stringify(attrs)}`);
    }
    console.log(`\n(modèle: ${MODEL})`);
    process.exit(0);
  }

  let totalDone = 0, totalUnknown = 0, totalFail = 0;
  for (const cat of CATS) {
    const schema = getSchemaV3(schemaForCategory(cat));
    const enumKeys = schema.filter((a) => a.type === "enum").map((a) => a.key);
    // Pagination : le client Supabase plafonne à 1000 lignes/requête → on lit par pages
    // (sinon une catégorie >1000, comme rug ~2785, est tronquée silencieusement).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      let q = sb.from("partner_products").select("id, primary_image_url, metadata").eq("category", cat).not("primary_image_url", "is", null).order("id").range(from, from + PAGE - 1);
      if (!force) q = q.is("metadata->>attrs", null);
      const { data } = await q;
      const page = data ?? [];
      rows.push(...page);
      if (page.length < PAGE || (limit > 0 && rows.length >= limit)) break;
    }
    if (limit > 0) rows.length = Math.min(rows.length, limit);
    let done = 0, unk = 0, fail = 0;
    const CONC = 6;
    let idx = 0; // curseur partagé (incrément synchrone = pas de race en JS mono-thread)
    const worker = async () => {
      while (idx < rows.length) {
        const p = rows[idx++];
        const attrs = await extract(buildExtractionPrompt(schema), p.primary_image_url);
        if (!attrs) { fail++; totalFail++; continue; }
        // auto-harvest des unknown
        for (const k of enumKeys) {
          if (String(attrs[k]).toLowerCase() !== "unknown") continue;
          unk++; totalUnknown++;
          const free = await extract(freePrompt(cat, k), p.primary_image_url);
          const label = norm(free?.label);
          if (label) await sb.rpc("bump_vocab_candidate", { p_category: cat, p_attribute: k, p_label: label, p_example: p.id });
        }
        await sb.from("partner_products").update({ metadata: { ...(p.metadata ?? {}), attrs, attrs_model: MODEL } }).eq("id", p.id);
        done++; totalDone++;
        if (done % 50 === 0) console.log(`  ${cat}: ${done}/${rows.length}`);
      }
    };
    await Promise.all(Array.from({ length: CONC }, () => worker()));
    console.log(`✓ ${cat.padEnd(13)} ${done} extraits · ${unk} unknowns · ${fail} échecs`);
  }
  console.log(`\nTOTAL : ${totalDone} extraits, ${totalUnknown} unknowns harvestés, ${totalFail} échecs.`);
  process.exit(0);
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
