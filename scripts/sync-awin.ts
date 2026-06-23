#!/usr/bin/env npx tsx
/**
 * Ingestion d'un marchand Awin (flux Create-a-Feed CSV → partner_merchants.feed_url).
 * Calcule embeddings image+texte + affiliate_url tracké, via l'ingest agnostique.
 *
 * Pré-requis : partner_merchants.feed_url renseigné pour <merchant> (URL Create-a-Feed),
 * et affiliation_platform='awin'.
 *
 * Usage :
 *   npx tsx scripts/sync-awin.ts tapis_fr                 # défaut: catégorie rug
 *   npx tsx scripts/sync-awin.ts tapis_fr rug 400 800     # cats, perCategory, maxTotal
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  const merchant = process.argv[2];
  const cats = (process.argv[3] || "").split(",").map((s) => s.trim()).filter(Boolean);
  const perCategory = Number(process.argv[4] ?? 400);
  const maxTotal = Number(process.argv[5] ?? 800);
  if (!merchant) {
    console.error("Usage: npx tsx scripts/sync-awin.ts <merchant> [cat1,cat2] [perCategory] [maxTotal]");
    process.exit(1);
  }
  const { AwinSource } = await import("../lib/catalog/sources/awin-source");
  const { ingestFromSource } = await import("../lib/catalog/ingest");

  const categories = cats.length ? cats : ["rug"]; // tapis.fr = tapis → rug
  console.log(`Sync Awin '${merchant}' — catégories: ${categories.join(", ")} (perCat=${perCategory}, max=${maxTotal})`);

  const stats = await ingestFromSource(new AwinSource(merchant), categories, {
    perCategory,
    maxTotal,
    force: false,
  });
  console.log(JSON.stringify(stats.perCategory, null, 2));
  console.log(`✅ TOTAL inséré: ${stats.totalInserted}`);
  process.exit(0);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
