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

// Mode test : la liste de courses finale n'associe PAS de produit catalogue par
// défaut. Chaque élément à acheter est affiché « À sourcer » avec sa catégorie,
// matière et couleur (issues de l'audit), pour vérifier le travail de l'audit.
// Repasser à false pour réactiver le matching catalogue (vraie liste de courses).
export const SHOPPING_RAW_AUDIT_MODE = true;
