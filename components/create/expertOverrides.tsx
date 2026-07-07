"use client";

import { createContext, useContext } from "react";
import type { ShoppingItem } from "@/lib/types";

// Catégories de GROS meubles que le rendu expert intègre (miroir de EXPERT_CATEGORIES
// dans lib/ai/expert.ts — dupliqué ici car ce module client ne peut pas importer le
// pipeline serveur). Seules ces lignes déclenchent un « nouveau rendu » (les autres
// produits ne sont pas rendus en v1).
const BIG_FURNITURE = new Set([
  "sofa", "armchair", "coffee_table", "dining_table", "side_table", "rug",
  "tv_stand", "sideboard", "bookshelf", "dresser", "bed", "nightstand", "bench",
]);

/** Une ligne shopping affecte-t-elle le rendu expert (→ compte dans « x modifiés ») ? */
export function affectsRender(item: ShoppingItem): boolean {
  return (
    !!item.elementId &&
    (item.matches?.length ?? 0) > 1 &&
    item.source !== "diy" &&
    BIG_FURNITURE.has(item.category)
  );
}

export type ExpertOverridesCtx = {
  enabled: boolean;
  // elementId → index du produit choisi dans `matches`.
  selected: Record<string, number>;
  choose: (elementId: string, idx: number) => void;
};

const Ctx = createContext<ExpertOverridesCtx | null>(null);

export const ExpertOverridesProvider = Ctx.Provider;

export function useExpertOverrides(): ExpertOverridesCtx | null {
  return useContext(Ctx);
}
