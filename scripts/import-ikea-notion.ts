#!/usr/bin/env npx tsx
/**
 * Import IKEA (sélection Notion scrapée via Piloterr → scripts/_ikea/ikea-notion.json)
 * dans partner_products via l'ingest agnostique (embeddings image+texte Jina, dédup
 * (merchant, external_id)). force:true = on NE saute PAS les catégories déjà peuplées
 * (IKEA a 687 réfs préexistantes) ; le dédup PAR PRODUIT (embedding non null) reste actif.
 *
 * PAS de backfill attributs ici (Gemini vision) — en attente de la refonte des schémas.
 *
 * Usage : npx tsx scripts/import-ikea-notion.ts [perCat] [maxTotal]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const FILE = `${__dirname}/_ikea/ikea-notion.json`;
const CATS = [
  "coffee_table", "side_table", "sideboard", "bookshelf", "dining_table", "tv_stand",
  "floor_lamp", "pendant_lamp", "table_lamp", "bench", "chair", "stool", "armchair",
  "pouf", "footstool", "rug", "sofa",
];

async function main() {
  const perCategory = Number(process.argv[2] ?? 400);
  const maxTotal = Number(process.argv[3] ?? 1000);
  const { ScrapedJsonSource } = await import("../lib/catalog/sources/scraped-json-source");
  const { ingestFromSource } = await import("../lib/catalog/ingest");

  console.log(`Import IKEA (Notion) ← ${FILE} — cats: ${CATS.length} (perCat=${perCategory}, max=${maxTotal})`);
  const stats = await ingestFromSource(new ScrapedJsonSource("ikea", FILE), CATS, {
    perCategory, maxTotal, force: true,
  });
  console.log(JSON.stringify(stats.perCategory, null, 2));
  console.log(`✅ TOTAL inséré: ${stats.totalInserted}`);
  process.exit(0);
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
