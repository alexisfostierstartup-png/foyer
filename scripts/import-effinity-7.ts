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
  // Réactivé 2026-07-11 (décision explicite, après Cyrillus) — reste en scope actif.
  { merchant: "blancheporte", file: "/Users/alexis/Downloads/BlanchePorte_products_405184272.csv", sourceType: "eco_new" },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MERCHANTS_PAUSED: { merchant: string; file: string; sourceType: "eco_new" | "secondhand" }[] = [
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

// Plan = liste ordonnée de (merchant, category, plafond) à traiter. Le dédup produit rend
// tout doublon dans ce plan gratuit (skip immédiat) — donc une phase "priorité" peut se
// contenter de re-couvrir un sous-ensemble déjà inclus dans une phase suivante plus large.
type Step = { merchant: string; category: string; cap: number };
function phase(merchants: string[], categories: string[], cap: number): Step[] {
  const steps: Step[] = [];
  for (const category of categories) for (const merchant of merchants) steps.push({ merchant, category, cap });
  return steps;
}

// Plafond relevé à 600/catégorie pour le mobilier+luminaires "importants" (2026-07-11,
// décision explicite) — le disque a désormais 8 Go avec large marge (VACUUM FULL fait,
// crise résolue). Déco (mirror/cushion) reste à l'ancien plafond, volontairement pas
// "importante" (cf. exclusion vase/decorative_object du même jour).
const CAP_IMPORTANT = 600;
const CAP_DECOR = 300;
// MaisonsDuMonde relevé à 2000/catégorie (2026-07-12, décision explicite — revu à la baisse
// depuis "illimité" : 113k lignes/47k mappées côté MdM aurait pris des heures et pesé sur
// le disque). Reste au-delà du plafond 600/300 partagé avec les autres marchands.
const CAP_MDM_UNCAPPED = 2000;

// Ordre demandé (2026-07-07, révisé) :
//  1. MaisonsDuMonde d'abord sur le gros mobilier (priorité explicite utilisateur).
//  2. Gros mobilier sur tous les marchands (MdM déjà fait → dédup skip instantané).
//  3. Luminaires (pendant_lamp repoussé ici, reprend Selency là où interrompu via dédup).
//  4. Déco.
const PLAN: Step[] = [
  ...phase(["maisons_du_monde"], FURNITURE, CAP_IMPORTANT),
  ...phase(ALL_MERCHANTS, FURNITURE, CAP_IMPORTANT),
  ...phase(ALL_MERCHANTS, LIGHTING, CAP_IMPORTANT),
  ...phase(ALL_MERCHANTS, DECOR, CAP_DECOR),
].map((s) => (s.merchant === "maisons_du_monde" ? { ...s, cap: CAP_MDM_UNCAPPED } : s));

async function main() {
  const onlyMerchant = process.argv[2];
  const onlyCategory = process.argv[3];

  const sources = new Map(MERCHANTS.map((m) => [m.merchant, new EffinityCsvSource(m.merchant, m.file, m.sourceType)]));
  const summary: Record<string, Record<string, number>> = {};
  const startedAt = new Date().toISOString();
  console.log(`[import7] démarrage ${startedAt} — ${PLAN.length} étapes (merchant×catégorie)`);

  for (const { merchant, category, cap } of PLAN) {
    if (onlyCategory && category !== onlyCategory) continue;
    if (onlyMerchant && merchant !== onlyMerchant) continue;
    const source = sources.get(merchant)!;
    try {
      const stats = await ingestFromSource(source, [category], {
        perCategory: cap,
        maxTotal: cap,
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
