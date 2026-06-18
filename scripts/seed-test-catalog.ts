#!/usr/bin/env npx tsx
/**
 * SEED du jeu de TEST catalog (JETABLE).
 * Peuple partner_products : Cdiscount (meubles) + Leroy Merlin (sous-ensemble),
 * avec embedding image via Jina. Chaque ligne est marquée
 * metadata.ingestion='test_scrape' + source_type='eco_new' → purge en 1 requête.
 *
 * ⚠️ Usage DEV uniquement. Ne tourne JAMAIS en cron/prod. Sera remplacé par les
 * flux d'affiliation Awin (cf. lib/catalog/sources/awin-source.ts).
 *
 * Activation OBLIGATOIRE : SEED_SCRAPE_ENABLED=true (sinon arrêt).
 * Usage :
 *   SEED_SCRAPE_ENABLED=true npx tsx scripts/seed-test-catalog.ts --canary  # 1 cat, 3 produits
 *   SEED_SCRAPE_ENABLED=true npx tsx scripts/seed-test-catalog.ts           # run complet
 * Purge : npx tsx scripts/purge-test-catalog.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config(); // fallback .env

const CATEGORIES = [
  "sofa", "armchair", "coffee_table", "side_table", "tv_stand", "sideboard",
  "bookshelf", "dining_table", "chair", "rug", "floor_lamp", "dresser",
];
const MAX_PER_MERCHANT = 300; // cap DUR
// 2-step (search → product) des DEUX côtés → ~4 crédits/produit. Calé sur le pool
// de ~500 crédits : 8×12 + 6×6 ≈ 130 produits ≈ ~340 crédits.
const CDISCOUNT_PER_CAT = 8;
const LEROYMERLIN_PER_CAT = 6;

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

async function main() {
  if (process.env.SEED_SCRAPE_ENABLED !== "true") {
    console.error("⛔ SEED_SCRAPE_ENABLED != true → arrêt. (Jeu de test, dev only.)");
    process.exit(1);
  }
  console.warn(
    "\n⚠️  Jeu de TEST, usage DEV uniquement. Sera remplacé par les flux d'affiliation Awin.\n" +
      "    Ne PAS exécuter en production.\n",
  );

  const args = process.argv.slice(2);
  const canary = args.includes("--canary");
  const merchantArg = argValue(args, "--merchant"); // cdiscount | leroy_merlin (sinon les deux)
  const catsArg = argValue(args, "--cats");         // "rug,sofa,…" (sinon toutes)

  const categories = catsArg
    ? catsArg.split(",").map((s) => s.trim()).filter(Boolean)
    : canary ? ["rug"] : CATEGORIES;

  const perByMerchant: Record<string, number> = {
    cdiscount: canary ? 3 : CDISCOUNT_PER_CAT,
    leroy_merlin: canary ? 3 : LEROYMERLIN_PER_CAT,
  };
  const merchants = (merchantArg ? [merchantArg] : ["cdiscount", "leroy_merlin"]).filter(
    (m) => m in perByMerchant,
  ) as Array<"cdiscount" | "leroy_merlin">;

  if (merchants.length === 0) {
    console.error(`⛔ Merchant inconnu : ${merchantArg}. Supportés : cdiscount, leroy_merlin.`);
    process.exit(1);
  }
  // Garde-fou cap dur.
  for (const m of merchants) {
    if (categories.length * perByMerchant[m] > MAX_PER_MERCHANT) {
      console.error(`⛔ Config dépasse le cap ${MAX_PER_MERCHANT}/marchand → refus.`);
      process.exit(1);
    }
  }

  const { PiloterrSource } = await import("../lib/catalog/sources/piloterr-source");
  const { ingestFromSource } = await import("../lib/catalog/ingest");

  console.log(`🌱 Seed ${canary ? "CANARY " : ""}— merchants: ${merchants.join(", ")} — catégories: ${categories.join(", ")}\n`);

  for (const m of merchants) {
    console.log(`── ${m} ──`);
    const r = await ingestFromSource(new PiloterrSource(m), categories, {
      perCategory: perByMerchant[m],
      maxTotal: MAX_PER_MERCHANT,
    });
    console.log(`✅ ${m}: ${r.totalInserted} insérés\n`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
