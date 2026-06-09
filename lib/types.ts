export type RoomType = "salon" | "chambre";

export type FurnitureDecision = "keep" | "customize" | "replace";

export type Style = {
  id: string;
  name: string;
  description: string;
  paletteHex: string[];
  materials: string[];
  mood: string;
  moodboardUrl: string;
};

export type DetectedFurniture = {
  id: string;
  type: string;
  description: string;
  bbox: { x: number; y: number; w: number; h: number };
  decision: FurnitureDecision;
};

export type UserConstraints = {
  furniture: Record<string, FurnitureDecision>;
  floor: { change: boolean; preset: string | null; note: string };
  walls: {
    repaint: boolean;
    moldings: boolean;
    moldingStyle: string;
    frames: boolean;
  };
  accessories: "cosy" | "epure";
};

export type Project = {
  id: string;
  createdAt: string;
  roomType: RoomType;
  basePhotoUrl: string;
  selectedStyleId: string | null;
  generatedRenderUrl: string | null;
  detectedFurniture: DetectedFurniture[];
  architecture: {
    floor: string;
    walls: string;
    ceiling: string;
    windows: string;
    lighting: string;
  } | null;
  userConstraints: UserConstraints | null;
};
