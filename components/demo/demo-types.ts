import type { RoomType, FurnitureDecision } from "@/lib/types";

export type Accessories = "cosy" | "epure";
export type MoldingStyle = "discret" | "classique" | "marque";

export const FURNITURE_ITEMS = [
  "Canapé",
  "Table basse",
  "Meuble TV",
  "Tapis",
  "Fauteuil",
  "Lampe",
] as const;

export const FLOOR_PRESETS = [
  "Parquet droit",
  "Pose anglaise",
  "Chevron",
  "Béton ciré",
  "Carrelage",
] as const;

export const PAINT_COLORS = [
  { name: "Cream", hex: "#FAF6F0" },
  { name: "Blanc cassé", hex: "#F2ECE0" },
  { name: "Vert d'eau", hex: "#A5B8A0" },
  { name: "Sable", hex: "#D9C3A0" },
  { name: "Gris chaud", hex: "#B8B0A4" },
] as const;

export const MOLDING_STYLES: { id: MoldingStyle; label: string }[] = [
  { id: "discret", label: "Discret" },
  { id: "classique", label: "Classique" },
  { id: "marque", label: "Marqué" },
];

export type UserChoices = {
  roomType: RoomType | null;
  furniture: Record<string, FurnitureDecision>;
  floor: { change: boolean; preset: string | null; note: string };
  walls: {
    repaint: boolean;
    paintColor: string | null;
    moldings: boolean;
    moldingStyle: MoldingStyle;
    frames: boolean;
  };
  accessories: Accessories;
  ambiance: string;
};

export const initialChoices: UserChoices = {
  roomType: null,
  furniture: Object.fromEntries(FURNITURE_ITEMS.map((f) => [f, "keep"])),
  floor: { change: false, preset: "Parquet droit", note: "" },
  walls: {
    repaint: false,
    paintColor: null,
    moldings: false,
    moldingStyle: "classique",
    frames: false,
  },
  accessories: "cosy",
  ambiance: "doux",
};
