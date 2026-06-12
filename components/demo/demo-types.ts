import type { RoomType, FurnitureDecision } from "@/lib/types";

export type Accessories = "cosy" | "epure";
export type MoldingStyle = "discret" | "classique" | "marque";

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
  floor: { change: false, preset: null, note: "" },
  walls: {
    repaint: false,
    moldings: false,
    moldingStyle: "classique",
    frames: false,
  },
  accessories: "cosy",
  ambiance: "doux",
};
