import type { CatalogCategory } from "./catalog";
import type { ShoppingItem } from "@/lib/types";

// Source UNIQUE de résolution catégorie → catégorie catalogue (remplace les deux
// maps divergentes de build.ts et matcher.ts). Priorité :
//   1. taxonomie DB (assets.element_category.catalog_category) si fournie ;
//   2. alias texte-libre (sorties IA: "tv unit", "coffee table"…) ;
//   3. correspondance directe si déjà une CatalogCategory.

// Catégories catalogue AUTORISÉES à devenir une ligne de courses. C'est un
// garde-fou VOLONTAIRE (et non la taxonomie DB en confiance aveugle) : il borne ce
// que la liste — et donc le swap expert — peut toucher.
// ⚠️ Une catégorie mappée par la taxonomie mais ABSENTE d'ici est silencieusement
// non shoppable : en ADDITION elle est jetée, en DÉCISION elle finit « À sourcer »
// sans proposition. Toute ouverture de catégorie au catalogue doit donc passer ici.
export const VALID_CATALOG_CATEGORIES: CatalogCategory[] = [
  "sofa", "armchair", "coffee_table", "side_table", "rug", "lamp", "floor_lamp",
  "tv_stand", "bookshelf", "bed", "nightstand", "dresser", "curtains", "cushion",
  "plant", "paint", "mouldings", "floor_material", "other",
  // Ouvertes 2026-07-11 (go Alexis) — bien peuplées au catalogue, elles étaient
  // rejetées : ~7 700 produits inatteignables (pendant_lamp 937, sideboard 982,
  // chair 961, dining_table 805, table_lamp 634, stool/pouf/bench ~1 850,
  // wall_sconce 600). `mirror` (321) reste EN STANDBY à la demande d'Alexis :
  // ne pas élargir la surface que la génération / le swap peuvent casser.
  "sideboard", "chair", "pendant_lamp", "dining_table", "table_lamp",
  "stool", "pouf", "bench", "wall_sconce",
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

  // La taxonomie DB donne le mapping, la whitelist ci-dessus décide s'il est OUVERT
  // à la vente (cf. son commentaire : c'est le garde-fou de ce que la liste et le
  // swap expert peuvent toucher — ex. `mirror` mappé mais volontairement fermé).
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
    // Chaque exemplaire fusionné garde son element_id → un hotspot par
    // exemplaire sur le rendu (2 lampadaires = 1 ligne ×2 mais 2 pins).
    // ⚠️ La fusion peut passer DEUX fois (matchAlterationsToCatalog puis liste
    // globale) : on préserve les elementIds déjà accumulés au lieu de repartir
    // du seul elementId (bug eids=[lamp_1] au lieu de [lamp_1, lamp_2]).
    const incoming = it.elementIds ?? (it.elementId ? [it.elementId] : []);
    if (existing) {
      existing.quantity = (existing.quantity ?? 1) + (it.quantity ?? 1);
      for (const id of incoming) {
        if (!existing.elementIds?.includes(id)) existing.elementIds = [...(existing.elementIds ?? []), id];
      }
    } else {
      map.set(it.id, {
        ...it,
        quantity: it.quantity ?? 1,
        elementIds: incoming.length ? incoming : undefined,
      });
    }
  }
  return [...map.values()];
}
