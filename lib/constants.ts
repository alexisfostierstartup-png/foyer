import type { FurnitureDecision, RoomType } from "@/lib/types";

export const ROOM_TYPES: RoomType[] = ["salon", "chambre", "chambre_parentale"];

export const ROOM_LABELS: Record<RoomType, string> = {
  salon: "Salon",
  chambre: "Chambre",
  chambre_parentale: "Chambre parentale",
};

export const DECISIONS: FurnitureDecision[] = ["keep", "customize", "replace"];

export const DECISION_LABELS: Record<FurnitureDecision, string> = {
  keep: "Garder",
  customize: "Customiser",
  replace: "Remplacer",
};

// Semantic colors from the Foyer palette (see app/globals.css).
export const DECISION_COLORS: Record<FurnitureDecision, string> = {
  keep: "#6B8E6F", // sage
  customize: "#C89B6A", // ochre
  replace: "#C0664A", // terra
};

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB
export const UPLOAD_MAX_DIMENSION = 1024; // px, longest edge after resize

// Free-tier limits before auth / paywall.
export const MAX_FREE_GENERATIONS = 1;
export const MAX_FREE_EDITS = 2;

// TEMP (dev/test) : désactive le paywall pour tester le flow complet sans limite.
// Repasser à false pour réactiver.
export const PAYWALL_DISABLED = true;

// Matching catalogue : score = alpha·cosine(image) + (1-alpha)·cosine(texte produit).
// En dessous du seuil → "À sourcer". À tuner.
export const MATCH_BLEND_ALPHA = 0.5;
export const MATCH_MIN_SIMILARITY = 0.25;

// Pré-filtre couleur (réversible). 1 = on hard-filtre les candidats par FAMILLE de couleur
// (RPC blend_v2, array-overlap tolérant) avant le blend ; 0 = comportement v1 inchangé.
// But : ne pas proposer un canapé vert pour un rendu bleu + élaguer le pool (latence). On ne
// l'applique QUE là où la couleur discrimine déjà (weights.color.weight ≥ seuil ci-dessous) →
// jamais sur les cats où la forme prime (table 0.04, fauteuil 0.08). Flip à 0 si ça nuit à la
// similarité. À pérenniser si ça l'améliore.
export const MATCH_COLOR_FAMILY_RESTRICT = 1;
export const MATCH_COLOR_FAMILY_MIN_WEIGHT = 0.15;

// Bonus de STYLE au matching (réversible). 1 = les produits taggés du style du projet
// (partner_products.style_affinity = tags "core", metadata.style_compatible = tags
// faibles) reçoivent un bonus ADDITIF sur le score final avant le tri — jamais de
// pénalité pour les produits non taggés (le backfill est progressif). Ordres de
// grandeur : les écarts du top-pool blend font ~0.01-0.06 → core à 0.05 re-classe
// franchement à qualité visuelle proche, sans permettre à un mauvais match visuel
// (-0.10) de doubler un excellent. Flip à 0 si ça appauvrit les propositions
// (catalogue peu couvert sur certains styles → voir dashboard des trous).
// Écart core/compat resserré (0.03/0.02) : à +0.05 le bonus core inversait des
// classements entiers quand les autres signaux manquaient (cas meuble TV 2026-07-10,
// feedback Alexis : « la logique est bonne mais trop d'écart de poids ») — le style
// doit départager des produits PROCHES, jamais compenser un mauvais match.
export const MATCH_STYLE_BONUS = 1;
export const MATCH_STYLE_BONUS_CORE = 0.03;
export const MATCH_STYLE_BONUS_COMPAT = 0.02;

