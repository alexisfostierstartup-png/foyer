/**
 * PiloterrSource — source de TEST (JETABLE) pour constituer le jeu de données catalog.
 * Implémente ProductSource via les scrapers Piloterr.
 *
 * Conventions VÉRIFIÉES en live (juin 2026) :
 *  - Auth = header `x-api-key` (PAS `Authorization: Bearer` — sinon la clé est
 *    silencieusement ignorée et l'appel casse en 500/403 trompeurs).
 *  - Cdiscount : GET /v2/cdiscount/search?query=<URL de recherche Cdiscount COMPLÈTE>
 *    → results[] {id, url, image, images[], price, title}. 1 appel, images incluses.
 *    Couvre tout le meuble.
 *  - Leroy Merlin : GET /v2/leroymerlin/search?query=<mot-clé> → results[] {sku, url,
 *    title, price} SANS image → 2e appel GET /v2/leroymerlin/product?query=<url>
 *    → {images[]}. Couvre seulement un sous-ensemble (déco/rangement).
 *
 * La source de PROD = les flux d'affiliation Awin (cf. awin-source.ts), qui
 * implémentera la MÊME interface : l'ingestion n'en dépend pas.
 *
 * ⚠️ Code de test. Ne tourne JAMAIS en cron/prod (cf. flag SEED_SCRAPE_ENABLED
 * dans scripts/seed-test-catalog.ts).
 */
import type { ProductSource, PartnerProductInput } from "../types";

const PILOTERR_BASE = "https://api.piloterr.com";

export type PiloterrMerchant = "cdiscount" | "leroy_merlin" | "ikea";

// Catégorie Foyer → mot-clé de recherche, par marchand.
const CDISCOUNT_KEYWORDS: Record<string, string> = {
  sofa: "canapé", armchair: "fauteuil", coffee_table: "table basse",
  side_table: "table d'appoint", tv_stand: "meuble tv", sideboard: "buffet",
  bookshelf: "bibliothèque", dining_table: "table à manger", chair: "chaise",
  // "lampadaire" seul renvoie du junk (livres/DVD en "…aire") → terme plus précis.
  rug: "tapis", floor_lamp: "lampadaire salon", dresser: "commode",
};
const LEROYMERLIN_KEYWORDS: Record<string, string> = {
  rug: "tapis", floor_lamp: "lampadaire", dresser: "commode",
  bookshelf: "étagère", side_table: "table d'appoint", chair: "chaise",
  // Fournitures DIY — le vrai fort de Leroy Merlin.
  // ("peinture murale" renvoyait de la peinture métal/portail → "peinture mur intérieur".)
  paint: "peinture mur intérieur", mouldings: "moulure décorative", batten: "tasseau bois",
};

// IKEA : query = URL de recherche IKEA (comme Cdiscount). Search renvoie déjà l'image.
const IKEA_KEYWORDS: Record<string, string> = {
  sofa: "canapé", armchair: "fauteuil", coffee_table: "table basse",
  side_table: "table d'appoint", tv_stand: "meuble tv", sideboard: "buffet",
  bookshelf: "bibliothèque", dining_table: "table à manger", chair: "chaise",
  rug: "tapis", floor_lamp: "lampadaire", dresser: "commode",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function apiKey(): string {
  const k = process.env.PILOTERR_API_KEY;
  if (!k) throw new Error("PILOTERR_API_KEY manquante");
  return k;
}

async function piloterrGet(path: string, query: string): Promise<unknown> {
  const url = new URL(`${PILOTERR_BASE}${path}`);
  url.searchParams.set("query", query);
  let lastErr: unknown;
  // Retry sur erreur RÉSEAU ("fetch failed") ou 5xx (transitoire). 4xx = définitif.
  for (let attempt = 0; attempt < 4; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { headers: { "x-api-key": apiKey() } });
    } catch (e) {
      lastErr = e;
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (res.ok) return await res.json();
    if (res.status < 500) {
      const body = await res.text().catch(() => "");
      throw new Error(`Piloterr ${path} → ${res.status} ${body.slice(0, 160)}`);
    }
    lastErr = new Error(`Piloterr ${path} → ${res.status}`);
    await sleep(2000 * (attempt + 1));
  }
  throw lastErr instanceof Error ? lastErr : new Error(`Piloterr ${path}: échec après retries`);
}

export class PiloterrSource implements ProductSource {
  constructor(public readonly merchant: PiloterrMerchant) {}

  async fetchProducts(category: string, limit: number): Promise<PartnerProductInput[]> {
    if (this.merchant === "cdiscount") return this.fetchCdiscount(category, limit);
    if (this.merchant === "ikea") return this.fetchIkea(category, limit);
    return this.fetchLeroyMerlin(category, limit);
  }

  private async fetchIkea(category: string, limit: number): Promise<PartnerProductInput[]> {
    const kw = IKEA_KEYWORDS[category];
    if (!kw) return [];
    const searchUrl = `https://www.ikea.com/fr/fr/search/?q=${encodeURIComponent(kw)}`;
    const json = (await piloterrGet("/v2/ikea/search", searchUrl)) as {
      results?: Array<{
        id?: string; url?: string; image?: string; title?: string; subtitle?: string;
        price_amount?: number | string; rating?: number | string; reviews_count?: number | string;
      }>;
    };
    return (json.results ?? [])
      .filter((r) => r.id && r.url && r.image)
      .slice(0, limit)
      .map((r) => ({
        merchant: "ikea",
        external_id: r.id!,
        category,
        name: [r.title, r.subtitle].filter(Boolean).join(" ").slice(0, 255),
        price: r.price_amount != null ? Number(r.price_amount) : null,
        currency: "EUR",
        product_url: r.url!,
        image_urls: [r.image!],
        primary_image_url: r.image!,
        source_type: "eco_new",
        // IKEA search ne donne pas les specs structurées (il faudrait /ikea/product).
        attributes: { subtitle: r.subtitle, rating: r.rating, reviews_count: r.reviews_count },
      }));
  }

  private async fetchCdiscount(category: string, limit: number): Promise<PartnerProductInput[]> {
    const kw = CDISCOUNT_KEYWORDS[category];
    if (!kw) return [];
    // query Cdiscount = URL de recherche complète (cf. doc Piloterr).
    const searchUrl = `https://www.cdiscount.com/search/10/${encodeURIComponent(kw)}.html`;
    const json = (await piloterrGet("/v2/cdiscount/search", searchUrl)) as {
      results?: Array<{ id?: string; url?: string; title?: string; price?: number | string; image?: string; images?: string[] }>;
    };
    const base = (json.results ?? []).filter((r) => r.id && r.url).slice(0, limit);
    const out: PartnerProductInput[] = [];
    // 2e appel `product` pour les caractéristiques STRUCTURÉES (couleur, matière,
    // dimensions… via `specifications`) — essentielles au matching visuel au rendu.
    for (const r of base) {
      try {
        await sleep(1100); // throttle ≥1 req/s
        const d = (await piloterrGet("/v2/cdiscount/product", r.url!)) as {
          images?: string[]; brand?: string; description?: string;
          specifications?: Record<string, unknown>; condition?: string;
          ean?: string; original_price?: number | string; seller?: { name?: string };
        };
        const imgs = (d.images?.length ? d.images : r.images?.length ? r.images : r.image ? [r.image] : []).filter(Boolean) as string[];
        if (imgs.length === 0) continue;
        out.push({
          merchant: "cdiscount",
          external_id: r.id!,
          category,
          name: (r.title ?? "").slice(0, 255),
          price: r.price != null ? Number(r.price) : null,
          currency: "EUR",
          product_url: r.url!,
          image_urls: imgs,
          primary_image_url: imgs[0],
          source_type: "eco_new",
          description: d.description?.slice(0, 2000),
          attributes: {
            brand: d.brand,
            specifications: d.specifications,
            condition: d.condition,
            ean: d.ean,
            original_price: d.original_price,
            seller: d.seller?.name,
          },
        });
      } catch (e) {
        console.warn(`[piloterr:cdiscount] product ${r.id} échec:`, e instanceof Error ? e.message : e);
      }
    }
    return out;
  }

  private async fetchLeroyMerlin(category: string, limit: number): Promise<PartnerProductInput[]> {
    const kw = LEROYMERLIN_KEYWORDS[category];
    if (!kw) return [];
    const json = (await piloterrGet("/v2/leroymerlin/search", kw)) as {
      results?: Array<{ sku?: string; url?: string; title?: string; price?: number }>;
    };
    const base = (json.results ?? []).filter((r) => r.sku && r.url).slice(0, limit);
    const out: PartnerProductInput[] = [];
    // 2e appel `product` pour récupérer l'image (search LM n'en renvoie pas).
    for (const r of base) {
      try {
        await sleep(1100); // throttle ≥1 req/s
        const detail = (await piloterrGet("/v2/leroymerlin/product", r.url!)) as {
          images?: string[]; brand?: string; description?: string; features?: Record<string, unknown>;
        };
        const imgs = (detail.images ?? []).filter(Boolean);
        if (imgs.length === 0) continue; // pas d'image → inutile pour l'embedding
        out.push({
          merchant: "leroy_merlin",
          external_id: r.sku!,
          category,
          name: (r.title ?? "").slice(0, 255),
          price: r.price != null ? Number(r.price) : null,
          currency: "EUR",
          product_url: r.url!,
          image_urls: imgs,
          primary_image_url: imgs[0],
          source_type: "eco_new",
          description: detail.description?.slice(0, 2000),
          // LM expose des features STRUCTURÉES (dimensions, etc.) + la marque.
          attributes: { brand: detail.brand, features: detail.features },
        });
      } catch (e) {
        console.warn(`[piloterr:leroymerlin] product ${r.sku} échec:`, e instanceof Error ? e.message : e);
      }
    }
    return out;
  }
}
