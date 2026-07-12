import { describe, it, expect } from "vitest";
import { resolveCatalogCategory, mergeShoppingItems, VALID_CATALOG_CATEGORIES } from "../categories";
import type { ShoppingItem } from "@/lib/types";

const item = (id: string, over: Partial<ShoppingItem> = {}): ShoppingItem => ({
  id,
  name: id,
  category: "sofa",
  detail: "",
  priceMin: 100,
  priceMax: 100,
  source: "new",
  merchants: [],
  ...over,
});

describe("resolveCatalogCategory", () => {
  it("direct match sur une CatalogCategory", () => {
    expect(resolveCatalogCategory("sofa")).toBe("sofa");
    expect(resolveCatalogCategory("coffee_table")).toBe("coffee_table");
  });

  it("alias texte-libre IA", () => {
    expect(resolveCatalogCategory("tv unit")).toBe("tv_stand");
    expect(resolveCatalogCategory("coffee table")).toBe("coffee_table");
    expect(resolveCatalogCategory("floor")).toBe("floor_material");
  });

  it("inconnu → null (deviendra 'À sourcer')", () => {
    expect(resolveCatalogCategory("television")).toBeNull();
    expect(resolveCatalogCategory("zzz")).toBeNull();
  });

  // Ouverture 2026-07-11 : ces catégories sont bien peuplées au catalogue et étaient
  // rejetées par la whitelist (~7 700 produits inatteignables — un AJOUT du rendu y
  // était jeté en silence, ex. la suspension du projet dapv_sgkx).
  it("catégories ouvertes au catalogue (go Alexis)", () => {
    const taxo = new Map<string, string | null>([["ceiling_light", "pendant_lamp"]]);
    expect(resolveCatalogCategory("ceiling_light", taxo)).toBe("pendant_lamp");
    for (const c of ["sideboard", "chair", "dining_table", "table_lamp", "stool", "pouf", "bench", "wall_sconce"]) {
      expect(resolveCatalogCategory(c)).toBe(c);
    }
  });

  // `mirror` reste VOLONTAIREMENT fermé (standby Alexis) : ne pas élargir la surface
  // que la génération / le swap expert peuvent casser. Ce test garde la décision.
  it("mirror reste non shoppable même si la taxonomie le mappe", () => {
    const taxo = new Map<string, string | null>([["mirror", "mirror"]]);
    expect(resolveCatalogCategory("mirror", taxo)).toBeNull();
    expect(resolveCatalogCategory("mirror")).toBeNull();
  });

  it("taxonomie prioritaire : slug → catalog_category", () => {
    const taxo = new Map<string, string | null>([
      ["coffee_table", "coffee_table"],
      ["television", null], // pas de produit → non matché
      ["dining_table", null],
    ]);
    expect(resolveCatalogCategory("coffee_table", taxo)).toBe("coffee_table");
    expect(resolveCatalogCategory("television", taxo)).toBeNull();
    expect(resolveCatalogCategory("dining_table", taxo)).toBeNull();
  });

  it("VALID_CATALOG_CATEGORIES contient les catégories du catalogue", () => {
    expect(VALID_CATALOG_CATEGORIES).toContain("tv_stand");
    expect(VALID_CATALOG_CATEGORIES).toContain("floor_material");
  });
});

describe("mergeShoppingItems", () => {
  it("fusionne les identiques en quantité (6 chaises → ×6)", () => {
    const merged = mergeShoppingItems([
      item("chair-1"), item("chair-1"), item("chair-1"),
      item("chair-1"), item("chair-1"), item("chair-1"),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(6);
  });

  it("préserve les ids distincts (quantité 1)", () => {
    const merged = mergeShoppingItems([item("a"), item("b"), item("c")]);
    expect(merged).toHaveLength(3);
    expect(merged.every((i) => i.quantity === 1)).toBe(true);
  });

  it("cumule des quantités préexistantes", () => {
    const merged = mergeShoppingItems([
      item("x", { quantity: 2 }),
      item("x", { quantity: 3 }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(5);
  });
});
