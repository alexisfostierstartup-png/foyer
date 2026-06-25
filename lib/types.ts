// Les types de pièce sont définis par les assets room_defaults (data-driven) —
// d'où un type permissif : ajouter une pièce = ajouter un asset, pas éditer une union.
export type RoomType = string;

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

export type ShoppingSource = "reuse" | "secondhand" | "new" | "diy";

export type ShoppingMerchant = {
  name: string;
  source: ShoppingSource;
  url?: string;
};

export type MatchingSource = "mock_catalog" | "lbc" | "partner" | "kept";

// Produit réel du catalogue (partner_products) matché à un item de la liste de courses.
export type ProductMatch = {
  id: string;
  name: string;
  category: string;
  merchant: string;
  source_type: string;
  price: number | null;
  primary_image_url: string | null;
  product_url: string | null;
  similarity: number;
  // Calibration du blend (ÉTAPE 4) : cosines décomposés du top-1 — sim_image (crop↔image
  // produit) et sim_text (description↔texte produit). Permet de régler w/seuils sur données.
  simImage?: number;
  simText?: number;
  // Couleur dominante du produit (hex) + ΔE à la couleur de l'élément (calibration couleur).
  colorHex?: string | null;
  colorDeltaE?: number;
  // Score structuré (attrs V3 rendu↔produit) ∈ [0,1] du re-ranking (Étape 2). undefined
  // si l'élément ou le produit n'a pas d'attrs (→ pas de bonus, neutre).
  structScore?: number;
};

export type ShoppingItem = {
  id: string;
  name: string;
  category: string;
  detail: string;
  priceMin: number;
  priceMax: number;
  source: ShoppingSource;
  merchants: ShoppingMerchant[];
  imgUrl?: string;
  // Hybrid matching metadata (α-10+)
  matchingSource?: MatchingSource;
  similarity?: number;
  city?: string;
  affiliateUrl?: string;
  postedAt?: string;
  // Nombre d'exemplaires identiques fusionnés sur cette ligne (ex. 6 chaises → 6).
  // Absent ou 1 = une seule unité.
  quantity?: number;
  // Vrais produits du catalogue matchés (top-N par similarité cosine). [0] = meilleur.
  matches?: ProductMatch[];
  // Élément source (decision.element_id) → permet de retrouver son crop/bbox dans le rendu
  // pour le matching image↔image. Absent pour les ajouts nets (détectés sans bbox).
  elementId?: string;
  // PEINTURE : couleur du mur détectée dans le rendu (hex) → matching ΔE + affichée.
  targetHex?: string;
};

export type { ElementDecision } from "./diy/types";

export type ScoreFoyer = {
  kept: number;
  secondhand: number;
  ecoNew: number;
  co2SavedKg: number;
  totalEstimated: number;
};

export type Project = {
  id: string;
  createdAt: string;
  userId?: string;
  anon_id?: string;
  is_saved?: boolean;
  live_edits_used?: number;
  storageFolder: string;
  roomType: RoomType;
  basePhotoUrl: string;
  selectedStyleId: string | null;
  generatedRenderUrl: string | null;
  firstRenderUrl?: string;
  // "3 dispositions" : 3 rendus distincts (feature experts), parmi lesquels le
  // user en choisit un (qui devient generatedRenderUrl).
  dispositionsRenderUrls?: string[];
  iterationCount?: number;
  editRequests?: string[]; // demandes d'édition live successives (pour le diff intent)
  detectedFurniture: DetectedFurniture[];
  architecture: {
    floor: string;
    walls: string;
    ceiling: string;
    windows: string;
    lighting: string;
  } | null;
  visionOutput?: unknown;
  alterations?: unknown;
  shoppingList?: ShoppingItem[];
  scoreFoyer?: ScoreFoyer;
  userConstraints: UserConstraints | null;
  element_decisions?: import("./diy/types").ElementDecision[] | null;
  applicationAudit?: import("./shopping/types").ApplicationAuditResult;
  reconciledPlan?: import("./shopping/types").ReconciledPlan;
  builtShoppingList?: import("./shopping/types").BuiltShoppingList;
  repairApplied?: boolean;
};
