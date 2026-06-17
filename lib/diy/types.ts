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
  style_affinity: Record<string, number>;
  supplies_template: SupplyItem[] | null;
  is_active: boolean;
};

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
