export type MaterialFamily =
  | "wood"
  | "metal"
  | "fabric"
  | "leather"
  | "stone"
  | "ceramic"
  | "glass"
  | "plastic"
  | "paint"
  | "unknown";

export type MismatchType = "none" | "surface" | "structural";

export type DiyActionRequires = {
  material_family?: MaterialFamily[];
  surface_features?: string[];
  condition?: Array<"good" | "fair" | "poor">;
};

export type SupplyItem = {
  name: string;
  qty_formula: string;
  unit: string;
};

export type DiyAction = {
  id: string;
  slug: string;
  label: string;
  label_en: string | null;
  applies_to_categories: string[];
  requires: DiyActionRequires;
  excludes: DiyActionRequires;
  qty_formula: string | null;
  qty_unit: string | null;
  // Affinité par style — trie les candidats. Convention (consultée en mode
  // beta uniquement) : valeur NÉGATIVE = exclusion dure pour ce style.
  style_affinity: Record<string, number>;
  supplies_template: SupplyItem[] | null;
  is_active: boolean;
  // Niveau bricoleur requis (1 néophyte / 2 expérimenté / 3 confirmé).
  // Consulté uniquement en mode beta (flux standard inchangé).
  level: number;
  // L'action peut être montrée fidèlement dans le rendu image. En mode beta,
  // gate le RESTYLE visible ; false → le rendu garde le comportement REPLACE.
  renderable: boolean;
  // Action visible uniquement dans le flux beta (is_active=false pour elles).
  beta: boolean;
  // Extensions de catégories mergées dans applies_to_categories UNIQUEMENT en
  // mode beta — le flux standard garde exactement ses candidats actuels.
  beta_categories: string[];
};

// Mode de sélection des actions DIY. "beta" = flux alternatif ?diy=beta.
// undefined = flux standard, bit à bit identique à avant.
export type DiyMode = "beta" | undefined;

export type ElementDims = {
  width_cm?: number;
  height_cm?: number;
  depth_cm?: number;
  area_m2?: number;
  length_m?: number;
};

export type ElementProfile = {
  element_id: string;
  element: string;
  category: string;
  description: string;
  color?: string;
  material_family: MaterialFamily;
  surface_features: string[];
  condition: "good" | "fair" | "poor";
  movable: boolean;
  dims: ElementDims;
  // Boîte englobante normalisée 0-1 (renseignée seulement pour la détection d'inventaire
  // du RENDU, withBbox) → crop des AJOUTS pour le matching image↔image.
  bbox?: { x: number; y: number; w: number; h: number };
  // Couleur dominante de l'objet (hex), lue par Gemini → terme couleur ΔE du matching.
  color_hex?: string;
  // Attrs structurés V3 (renseignés avec withBbox sur l'inventaire du rendu) → score structuré.
  attrs?: Record<string, unknown>;
};

export type ResolvedSupply = {
  name: string;
  qty: number;
  unit: string;
};

export type ElementDecision = {
  element_id: string;
  description: string;
  category: string;
  mismatch_type: MismatchType;
  action_slug: string | null;
  action_label: string | null;
  qty: number | null;
  qty_unit: string | null;
  supply_items: ResolvedSupply[] | null;
  override: boolean;
};

export type VerdictsResult = {
  decisions: Array<{
    element_id: string;
    mismatch_type: MismatchType;
    action_slug: string | null;
    action_label: string | null;
  }>;
};
