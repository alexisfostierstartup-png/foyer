import type { FurnitureDecision, RoomType } from "@/lib/types";

export const ROOM_TYPES: RoomType[] = ["salon", "chambre"];

export const ROOM_LABELS: Record<RoomType, string> = {
  salon: "Salon",
  chambre: "Chambre",
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
