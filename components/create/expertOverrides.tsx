"use client";

import { createContext, useContext } from "react";
import type { ShoppingItem, CustomProduct } from "@/lib/types";

// Ce qui N'EST PAS un meuble remplacé dans le rendu (miroir de NON_REPLACEABLE dans
// lib/ai/expert.ts — dupliqué ici car ce module client ne peut pas importer le
// pipeline serveur). Tout le RESTE (meuble) affecte le rendu → compte dans « x modifiés ».
const NON_REPLACEABLE = new Set([
  "cushion", "pillow", "throw", "frame", "artwork", "art", "painting", "poster", "mirror",
  "plant", "vase", "book", "books", "decor", "decoration", "tableware", "clock", "candle",
  "lamp", "floor_lamp", "table_lamp", "ceiling_light", "pendant", "pendant_lamp", "wall_light",
  "sconce", "chandelier", "light",
  "curtains", "curtain", "blinds", "drapes",
  "wall", "floor", "ceiling", "window", "door", "radiator", "stairs", "staircase", "fireplace",
  "beam", "column", "pillar", "heater", "water_heater", "molding", "moulding",
]);

/** Une ligne shopping affecte-t-elle le rendu expert (→ compte dans « x modifiés ») ? */
export function affectsRender(item: ShoppingItem): boolean {
  return (
    !!item.elementId &&
    (item.matches?.length ?? 0) > 1 &&
    item.source !== "diy" &&
    !NON_REPLACEABLE.has(item.category)
  );
}

export type ExpertOverridesCtx = {
  enabled: boolean;
  // elementId → index du produit choisi dans `matches`.
  selected: Record<string, number>;
  choose: (elementId: string, idx: number) => void;
  // elementId → produit SUR-MESURE (URL extraite ou JPEG importé).
  custom: Record<string, CustomProduct>;
  setCustom: (elementId: string, cp: CustomProduct | null) => void;
};

const Ctx = createContext<ExpertOverridesCtx | null>(null);

export const ExpertOverridesProvider = Ctx.Provider;

export function useExpertOverrides(): ExpertOverridesCtx | null {
  return useContext(Ctx);
}
