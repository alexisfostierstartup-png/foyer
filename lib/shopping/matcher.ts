import { CATALOG, type CatalogCategory, type CatalogProduct } from "./catalog";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { computeTextEmbedding } from "@/lib/embeddings/jina";
import { withTracking } from "@/lib/tracking";
import { searchLbc, computeLbcHybridScore, type LbcItem } from "@/lib/lbc/search";
import { getLbcCategory, getStyleKeywords } from "@/lib/lbc/categoryMap";
import type { ShoppingItem, ShoppingSource, ScoreFoyer } from "@/lib/types";
import { resolveCatalogCategory, mergeShoppingItems } from "./categories";

// Re-export pour compatibilité pipeline
export type Alteration = {
  element: string;
  action: string;
  category: string;
  detail?: string;
  shoppingImpact: "none" | "to_buy" | "to_buy_secondhand" | "diy_material";
  // Ajouts détectés dans le rendu : element_id + bbox → crop pour le matching image.
  element_id?: string;
  bbox?: { x: number; y: number; w: number; h: number };
  color_hex?: string; // couleur dominante (hex) → terme couleur ΔE.
  attrs?: Record<string, unknown>; // attrs structurés V3 (ajouts/remplacés) → score structuré.
};

type PartnerProductRow = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number | null;
  product_url: string;
  affiliate_url: string | null;
  image_urls: string[];
  primary_image_url: string;
  style_affinity: string[];
  source_type: string;
  merchant: string;
  partner_tier: string;
  similarity: number;
};

const LBC_THRESHOLD = 0.55;

// ── Category normalisation (inchangé) ────────────────────────────────────────
const CATEGORY_MAP: Record<string, CatalogCategory> = {
  floor: "floor_material",
  floor_changed: "floor_material",
  flooring: "floor_material",
  moldings: "mouldings",
  molding: "mouldings",
  bookcase: "bookshelf",
  shelf: "bookshelf",
  shelving: "bookshelf",
  wardrobe: "dresser",
  closet: "dresser",
  table: "coffee_table",
  "coffee table": "coffee_table",
  "side table": "side_table",
  armchair: "armchair",
  "arm chair": "armchair",
  "floor lamp": "floor_lamp",
  "floor light": "floor_lamp",
  "tv unit": "tv_stand",
  "media unit": "tv_stand",
  curtain: "curtains",
  drapes: "curtains",
};

function normaliseCategory(raw: string): CatalogCategory | null {
  const lower = raw.toLowerCase().trim();
  if (CATEGORY_MAP[lower]) return CATEGORY_MAP[lower];
  const direct = lower.replace(/\s+/g, "_") as CatalogCategory;
  const valid: CatalogCategory[] = [
    "sofa", "armchair", "coffee_table", "side_table", "rug", "lamp",
    "floor_lamp", "tv_stand", "bookshelf", "bed", "nightstand", "dresser",
    "curtains", "cushion", "plant", "paint", "mouldings", "floor_material", "other",
  ];
  return valid.includes(direct) ? direct : null;
}

// ── Mock catalog helpers (fallback si Jina/Piloterr down) ────────────────────
function findCandidateMock(
  category: CatalogCategory,
  styleId: string | null,
  preferSecondhand: boolean,
): CatalogProduct | null {
  // Catalogue mock retiré (WoZ) → CATALOG vide → null (fallback seulement si Jina down).
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

function catalogProductToShoppingItem(
  product: CatalogProduct,
  alteration: Alteration,
): ShoppingItem {
  const source: ShoppingSource = product.source === "secondhand" ? "secondhand" : "new";
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    elementId: alteration.element_id,
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
    matchingSource: "mock_catalog",
  };
}

function unmatchedToShoppingItem(alteration: Alteration): ShoppingItem {
  return {
    id: `unmatched-${alteration.category}-${alteration.element}`,
    name: alteration.detail || alteration.element,
    category: alteration.category,
    elementId: alteration.element_id,
    detail: alteration.element,
    priceMin: 0,
    priceMax: 0,
    source: "new",
    merchants: [],
    matchingSource: "mock_catalog",
  };
}

// ── Partner product → ShoppingItem ──────────────────────────────────────────
function partnerToShoppingItem(p: PartnerProductRow, alteration: Alteration): ShoppingItem {
  const source: ShoppingSource = p.source_type === "secondhand" ? "secondhand" : "new";
  const trackUrl = `/api/track/${p.id}?dest=${encodeURIComponent(p.affiliate_url ?? p.product_url)}`;
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    detail: alteration.detail ?? alteration.element,
    priceMin: p.price ?? 0,
    priceMax: p.price ?? 0,
    source,
    merchants: [{ name: p.merchant, source, url: trackUrl }],
    imgUrl: p.primary_image_url,
    matchingSource: "partner",
    similarity: Math.round(p.similarity * 100) / 100,
    affiliateUrl: p.affiliate_url ?? undefined,
  };
}

// ── LBC item → ShoppingItem ──────────────────────────────────────────────────
function lbcToShoppingItem(item: LbcItem, alteration: Alteration, score: number): ShoppingItem {
  const trackUrl = `/api/track/lbc?dest=${encodeURIComponent(item.product_url)}`;
  return {
    id: `lbc-${item.id}`,
    name: item.title,
    category: alteration.category,
    detail: alteration.detail ?? alteration.element,
    priceMin: item.price,
    priceMax: item.price,
    source: "secondhand",
    merchants: [{ name: "Leboncoin", source: "secondhand", url: trackUrl }],
    imgUrl: item.image_url,
    matchingSource: "lbc",
    similarity: Math.round(score * 100) / 100,
    city: item.city,
    postedAt: item.posted_at,
  };
}

// ── Partner products query ───────────────────────────────────────────────────
async function queryPartnerProducts(
  category: CatalogCategory,
  targetEmbedding: number[],
): Promise<PartnerProductRow[]> {
  const supabase = createSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("match_partner_products", {
    query_embedding: targetEmbedding,
    match_category: category,
    match_count: 10,
  });
  if (error) {
    console.warn("[matcher] partner_products query failed:", error.message);
    return [];
  }
  return (data ?? []) as PartnerProductRow[];
}

function adjustPartnerScore(similarity: number, tier: string): number {
  if (tier === "strategic") return similarity * 1.1;
  if (tier === "discovery") return similarity * 0.95;
  return similarity;
}

// ── Hybrid matcher (α-10) ────────────────────────────────────────────────────
export async function matchAlterationsHybrid(
  alterations: Alteration[],
  styleId: string | null,
  _renderImageUrl?: string,
): Promise<ShoppingItem[]> {
  const toProcess = alterations.filter((a) => a.shoppingImpact !== "none");
  const results: ShoppingItem[] = [];

  await Promise.all(
    toProcess.map(async (alteration) => {
      const cat = normaliseCategory(alteration.category);
      const preferSecondhand = alteration.shoppingImpact === "to_buy_secondhand";

      // 1. Embedding texte du target (V1 — V1.5+ utilisera le crop bbox du rendu)
      const targetText = `${alteration.detail ?? alteration.element} ${styleId ?? ""}`.trim();
      let targetEmb: number[] | null = null;
      try {
        targetEmb = await withTracking("embedding", () => computeTextEmbedding(targetText), {
          element: alteration.element,
        });
      } catch (err) {
        console.warn("[matcher] Jina down, fallback mock catalog:", err);
        if (cat) {
          const p = findCandidateMock(cat, styleId, preferSecondhand);
          results.push(p ? catalogProductToShoppingItem(p, alteration) : unmatchedToShoppingItem(alteration));
        } else {
          results.push(unmatchedToShoppingItem(alteration));
        }
        return;
      }

      const lbcCat = getLbcCategory(cat ?? alteration.category);
      const styleKws = getStyleKeywords(styleId);

      // 2. Recherche parallèle LBC + partner_products
      const [lbcItems, partnerProducts] = await Promise.all([
        searchLbc({
          category: lbcCat,
          styleKeywords: styleKws,
          limit: 40,
        }).catch((err) => {
          console.warn("[matcher] LBC search failed:", err);
          return [] as LbcItem[];
        }),
        cat
          ? queryPartnerProducts(cat, targetEmb)
          : Promise.resolve([] as PartnerProductRow[]),
      ]);

      // 3. Score LBC items (score hybride amendment α-11/2)
      const scoredLbc = lbcItems
        .map((item) => ({ item, score: computeLbcHybridScore(item, targetEmb!) }))
        .filter(({ score }) => score >= LBC_THRESHOLD)
        .sort((a, b) => b.score - a.score);

      // 4. Score partner products avec ajustement tier
      const scoredPartner = partnerProducts
        .map((p) => ({ p, score: adjustPartnerScore(p.similarity, p.partner_tier) }))
        .sort((a, b) => b.score - a.score);

      // 5. Sélection : LBC prioritaire si score > seuil
      if (scoredLbc.length > 0 && (preferSecondhand || scoredLbc[0].score >= LBC_THRESHOLD)) {
        results.push(lbcToShoppingItem(scoredLbc[0].item, alteration, scoredLbc[0].score));
      } else if (scoredPartner.length > 0) {
        results.push(partnerToShoppingItem(scoredPartner[0].p, alteration));
      } else if (cat) {
        const p = findCandidateMock(cat, styleId, preferSecondhand);
        results.push(p ? catalogProductToShoppingItem(p, alteration) : unmatchedToShoppingItem(alteration));
      } else {
        results.push(unmatchedToShoppingItem(alteration));
      }
    }),
  );

  return results;
}

// ── Ancien matcher (catalogue statique) ─────────────────────────────────────
// Conservé pour rollback via USE_HYBRID_MATCHING=false
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
      const product = findCandidateMock(cat, styleId, preferSecondhand);
      return product ? catalogProductToShoppingItem(product, a) : unmatchedToShoppingItem(a);
    });
  // Fusionne les identiques en quantité (ex. plusieurs chaises ajoutées → ×N).
  return mergeShoppingItems(items);
}

// ── Eco advice ───────────────────────────────────────────────────────────────
const RSE_ADVICE: Partial<Record<CatalogCategory, string>> = {
  floor_material: "Alternative durable : béton ciré sur chape existante = moins de déchets de chantier.",
  paint: "Optez pour une peinture à l'eau labellisée NF Environnement — VOC réduits, moins de pollution intérieure.",
  mouldings: "Les moulures en MDF recyclé sont plus légères et génèrent moins de déchets que le bois massif.",
};

export function getEcoAdvice(category: CatalogCategory): string | null {
  return RSE_ADVICE[category] ?? null;
}

// ── Score Foyer (inchangé) ───────────────────────────────────────────────────
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
