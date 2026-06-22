import { CATALOG } from "./catalog";
import type { CatalogCategory, CatalogProduct } from "./catalog";
import type { ReconciledPlan, BuiltShoppingList, DiyEntry, CatalogEntry, UnmatchedEntry } from "./types";
import type { ScoreFoyer, ShoppingItem, ShoppingSource } from "@/lib/types";
import { resolveCatalogCategory, mergeShoppingItems } from "./categories";
import { SHOPPING_RAW_AUDIT_MODE } from "@/lib/constants";

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

function findProduct(
  category: CatalogCategory,
  styleId: string | null,
  preferSecondhand: boolean,
): CatalogProduct | null {
  // Mode audit : pas de produit par défaut → tout part en "À sourcer".
  if (SHOPPING_RAW_AUDIT_MODE) return null;
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
  taxonomy?: Map<string, string | null>,
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
  const unmatched: UnmatchedEntry[] = [];

  // Pas de dédup ici : les identiques sont fusionnés plus tard avec une quantité
  // (mergeShoppingItems), pour ne plus perdre le compte (ex. 6 chaises → ×6).
  for (const d of plan.toReplace) {
    const cat = resolveCatalogCategory(d.category, taxonomy);
    if (!cat) {
      unmatched.push({ element_id: d.element_id, description: d.description, category: d.category });
      continue;
    }

    // Prefer secondhand
    const shProduct = findProduct(cat, styleId, true);
    if (shProduct && shProduct.source === "secondhand") {
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
    if (newProduct) {
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
      continue;
    }

    // Catégorie valide mais aucun produit catalogue → à sourcer (visible).
    // On garde la catégorie FEUILLE du flow (d.category), pas la catégorie
    // catalogue, pour rester cohérent avec la détection/review (ex. ceiling_light,
    // pas "lamp").
    unmatched.push({ element_id: d.element_id, description: d.description, category: d.category });
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
    unmatched,
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
        elementId: diyEntry.element_id,
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
      elementId: entry.element_id,
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
      elementId: entry.element_id,
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

  // Non-matchés → ligne "À sourcer" (sans marchand, prix 0). id keyé sur
  // catégorie+description pour fusionner les identiques en quantité.
  for (const entry of built.unmatched) {
    items.push({
      id: `unmatched-${entry.category}-${entry.description}`,
      name: entry.description || entry.category,
      category: entry.category,
      elementId: entry.element_id,
      detail: "",
      priceMin: 0,
      priceMax: 0,
      source: "new" as ShoppingSource,
      merchants: [],
    });
  }

  // Fusionne les lignes identiques en quantité (ex. 6 chaises → 1 ligne ×6).
  return mergeShoppingItems(items);
}
