#!/usr/bin/env npx tsx
/**
 * Import Cosineo (affiliation Kwanko/NetAffiliation, flux Google Shopping g:) depuis un
 * JSON normalisé (PartnerProductInput), via l'ingest AGNOSTIQUE (embeddings image+texte
 * Jina, dédup (merchant, external_id)). Même chemin que import-mdm.ts (ScrapedJsonSource).
 *
 * Flux Cosineo = meubles de salle de bain (hors scope salon/chambre actuel) + flux CSV
 * mal formé (additional_image_link multi-URLs non quotées → column shift) → on pré-normalise
 * le CSV en JSON en amont. affiliate_url = g:link (redirect tracké NetAffiliation).
 *
 * Usage :
 *   npx tsx scripts/import-cosineo.ts --file=/chemin/cosineo.json            # cats=dresser
 *   npx tsx scripts/import-cosineo.ts dresser 50 50 --file=/chemin/x.json --force
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const MERCHANT = "cosineo";

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const fileArg = args.find((a) => a.startsWith("--file="))?.slice("--file=".length);
  if (!fileArg) { console.error("--file=<json> requis"); process.exit(1); }
  const pos = args.filter((a) => !a.startsWith("--"));
  const cats = (pos[0] || "dresser").split(",").map((s) => s.trim()).filter(Boolean);
  const perCategory = Number(pos[1] ?? 50);
  const maxTotal = Number(pos[2] ?? 50);

  const { ScrapedJsonSource } = await import("../lib/catalog/sources/scraped-json-source");
  const { ingestFromSource } = await import("../lib/catalog/ingest");

  console.log(`Import Cosineo '${MERCHANT}' — cats: ${cats.join(", ")} (perCat=${perCategory}, max=${maxTotal}) ← ${fileArg}`);
  const stats = await ingestFromSource(new ScrapedJsonSource(MERCHANT, fileArg), cats, { perCategory, maxTotal, force });
  console.log(JSON.stringify(stats.perCategory, null, 2));
  console.log(`✅ TOTAL inséré: ${stats.totalInserted}`);
  process.exit(0);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
