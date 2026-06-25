#!/usr/bin/env npx tsx
/**
 * Pour les produits dont metadata.attrs.shape == "unknown", demande à Gemini de décrire
 * la forme/silhouette LIBREMENT (sans vocabulaire imposé) → voir comment il catégorise
 * spontanément, et juger si notre vocab fermé doit être enrichi. Lecture seule.
 *
 * Usage : npx tsx scripts/diag-shape-free.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const MODEL = "gemini-2.5-flash";

async function main() {
  const { createSupabaseAdmin } = await import("../lib/supabase/server");
  const { getVisionProvider } = await import("../lib/ai/provider");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createSupabaseAdmin() as any;

  const { data } = await sb
    .from("partner_products")
    .select("id, category, name, primary_image_url")
    .filter("metadata->attrs->>shape", "eq", "unknown");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];
  console.log(`${rows.length} produit(s) avec shape=unknown.\n`);

  for (const p of rows) {
    console.log(`══════════ ${p.category}  ·  ${p.id}`);
    console.log(`  nom   : ${p.name}`);
    console.log(`  image : ${p.primary_image_url}`);
    try {
      const buf = Buffer.from(await (await fetch(p.primary_image_url, { headers: { "User-Agent": UA, Accept: "image/jpeg,image/webp" } })).arrayBuffer());
      const prompt = `Voici une photo produit d'un(e) ${p.category}. Décris LIBREMENT (sans liste imposée) sa FORME / silhouette / type de design en quelques mots français. Si ça correspond à un type connu (ex. fauteuil club, chaise bistrot, commode scandinave, table tambour…), nomme-le. Renvoie un JSON strict : {"forme_libre":"...", "type_design":"...", "remarque":"pourquoi c'est difficile à catégoriser si applicable"}.`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await getVisionProvider("gemini_vision").analyze(prompt, [buf as any], { model: MODEL });
      console.log(`  GEMINI: ${JSON.stringify(res.parsed)}`);
    } catch (e) {
      console.log(`  ✗ ${e instanceof Error ? e.message.slice(0, 80) : "err"}`);
    }
    console.log("");
  }
  process.exit(0);
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
