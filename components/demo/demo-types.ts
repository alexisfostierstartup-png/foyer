import type { RoomType, FurnitureDecision } from "@/lib/types";

export type Accessories = "cosy" | "epure";
export type MoldingStyle = "discret" | "classique" | "marque";
export type FloorPatternId =
  | "droit"
  | "anglaise"
  | "chevron"
  | "beton"
  | "carrelage";

export const FURNITURE_ITEMS = [
  "Canapé",
  "Table basse",
  "Meuble TV",
  "Tapis",
  "Fauteuil",
  "Lampe",
] as const;

export const FLOOR_PRESETS: { label: string; pattern: FloorPatternId }[] = [
  { label: "Parquet droit", pattern: "droit" },
  { label: "Parquet pose anglaise", pattern: "anglaise" },
  { label: "Parquet chevron", pattern: "chevron" },
  { label: "Béton ciré", pattern: "beton" },
  { label: "Carrelage", pattern: "carrelage" },
];

export const MOLDING_STYLES: { id: MoldingStyle; label: string }[] = [
  { id: "discret", label: "Discret" },
  { id: "classique", label: "Classique" },
  { id: "marque", label: "Marqué" },
];

export type UserChoices = {
  roomType: RoomType | null;
  // No default decision: a furniture key only exists once the user picks one.
  furniture: Record<string, FurnitureDecision>;
  floor: { change: boolean; preset: string | null; note: string };
  walls: {
    repaint: boolean;
    moldings: boolean;
    moldingStyle: MoldingStyle;
    frames: boolean;
  };
  accessories: Accessories;
  ambiance: string;
};

export const initialChoices: UserChoices = {
  roomType: null,
  furniture: {},
  floor: { change: false, preset: "Parquet droit", note: "" },
  walls: {
    repaint: false,
    moldings: false,
    moldingStyle: "classique",
    frames: false,
  },
  accessories: "cosy",
  ambiance: "doux",
};
