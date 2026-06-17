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
    expect(resolveCatalogCategory("chair")).toBeNull();
    expect(resolveCatalogCategory("zzz")).toBeNull();
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
