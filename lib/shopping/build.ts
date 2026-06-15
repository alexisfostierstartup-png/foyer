import { CATALOG } from "./catalog";
import type { CatalogCategory, CatalogProduct } from "./catalog";
import type { ReconciledPlan, BuiltShoppingList, DiyEntry, CatalogEntry } from "./types";
import type { ScoreFoyer, ShoppingItem, ShoppingSource } from "@/lib/types";

const ACTION_META: Record<string, { difficulty: "facile" | "intermédiaire" | "avancé"; time_h: number }> = {
  repaint:             { difficulty: "facile",          time_h: 4  },
  stain_wood:          { difficulty: "facile",          time_h: 3  },
  stencil_decor:       { difficulty: "facile",          time_h: 3  },
  replace_hardware:    { difficulty: "facile",          time_h: 1  },
  add_curtain_rail:    { difficulty: "facile",          time_h: 2  },
  apply_adhesive_tiles:{ difficulty: "facile",          time_h: 4  },
  add_cane_insert:     { difficulty: "intermédiaire",   time_h: 5  },
  add_moldings:        { difficulty: "intermédiaire",   time_h: 6  },
  wallpaper:           { difficulty: "intermédiaire",   time_h: 8  },
  reupholster:         { difficulty: "intermédiaire",   time_h: 8  },
  add_slat_headboard:  { difficulty: "intermédiaire",   time_h: 8  },
  install_wainscoting: { difficulty: "intermédiaire",   time_h: 12 },
  fresco_wall:         { difficulty: "intermédiaire",   time_h: 6  },
  lay_tiles:           { difficulty: "avancé",          time_h: 24 },
  refinish_floor:      { difficulty: "avancé",          time_h: 16 },
};

const CATEGORY_NORMALISE: Record<string, CatalogCategory> = {
  floor: "floor_material", flooring: "floor_material", floor_changed: "floor_material",
  moldings: "mouldings",  molding: "mouldings",
  bookcase: "bookshelf",  shelf: "bookshelf", shelving: "bookshelf",
  wardrobe: "dresser",    closet: "dresser",
  table: "coffee_table",
  armchair: "armchair",   "arm chair": "armchair",
  "floor lamp": "floor_lamp",
  "tv unit": "tv_stand",  "media unit": "tv_stand",
  curtain: "curtains",    drapes: "curtains",
};

const VALID_CATEGORIES: CatalogCategory[] = [
  "sofa","armchair","coffee_table","side_table","rug","lamp","floor_lamp",
  "tv_stand","bookshelf","bed","nightstand","dresser","curtains","cushion",
  "plant","paint","mouldings","floor_material","other",
];

function toCategory(raw: string): CatalogCategory | null {
  const lower = raw.toLowerCase().trim();
  if (CATEGORY_NORMALISE[lower]) return CATEGORY_NORMALISE[lower];
  const direct = lower.replace(/\s+/g, "_") as CatalogCategory;
  return VALID_CATEGORIES.includes(direct) ? direct : null;
}

function findProduct(
  category: CatalogCategory,
  styleId: string | null,
  preferSecondhand: boolean,
): CatalogProduct | null {
  let pool = CATALOG.filter((p) => p.category === category);
  if (pool.length === 0) return null;
  if (styleId) {
    const styled = pool.filter((p) => p.styleAffinity.includes(styleId as never));
    if (styled.length > 0) pool = styled;
  }
  if (preferSecondhand) {
    const sh = pool.filter((p) => p.source === "secondhand");
    if (sh.length > 0) return sh[0];
  }
  return pool[0] ?? null;
}

export function buildShoppingList(
  plan: ReconciledPlan,
  styleId: string | null = null,
): BuiltShoppingList {
  // ── DIY entries ───────────────────────────────────────────────────────────
  const diy: DiyEntry[] = plan.applied.map((item) => ({
    element_id: item.element_id,
    element_label: item.description,
    category: item.category,
    action_slug: item.action_slug,
    action_label: item.action_label,
    difficulty: ACTION_META[item.action_slug]?.difficulty ?? "intermédiaire",
    time_h: ACTION_META[item.action_slug]?.time_h ?? 4,
    supply_items: item.supply_items,
  }));

  // ── Catalog entries from structural decisions ──────────────────────────────
  const secondhand: CatalogEntry[] = [];
  const ecoNew: CatalogEntry[] = [];
  const seen = new Set<string>();

  for (const d of plan.toReplace) {
    const cat = toCategory(d.category);
    if (!cat) continue;

    // Prefer secondhand
    const shProduct = findProduct(cat, styleId, true);
    if (shProduct && shProduct.source === "secondhand" && !seen.has(shProduct.id)) {
      seen.add(shProduct.id);
      secondhand.push({
        element_id: d.element_id,
        description: d.description,
        category: cat,
        name: shProduct.name,
        price: shProduct.price,
        source: "secondhand",
        merchant: shProduct.merchant,
        url: shProduct.productUrl !== "#" ? shProduct.productUrl : undefined,
        imgUrl: shProduct.imgUrl,
      });
      continue;
    }

    // Fallback eco new
    const newProduct = findProduct(cat, styleId, false);
    if (newProduct && !seen.has(newProduct.id)) {
      seen.add(newProduct.id);
      ecoNew.push({
        element_id: d.element_id,
        description: d.description,
        category: cat,
        name: newProduct.name,
        price: newProduct.price,
        source: "new",
        merchant: newProduct.merchant,
        url: newProduct.productUrl !== "#" ? newProduct.productUrl : undefined,
        imgUrl: newProduct.imgUrl,
      });
    }
  }

  // ── Score Foyer ───────────────────────────────────────────────────────────
  const totalEstimated =
    secondhand.reduce((s, e) => s + e.price, 0) +
    ecoNew.reduce((s, e) => s + e.price, 0);

  const score: ScoreFoyer = {
    kept: plan.kept.length,
    secondhand: secondhand.length,
    ecoNew: ecoNew.length,
    co2SavedKg: plan.kept.length * 30 + secondhand.length * 20 + ecoNew.length * 5,
    totalEstimated,
  };

  return {
    kept: plan.kept,
    diy,
    secondhand,
    ecoNew,
    dropped: plan.dropList,
    score,
  };
}

// Convert to legacy ShoppingItem[] for backward compat with existing UI
export function builtToLegacyShoppingList(built: BuiltShoppingList): ShoppingItem[] {
  const items: ShoppingItem[] = [];

  for (const diyEntry of built.diy) {
    for (const supply of diyEntry.supply_items) {
      items.push({
        id: `diy-${diyEntry.element_id}-${supply.name.replace(/\s+/g, "-")}`,
        name: supply.name,
        category: diyEntry.category,
        detail: `${diyEntry.action_label} — ${diyEntry.element_label}`,
        priceMin: 0,
        priceMax: 0,
        source: "diy" as ShoppingSource,
        merchants: [],
      });
    }
  }

  for (const entry of built.secondhand) {
    items.push({
      id: `sh-${entry.element_id}`,
      name: entry.name,
      category: entry.category,
      detail: entry.description,
      priceMin: entry.price,
      priceMax: entry.price,
      source: "secondhand" as ShoppingSource,
      merchants: entry.merchant
        ? [{ name: entry.merchant, source: "secondhand" as ShoppingSource, url: entry.url }]
        : [],
      imgUrl: entry.imgUrl,
    });
  }

  for (const entry of built.ecoNew) {
    items.push({
      id: `new-${entry.element_id}`,
      name: entry.name,
      category: entry.category,
      detail: entry.description,
      priceMin: entry.price,
      priceMax: entry.price,
      source: "new" as ShoppingSource,
      merchants: entry.merchant
        ? [{ name: entry.merchant, source: "new" as ShoppingSource, url: entry.url }]
        : [],
      imgUrl: entry.imgUrl,
    });
  }

  return items;
}
