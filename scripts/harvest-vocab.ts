#!/usr/bin/env npx tsx
/**
 * RÉCOLTE de vocabulaire (Étape 2, auto-enrichissement). Pour un échantillon de produits
 * par catégorie : extraction fermée (vocab V3). Pour chaque attribut enum == "unknown",
 * appel Gemini LIBRE → terme naturel → loggé dans attr_vocab_candidates (TRACE pour Notion).
 * On NE modifie PAS le produit ni le vocab — juste la trace de candidats.
 *
 * Usage : npx tsx scripts/harvest-vocab.ts [perCat=8] [cats=...]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const MODEL = "gemini-2.5-flash";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function closedPrompt(schema: import("../lib/shopping/attributeSchemaV3").AttrV3[]): string {
  const lines = schema.map((a) =>
    a.type === "hex" ? `  "${a.key}": "#rrggbb"` : `  "${a.key}": one of [${a.vocab!.join(", ")}]`,
  );
  return `Décris l'OBJET PRINCIPAL de cette photo produit. Ignore le fond. JSON STRICT, une valeur EXACTE du vocab par clé, ou "unknown" si non déterminable :\n{\n${lines.join(",\n")}\n}`;
}
const freePrompt = (cat: string, attr: string) =>
  `Photo produit d'un(e) ${cat}. L'attribut « ${attr} » ne rentre dans aucune valeur de notre liste fermée. Décris LIBREMENT la valeur de « ${attr} » pour CE produit, en 1-3 mots français (le type/forme courant, ex. pour une chaise : « dossier échelle », « bistrot »…). JSON strict : {"label":"..."}`;

function norm(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const v = s.toLowerCase().trim().replace(/\s+/g, " ").replace(/[.;,]+$/, "").slice(0, 40);
  return v && v !== "unknown" && v.length > 1 ? v : null;
}

async function main() {
  const perCat = Number(process.argv[2] ?? 8);
  const catsArg = process.argv[3];
  const CATS = catsArg ? catsArg.split(",") : ["sofa", "armchair", "chair", "coffee_table", "side_table", "rug", "tv_stand", "bookshelf", "dresser", "floor", "floor_lamp", "lamp"];

  const { createSupabaseAdmin } = await import("../lib/supabase/server");
  const { getVisionProvider } = await import("../lib/ai/provider");
  const { getSchemaV3, schemaForCategory } = await import("../lib/shopping/attributeSchemaV3");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createSupabaseAdmin() as any;

  const extract = async (prompt: string, url: string): Promise<Record<string, unknown> | null> => {
    try {
      const buf = Buffer.from(await (await fetch(url, { headers: { "User-Agent": UA, Accept: "image/jpeg,image/webp" } })).arrayBuffer());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await getVisionProvider("gemini_vision").analyze(prompt, [buf as any], { model: MODEL });
      return (res.parsed ?? null) as Record<string, unknown> | null;
    } catch { return null; }
  };

  let totalProducts = 0, totalUnknowns = 0, totalCandidates = 0;
  for (const cat of CATS) {
    const schemaName = schemaForCategory(cat);
    const schema = getSchemaV3(schemaName);
    const enumKeys = schema.filter((a) => a.type === "enum").map((a) => a.key);
    const { data: prods } = await sb.from("partner_products").select("id, name, primary_image_url").eq("category", cat).not("embedding", "is", null).limit(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sample = ((prods ?? []) as any[]).sort(() => 0.5 - Math.random()).slice(0, perCat);
    let catUnknown = 0;
    for (const p of sample) {
      totalProducts++;
      const attrs = await extract(closedPrompt(schema), p.primary_image_url);
      if (!attrs) { await sleep(300); continue; }
      for (const k of enumKeys) {
        if (String(attrs[k]).toLowerCase() !== "unknown") continue;
        totalUnknowns++; catUnknown++;
        const free = await extract(freePrompt(cat, k), p.primary_image_url);
        const label = norm(free?.label);
        if (label) {
          await sb.rpc("bump_vocab_candidate", { p_category: cat, p_attribute: k, p_label: label, p_example: p.id });
          totalCandidates++;
        }
        await sleep(250);
      }
      await sleep(300);
    }
    console.log(`  ${cat.padEnd(13)} ${sample.length} produits · ${catUnknown} unknown(s)`);
  }
  console.log(`\nTOTAL : ${totalProducts} produits, ${totalUnknowns} unknowns, ${totalCandidates} candidats loggés.`);

  // Récap du pool.
  const { data: pool } = await sb.from("attr_vocab_candidates").select("category, attribute, label, count").order("count", { ascending: false });
  console.log(`\n=== Pool attr_vocab_candidates (${(pool ?? []).length} entrées) ===`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of (pool ?? []) as any[]) console.log(`  ${String(c.count).padStart(2)}×  ${c.category}/${c.attribute}: "${c.label}"`);
  process.exit(0);
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
