import type { ElementDecision, ResolvedSupply } from "@/lib/diy/types";
import type { ScoreFoyer } from "@/lib/types";

// ── Application audit ────────────────────────────────────────────────────────

export type ElementCheck = {
  action_slug: string;
  applied: boolean;
  confidence: number;
};

export type AuditElementResult = {
  element_id: string;
  expected: string;
  checks: ElementCheck[];
  element_preserved: boolean;
  notes: string;
};

export type ApplicationAuditResult = {
  elements: AuditElementResult[];
};

// ── Reconciled plan ───────────────────────────────────────────────────────────

export type RepairItem = {
  element_id: string;
  description: string;
  category: string;
  action_slug: string | null;
  target_state: string;
  priority: "keep" | "customize";
};

export type DroppedItem = {
  element_id: string;
  description: string;
  action_slug: string | null;
  action_label: string | null;
  reason: "budget_exceeded" | "not_applied";
};

export type AppliedItem = {
  element_id: string;
  description: string;
  category: string;
  action_slug: string;
  action_label: string;
  supply_items: ResolvedSupply[];
  qty: number | null;
  qty_unit: string | null;
};

export type ReconciledPlan = {
  kept: ElementDecision[];
  applied: AppliedItem[];
  toReplace: ElementDecision[];
  repairQueue: RepairItem[];
  dropList: DroppedItem[];
  repairBudgetExceeded: boolean;
};

// ── Built shopping list ───────────────────────────────────────────────────────

export type DiyEntry = {
  element_id: string;
  element_label: string;
  category: string;
  action_slug: string;
  action_label: string;
  difficulty: "facile" | "intermédiaire" | "avancé";
  time_h: number;
  supply_items: ResolvedSupply[];
};

export type CatalogEntry = {
  element_id: string;
  description: string;
  category: string;
  name: string;
  price: number;
  source: "secondhand" | "new";
  merchant?: string;
  url?: string;
  imgUrl?: string;
};

// Élément à remplacer mais sans produit catalogue correspondant → affiché
// "À sourcer" (visible) au lieu d'être droppé silencieusement.
export type UnmatchedEntry = {
  element_id: string;
  description: string;
  category: string;
};

export type BuiltShoppingList = {
  kept: ElementDecision[];
  diy: DiyEntry[];
  secondhand: CatalogEntry[];
  ecoNew: CatalogEntry[];
  unmatched: UnmatchedEntry[];
  dropped: DroppedItem[];
  score: ScoreFoyer;
};
