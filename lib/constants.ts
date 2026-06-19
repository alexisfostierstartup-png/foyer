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

// Mode test : la liste de courses finale n'associe PAS de produit catalogue par
// défaut. Chaque élément à acheter est affiché « À sourcer » avec sa catégorie,
// matière et couleur (issues de l'audit), pour vérifier le travail de l'audit.
// Repasser à false pour réactiver le matching catalogue (vraie liste de courses).
export const SHOPPING_RAW_AUDIT_MODE = true;
