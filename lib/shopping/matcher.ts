import { CATALOG, type CatalogCategory, type CatalogProduct } from "./catalog";
import type { ShoppingItem, ShoppingSource, ScoreFoyer } from "@/lib/types";
import { resolveCatalogCategory, mergeShoppingItems } from "./categories";
import { SHOPPING_RAW_AUDIT_MODE } from "@/lib/constants";

// Alteration as returned by extract_alterations AI prompt
export type Alteration = {
  element: string;
  action: string;
  category: string;
  detail?: string;
  shoppingImpact: "none" | "to_buy" | "to_buy_secondhand" | "diy_material";
};

// ── Eco RSE advice for heavy alterations ─────────────────────────────────────
const RSE_ADVICE: Partial<Record<CatalogCategory, string>> = {
  floor_material:
    "Alternative durable : béton ciré sur chape existante = moins de déchets de chantier.",
  paint:
    "Optez pour une peinture à l'eau labellisée NF Environnement — VOC réduits, moins de pollution intérieure.",
  mouldings:
    "Les moulures en MDF recyclé sont plus légères et génèrent moins de déchets que le bois massif.",
};

export function getEcoAdvice(category: CatalogCategory): string | null {
  return RSE_ADVICE[category] ?? null;
}

// ── Matcher ──────────────────────────────────────────────────────────────────

function findCandidate(
  category: CatalogCategory,
  styleId: string | null,
  preferSecondhand: boolean,
): CatalogProduct | null {
  // Mode audit : pas de produit par défaut → tout part en "À sourcer".
  if (SHOPPING_RAW_AUDIT_MODE) return null;
  let pool = CATALOG.filter((p) => p.category === category);

  if (pool.length === 0) return null;

  // Style affinity filter (soft — fall back to full pool)
  if (styleId) {
    const styled = pool.filter((p) => p.styleAffinity.includes(styleId as never));
    if (styled.length > 0) pool = styled;
  }

  // Source preference
  if (preferSecondhand) {
    const sh = pool.filter((p) => p.source === "secondhand");
    if (sh.length > 0) return sh[0];
  }

  return pool[0] ?? null;
}

function catalogToShoppingItem(
  product: CatalogProduct,
  alteration: Alteration,
): ShoppingItem {
  const source: ShoppingSource =
    product.source === "secondhand" ? "secondhand" : "new";

  return {
    id: product.id,
    name: product.name,
    category: product.category,
    detail: alteration.detail ?? alteration.element,
    priceMin: product.price,
    priceMax: product.price,
    source,
    merchants: [
      {
        name: product.merchant,
        source,
        url: product.productUrl !== "#" ? product.productUrl : undefined,
      },
    ],
    imgUrl: product.imgUrl,
  };
}

function unmatchedToShoppingItem(alteration: Alteration): ShoppingItem {
  return {
    id: `unmatched-${alteration.category}-${alteration.element}`,
    name: alteration.detail || alteration.element,
    category: alteration.category,
    detail: alteration.element,
    priceMin: 0,
    priceMax: 0,
    source: "new",
    merchants: [],
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export function matchAlterationsToCatalog(
  alterations: Alteration[],
  styleId: string | null,
  taxonomy?: Map<string, string | null>,
): ShoppingItem[] {
  const items = alterations
    .filter((a) => a.shoppingImpact !== "none")
    .map((a) => {
      const cat = resolveCatalogCategory(a.category, taxonomy);
      if (!cat) return unmatchedToShoppingItem(a);

      const preferSecondhand = a.shoppingImpact === "to_buy_secondhand";
      const product = findCandidate(cat, styleId, preferSecondhand);

      if (!product) return unmatchedToShoppingItem(a);

      return catalogToShoppingItem(product, a);
    });
  // Fusionne les identiques en quantité (ex. plusieurs chaises ajoutées → ×N).
  return mergeShoppingItems(items);
}

export function computeScoreFoyer(
  alterations: Alteration[],
  shoppingList: ShoppingItem[],
): ScoreFoyer {
  const kept = alterations.filter((a) => a.shoppingImpact === "none").length;
  const secondhand = shoppingList.filter((i) => i.source === "secondhand").length;
  const ecoNew = shoppingList.filter((i) => i.source !== "secondhand" && i.merchants.length > 0).length;

  const co2SavedKg = kept * 30 + secondhand * 20 + ecoNew * 5;

  const totalEstimated = shoppingList.reduce(
    (sum, item) => sum + ((item.priceMin + item.priceMax) / 2) * (item.quantity ?? 1),
    0,
  );

  return { kept, secondhand, ecoNew, co2SavedKg, totalEstimated };
}
