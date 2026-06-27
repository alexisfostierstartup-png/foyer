#!/usr/bin/env npx tsx
/**
 * Import Maisons du Monde (catégorie sofa) depuis un JSON scrapé (navigateur réel →
 * contourne l'anti-bot 403). Passe par l'ingest AGNOSTIQUE (embeddings image+texte
 * Jina, dédup (merchant, external_id), throttle) — même pipeline que Awin/Piloterr.
 *
 * MdM = affiliation Effinity (intégration à construire) → affiliate_url null pour
 * l'instant (le clic retombe sur product_url). À recâbler quand Effinity est prêt.
 *
 * Pré-requis : scripts/_mdm/mdm-sofas.json (tableau PartnerProductInput, scrapé).
 *
 * Usage :
 *   npx tsx scripts/import-mdm.ts                       # plan complet (sofa)
 *   npx tsx scripts/import-mdm.ts --canary              # 1 produit (test bout-en-bout)
 *   npx tsx scripts/import-mdm.ts sofa 300 300 --force  # cats perCat maxTotal
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const MERCHANT = "maisons_du_monde";
const DEFAULT_FILE = "scripts/_mdm/mdm-sofas.json";

async function main() {
  const args = process.argv.slice(2);
  const canary = args.includes("--canary");
  const force = args.includes("--force");
  const fileArg = args.find((a) => a.startsWith("--file="))?.slice("--file=".length) ?? DEFAULT_FILE;
  const pos = args.filter((a) => !a.startsWith("--"));
  const cats = (pos[0] || "sofa").split(",").map((s) => s.trim()).filter(Boolean);
  const perCategory = Number(pos[1] ?? (canary ? 1 : 300));
  const maxTotal = Number(pos[2] ?? (canary ? 1 : 300));

  const { ScrapedJsonSource } = await import("../lib/catalog/sources/scraped-json-source");
  const { ingestFromSource } = await import("../lib/catalog/ingest");

  console.log(
    `Import MdM '${MERCHANT}' — cats: ${cats.join(", ")} (perCat=${perCategory}, max=${maxTotal})${canary ? " [CANARY]" : ""} ← ${fileArg}`,
  );
  const source = new ScrapedJsonSource(MERCHANT, fileArg);
  const stats = await ingestFromSource(source, cats, { perCategory, maxTotal, force });
  console.log(JSON.stringify(stats.perCategory, null, 2));
  console.log(`✅ TOTAL inséré: ${stats.totalInserted}`);
  process.exit(0);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
