#!/usr/bin/env npx tsx
/**
 * Import Effinity → partner_products, catégorie par catégorie sur TOUTES les marques du
 * scope courant (cohérence des trous d'attributs), comme demandé.
 *
 * Scope RÉDUIT (2026-07-08, décision explicite) : MaisonsDuMonde + Cyrillus seulement
 * (BlanchePorte/Selency/StoresRideaux/TheCoolRepublic/UnAmourDeTapis en pause — pas trop
 * de réfs tant que le pipeline d'attributs n'est pas validé). Fichiers des 5 autres
 * marchands conservés dans MERCHANTS_PAUSED pour réactivation facile plus tard.
 *
 * Pas de plafond (perCategory/maxTotal au-dessus du volume réel observé) : exhaustif sur
 * le scope actif. Rythme séquentiel throttlé (1.5s/produit, cf. lib/catalog/ingest.ts) —
 * volontairement PAS parallélisé (décision explicite : sûr plutôt que rapide). Dédup
 * (merchant, external_id) + skip au niveau produit → une interruption/relance ne re-brûle
 * pas d'embeddings déjà faits.
 *
 * Usage : npx tsx scripts/import-effinity-7.ts [merchant_slug] [category]
 *   (arguments optionnels pour ne relancer qu'un sous-ensemble en cas de reprise ciblée)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { EffinityCsvSource } from "../lib/catalog/sources/effinity-csv-source";
import { ingestFromSource } from "../lib/catalog/ingest";

const MERCHANTS: { merchant: string; file: string; sourceType: "eco_new" | "secondhand" }[] = [
  { merchant: "cyrillus", file: "/Users/alexis/Downloads/Cyrillus_products_405179771.csv", sourceType: "eco_new" },
  { merchant: "maisons_du_monde", file: "/Users/alexis/Downloads/MaisonsDuMonde_products_405179647.csv", sourceType: "eco_new" },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MERCHANTS_PAUSED: { merchant: string; file: string; sourceType: "eco_new" | "secondhand" }[] = [
  { merchant: "blancheporte", file: "/Users/alexis/Downloads/BlanchePorte_products_405184272.csv", sourceType: "eco_new" },
  { merchant: "selency", file: "/Users/alexis/Downloads/Selency_products_405179691.csv", sourceType: "secondhand" },
  { merchant: "stores_rideaux", file: "/Users/alexis/Downloads/StoresRideaux_products_405202037.csv", sourceType: "eco_new" },
  { merchant: "the_cool_republic", file: "/Users/alexis/Downloads/TheCoolRepublic_products_405179724.csv", sourceType: "eco_new" },
  { merchant: "un_amour_de_tapis", file: "/Users/alexis/Downloads/UnAmourDeTapis_products_405220156.csv", sourceType: "eco_new" },
];

// Assise/tables d'abord (demande explicite : plus rapide, moins volumineux que rug),
// rug + curtains repoussés en fin de palier (textile/sol, pas "meuble" au sens strict).
const FURNITURE = [
  "sofa", "armchair", "chair", "coffee_table", "dining_table", "side_table",
  "sideboard", "dresser", "bookshelf", "stool", "desk", "bed", "dressing_table", "nightstand",
  "bench", "pouf", "headboard", "display_cabinet", "tv_stand", "bar_cabinet", "room_divider",
  "rug", "curtains",
];
const LIGHTING = ["pendant_lamp", "table_lamp", "wall_sconce", "floor_lamp"];
// vase/decorative_object retirés (2026-07-09, décision explicite) : dormants (NON
// matchés aujourd'hui), volume élevé, ont contribué inutilement à la crise de quota DB.
// N'affecte PAS ce qui est déjà en base (pas de suppression), seulement les imports futurs.
const DECOR = ["mirror", "cushion"];

const ALL_MERCHANTS = MERCHANTS.map((m) => m.merchant);

// Plan = liste ordonnée de (merchant, category) à traiter. Le dédup produit rend tout
// doublon dans ce plan gratuit (skip immédiat) — donc une phase "priorité" peut se
// contenter de re-couvrir un sous-ensemble déjà inclus dans une phase suivante plus large.
type Step = { merchant: string; category: string };
function phase(merchants: string[], categories: string[]): Step[] {
  const steps: Step[] = [];
  for (const category of categories) for (const merchant of merchants) steps.push({ merchant, category });
  return steps;
}

// Ordre demandé (2026-07-07, révisé) :
//  1. MaisonsDuMonde d'abord sur le gros mobilier (priorité explicite utilisateur).
//  2. Gros mobilier sur tous les marchands (MdM déjà fait → dédup skip instantané).
//  3. Luminaires (pendant_lamp repoussé ici, reprend Selency là où interrompu via dédup).
//  4. Déco.
const PLAN: Step[] = [
  ...phase(["maisons_du_monde"], FURNITURE),
  ...phase(ALL_MERCHANTS, FURNITURE),
  ...phase(ALL_MERCHANTS, LIGHTING),
  ...phase(ALL_MERCHANTS, DECOR),
];

// Plafonné à 300/catégorie (2026-07-08, décision post-incident quota DB) — cf. la
// suppression manuelle qui a ramené MaisonsDuMonde au même chiffre. Fixé ici pour que les
// prochains runs n'aient plus jamais besoin de cette correction a posteriori.
const PER_CATEGORY = 300;
const MAX_TOTAL = 300;

async function main() {
  const onlyMerchant = process.argv[2];
  const onlyCategory = process.argv[3];

  const sources = new Map(MERCHANTS.map((m) => [m.merchant, new EffinityCsvSource(m.merchant, m.file, m.sourceType)]));
  const summary: Record<string, Record<string, number>> = {};
  const startedAt = new Date().toISOString();
  console.log(`[import7] démarrage ${startedAt} — ${PLAN.length} étapes (merchant×catégorie)`);

  for (const { merchant, category } of PLAN) {
    if (onlyCategory && category !== onlyCategory) continue;
    if (onlyMerchant && merchant !== onlyMerchant) continue;
    const source = sources.get(merchant)!;
    try {
      const stats = await ingestFromSource(source, [category], {
        perCategory: PER_CATEGORY,
        maxTotal: MAX_TOTAL,
        force: false,
      });
      const inserted = stats.perCategory[category]?.inserted ?? 0;
      summary[category] = summary[category] ?? {};
      summary[category][merchant] = inserted;
      console.log(`[import7] ${category} / ${merchant}: ${inserted} insérés`);
    } catch (e) {
      console.error(`[import7] FATAL sur ${category}/${merchant}:`, e instanceof Error ? e.message : e);
      console.error("[import7] Arrêt — relancer ce script reprend automatiquement (dédup produit par produit, aucune perte).");
      process.exit(1);
    }
  }

  console.log(`\n[import7] TERMINÉ ${new Date().toISOString()} (démarré ${startedAt})`);
  console.log("=== RÉCAP FINAL (insérés par catégorie × marchand) ===");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error("[import7] Erreur non gérée:", e);
  process.exit(1);
});
