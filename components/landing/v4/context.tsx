"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type ShopContextValue = {
  selectedId: string | null;
  /** Sélectionne un produit ; ré-appliquer le même id le désélectionne (toggle). */
  select: (id: string | null) => void;
};

const ShopContext = createContext<ShopContextValue | null>(null);

/**
 * Contexte partagé entre le hero à hotspots, la grille "shop the room" et le
 * rail panier : un produit sélectionné dans l'un reste visible/mis en avant
 * dans les autres (état persistant demandé sur le dispositif hotspots).
 */
export function ShopProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const value = useMemo<ShopContextValue>(
    () => ({
      selectedId,
      select: (id: string | null) =>
        setSelectedId((current) => (id === null ? null : current === id ? null : id)),
    }),
    [selectedId],
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used within a ShopProvider");
  return ctx;
}
