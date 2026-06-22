#!/usr/bin/env npx tsx
/**
 * SEED du jeu de TEST catalog (JETABLE). Sélection QUALITATIVE (best-sellers,
 * diversité, garde-fous), pas "les N premiers".
 *
 * Plan par défaut :
 *  - Mobilier + luminaire : Cdiscount (180/cat, best-sellers paginés) + IKEA (70/cat).
 *  - Fournitures : Leroy Merlin — peinture V33 acrylique intérieur (~40), moulures (30),
 *    tasseaux (30).
 * Chaque ligne : metadata.ingestion='test_scrape' + source_type='eco_new' → purgeable.
 *
 * ⚠️ Usage DEV uniquement. Ne tourne JAMAIS en cron/prod. Activation : SEED_SCRAPE_ENABLED=true
 * Usage :
 *   SEED_SCRAPE_ENABLED=true npx tsx scripts/seed-test-catalog.ts            # plan complet
 *   SEED_SCRAPE_ENABLED=true npx tsx scripts/seed-test-catalog.ts --canary   # mini
 *   SEED_SCRAPE_ENABLED=true npx tsx scripts/seed-test-catalog.ts --merchant ikea --cats sofa --per 20
 * Purge : npx tsx scripts/purge-test-catalog.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const FURNITURE = [
  "sofa", "armchair", "coffee_table", "side_table", "tv_stand", "sideboard",
  "bookshelf", "dining_table", "chair", "rug", "floor_lamp", "dresser",
];
const CDISCOUNT_PER = 180; // best-sellers
const IKEA_PER = 70;       // diversité marque
const SUPPLY: Record<string, number> = { paint: 40, mouldings: 30, batten: 30 };
const LM_FURNITURE_PER = 40; // mobilier LM (catalogue peu profond → ~30-50/cat)
const LM_FLOOR_PER = 60;     // revêtements de sol (stratifié/béton ciré/carrelage/pvc)
const PER_CAT_CAP = 300;   // garde-fou par catégorie

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

async function main() {
  if (process.env.SEED_SCRAPE_ENABLED !== "true") {
    console.error("⛔ SEED_SCRAPE_ENABLED != true → arrêt. (Jeu de test, dev only.)");
    process.exit(1);
  }
  console.warn("\n⚠️  Jeu de TEST, usage DEV uniquement. Sera remplacé par les flux Awin. Pas en prod.\n");

  const args = process.argv.slice(2);
  const canary = args.includes("--canary");
  const merchantArg = argValue(args, "--merchant");
  const catsArg = argValue(args, "--cats");
  const perArg = argValue(args, "--per");

  const { PiloterrSource } = await import("../lib/catalog/sources/piloterr-source");
  const { ingestFromSource } = await import("../lib/catalog/ingest");

  // ── Mode ciblé (test) ──
  if (merchantArg) {
    const cats = catsArg
      ? catsArg.split(",").map((s) => s.trim()).filter(Boolean)
      : merchantArg === "leroy_merlin" ? Object.keys(SUPPLY) : FURNITURE;
    const per = perArg ? Number(perArg) : canary ? 3 : 30;
    if (per > PER_CAT_CAP) { console.error(`⛔ per > cap ${PER_CAT_CAP}`); process.exit(1); }
    console.log(`🌱 ${merchantArg} — ${cats.join(", ")} (${per}/cat)\n`);
    const r = await ingestFromSource(new PiloterrSource(merchantArg as never), cats, {
      perCategory: per, maxTotal: cats.length * per + 50, force: true, // ciblé = intention explicite → pas de skip-reprise
    });
    console.log(`✅ ${merchantArg}: ${r.totalInserted} insérés`);
    process.exit(0);
  }

  // ── Plan complet ──
  console.log("🌱 Seed COMPLET (mobilier Cdiscount+IKEA + fournitures LM)\n");

  console.log("── Cdiscount (mobilier, best-sellers) ──");
  const cd = await ingestFromSource(new PiloterrSource("cdiscount"), FURNITURE, {
    perCategory: canary ? 3 : CDISCOUNT_PER, maxTotal: 3000,
  });

  console.log("\n── IKEA (mobilier, diversité marque) ──");
  const ik = await ingestFromSource(new PiloterrSource("ikea"), FURNITURE, {
    perCategory: canary ? 3 : IKEA_PER, maxTotal: 1200,
  });

  console.log("\n── Leroy Merlin (fournitures : peinture V33 / moulures / tasseaux) ──");
  let lmTotal = 0;
  for (const [cat, per] of Object.entries(SUPPLY)) {
    const r = await ingestFromSource(new PiloterrSource("leroy_merlin"), [cat], {
      perCategory: canary ? 3 : per, maxTotal: per + 10,
    });
    lmTotal += r.totalInserted;
  }

  console.log("\n── Leroy Merlin (mobilier — diversité marques françaises) ──");
  const lmFurn = await ingestFromSource(new PiloterrSource("leroy_merlin"), FURNITURE, {
    perCategory: canary ? 3 : LM_FURNITURE_PER, maxTotal: 700,
  });

  console.log("\n── Leroy Merlin (revêtements de sol) ──");
  const lmFloor = await ingestFromSource(new PiloterrSource("leroy_merlin"), ["floor"], {
    perCategory: canary ? 3 : LM_FLOOR_PER, maxTotal: 80,
  });
  lmTotal += lmFurn.totalInserted + lmFloor.totalInserted;

  console.log(`\n✅ Terminé — Cdiscount ${cd.totalInserted} | IKEA ${ik.totalInserted} | Leroy Merlin ${lmTotal}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
