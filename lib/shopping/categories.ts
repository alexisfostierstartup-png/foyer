import type { CatalogCategory } from "./catalog";
import type { ShoppingItem } from "@/lib/types";

// Source UNIQUE de résolution catégorie → catégorie catalogue (remplace les deux
// maps divergentes de build.ts et matcher.ts). Priorité :
//   1. taxonomie DB (assets.element_category.catalog_category) si fournie ;
//   2. alias texte-libre (sorties IA: "tv unit", "coffee table"…) ;
//   3. correspondance directe si déjà une CatalogCategory.

export const VALID_CATALOG_CATEGORIES: CatalogCategory[] = [
  "sofa", "armchair", "coffee_table", "side_table", "rug", "lamp", "floor_lamp",
  "tv_stand", "bookshelf", "bed", "nightstand", "dresser", "curtains", "cushion",
  "plant", "paint", "mouldings", "floor_material", "other",
];

// Alias pour les libellés libres renvoyés par l'IA (extract_alterations / additions).
const ALIAS_MAP: Record<string, CatalogCategory> = {
  floor: "floor_material", flooring: "floor_material", floor_changed: "floor_material",
  moldings: "mouldings", molding: "mouldings",
  bookcase: "bookshelf", shelf: "bookshelf", shelving: "bookshelf",
  wardrobe: "dresser", closet: "dresser",
  table: "coffee_table", "coffee table": "coffee_table", "side table": "side_table",
  "arm chair": "armchair",
  "floor lamp": "floor_lamp", "floor light": "floor_lamp",
  "tv unit": "tv_stand", "media unit": "tv_stand",
  curtain: "curtains", drapes: "curtains",
};

/**
 * Résout une catégorie brute (slug taxo OU libellé IA) vers une CatalogCategory.
 * Retourne null si non mappable → l'élément devient un item "À sourcer" (visible),
 * jamais droppé silencieusement.
 */
export function resolveCatalogCategory(
  raw: string,
  taxonomy?: Map<string, string | null>,
): CatalogCategory | null {
  const lower = raw.toLowerCase().trim();

  if (taxonomy && taxonomy.has(lower)) {
    const mapped = taxonomy.get(lower) ?? null;
    return mapped && VALID_CATALOG_CATEGORIES.includes(mapped as CatalogCategory)
      ? (mapped as CatalogCategory)
      : null;
  }
  if (ALIAS_MAP[lower]) return ALIAS_MAP[lower];

  const direct = lower.replace(/\s+/g, "_") as CatalogCategory;
  return VALID_CATALOG_CATEGORIES.includes(direct) ? direct : null;
}

/**
 * Fusionne les items identiques (même id) en une seule ligne avec `quantity`
 * cumulée. Remplace les dédup "garder-1-jeter-le-reste" qui perdaient le compte
 * (ex. 6 chaises identiques → 1 ligne ×6 au lieu d'1 ligne ou 6 doublons).
 */
export function mergeShoppingItems(items: ShoppingItem[]): ShoppingItem[] {
  const map = new Map<string, ShoppingItem>();
  for (const it of items) {
    const existing = map.get(it.id);
    if (existing) {
      existing.quantity = (existing.quantity ?? 1) + (it.quantity ?? 1);
    } else {
      map.set(it.id, { ...it, quantity: it.quantity ?? 1 });
    }
  }
  return [...map.values()];
}
