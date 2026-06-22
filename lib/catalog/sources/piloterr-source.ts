/**
 * PiloterrSource — source de TEST du jeu de données catalog. Implémente ProductSource.
 *
 * Conventions Piloterr (vérifiées live) : auth `x-api-key`.
 *  - Cdiscount : search = URL `cdiscount.com/search/10/<kw>.html?page=N` (pagination
 *    dans l'URL, ~63/page). Pas de note/avis dans le search → produit (2e appel) pour
 *    image + specs + reviews. Sélection : pertinence + prix + dédup + diversité couleur.
 *  - IKEA : search = URL `ikea.com/fr/fr/search/?q=<kw>&page=N` (24/page) AVEC image +
 *    rating + reviews_count → 1-step (pas de 2e appel), sélection best-seller possible.
 *  - Leroy Merlin : search = mot-clé (~6/réponse) → produit (image + features). Sert
 *    aux FOURNITURES (peinture V33 acrylique, moulures, tasseaux) par expansion de
 *    mots-clés (catalogue LM peu profond par requête).
 *
 * La source de PROD = flux Awin (cf. awin-source.ts), même interface ProductSource.
 * ⚠️ Code de test (flag SEED_SCRAPE_ENABLED).
 */
import type { ProductSource, PartnerProductInput } from "../types";
import { selectCandidates, type Candidate } from "../select";

const PILOTERR_BASE = "https://api.piloterr.com";

export type PiloterrMerchant = "cdiscount" | "ikea" | "leroy_merlin";

// Mobilier + luminaire → mot-clé de recherche (Cdiscount & IKEA).
const FURNITURE_KEYWORDS: Record<string, string> = {
  sofa: "canapé", armchair: "fauteuil", coffee_table: "table basse",
  side_table: "table d'appoint", tv_stand: "meuble tv", sideboard: "buffet",
  bookshelf: "bibliothèque", dining_table: "table à manger", chair: "chaise",
  rug: "tapis", floor_lamp: "lampadaire salon", dresser: "commode",
};

// Leroy Merlin — expansion de mots-clés (catalogue peu profond/requête). Mobilier +
// fournitures + revêtements de sol. "Vendu par LM" : on garde le catalogue LM (ARTENS
// & co.), on exclut juste le hors-sujet (nettoyants, accessoires de pose…).
const LM_KEYWORDS: Record<string, string[]> = {
  // mobilier (LM peu profond → on multiplie les angles pour plus de réfs distinctes)
  sofa: ["canapé", "canapé d'angle", "canapé convertible", "canapé 3 places", "canapé 2 places", "canapé velours", "canapé tissu", "canapé scandinave", "banquette"],
  armchair: ["fauteuil", "fauteuil scandinave", "fauteuil velours", "fauteuil cuir", "fauteuil crapaud", "fauteuil bergère", "fauteuil relax", "fauteuil œuf"],
  coffee_table: ["table basse", "table basse bois", "table basse relevable", "table basse ronde", "table basse marbre", "table basse gigogne", "table basse industrielle"],
  side_table: ["table d'appoint", "bout de canapé", "table d'appoint ronde", "guéridon", "sellette"],
  tv_stand: ["meuble tv", "banc tv", "meuble tv bois", "meuble tv scandinave"],
  sideboard: ["buffet", "enfilade", "bahut", "buffet bois", "buffet scandinave", "vaisselier"],
  bookshelf: ["bibliothèque", "étagère bois", "étagère murale", "étagère échelle", "meuble de rangement", "cube de rangement"],
  dining_table: ["table à manger", "table de salle à manger", "table repas", "table extensible", "table ronde", "table bois massif"],
  chair: ["chaise", "chaise scandinave", "lot de chaises", "chaise velours", "chaise bois", "tabouret", "chaise de bar"],
  rug: ["tapis", "tapis salon", "tapis berbère", "tapis laine", "tapis poils longs", "tapis scandinave", "tapis jute"],
  floor_lamp: ["lampadaire", "lampadaire salon", "lampadaire trépied", "lampadaire arc", "liseuse"],
  dresser: ["commode", "commode bois", "commode scandinave", "chiffonnier", "commode blanche"],
  // fournitures — peinture MURALE couleur intérieur (pas "meuble")
  paint: [
    "peinture salon couleur", "peinture chambre couleur", "peinture mur couleur intérieur",
    // neutres
    "peinture mur beige", "peinture mur greige", "peinture mur taupe", "peinture mur lin",
    "peinture mur gris", "peinture mur gris clair", "peinture mur anthracite", "peinture mur noir",
    // chauds
    "peinture mur terracotta", "peinture mur ocre", "peinture mur jaune", "peinture mur moutarde",
    "peinture mur orange", "peinture mur rouge", "peinture mur bordeaux", "peinture mur brique",
    "peinture mur rose", "peinture mur vieux rose", "peinture mur corail", "peinture mur brun",
    // froids
    "peinture mur bleu", "peinture mur bleu marine", "peinture mur bleu canard", "peinture mur bleu nuit",
    "peinture mur bleu gris", "peinture mur vert", "peinture mur vert sauge", "peinture mur vert kaki",
    "peinture mur vert d'eau", "peinture mur olive", "peinture mur turquoise", "peinture mur émeraude",
    // violets
    "peinture mur violet", "peinture mur mauve", "peinture mur prune", "peinture mur parme", "peinture mur lavande",
    // gamme LUXENS (forme "Luxens X" = la plus efficace pour les teintes vives)
    "Luxens jaune", "Luxens moutarde", "Luxens safran", "Luxens banana",
    "Luxens aubergine", "Luxens cassis", "Luxens figue", "Luxens raisin", "Luxens myrtille",
    "Luxens prune", "Luxens lie de vin", "Luxens lilas", "Luxens parme", "Luxens violet",
  ],
  mouldings: ["moulure décorative", "moulure polyuréthane", "cimaise murale", "corniche décorative", "rosace plafond"],
  batten: ["tasseau sapin", "tasseau chêne", "tasseau bois raboté", "tasseau pin", "liteau bois", "tasseau douglas"],
  // revêtements de sol (parquet stratifié, béton ciré, carrelage, pvc…)
  floor: [
    "sol stratifié ARTENS", "parquet stratifié chêne", "sol stratifié",
    "kit béton ciré sol", "béton ciré sol",
    "carrelage sol aspect bois", "carrelage sol aspect béton", "carrelage intérieur ARTENS",
    "lame pvc clipsable", "sol pvc",
  ],
};

// Filtres par catégorie : exclusion (hors-sujet) + inclusion (terme attendu).
// N'exclure QUE la peinture métal/extérieur. PAS "radiateur"/"sol" : les peintures
// murales intérieures listent souvent "mur, boiserie, radiateur" comme surfaces.
const PAINT_EXCLUDE = /m[ée]tal|\bfer\b|portail|grille|ext[ée]rieur|garde.?corps|fa[çc]ade/i;
const FLOOR_INCLUDE = /stratifi|parquet|carrelage|b[ée]ton cir|lame pvc|sol pvc|vinyle|dalle|moquette/i;
const FLOOR_EXCLUDE = /nettoyant|protecteur|\bjoint|\bcolle|plinthe|seuil|sous.?couche|profil|d[ée]capant|entretien|raccord|quart de rond|\bspatule|\btruelle/i;
const LM_FILTERS: Record<string, { include?: RegExp; exclude?: RegExp }> = {
  paint: { exclude: PAINT_EXCLUDE },
  floor: { include: FLOOR_INCLUDE, exclude: FLOOR_EXCLUDE },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Les images LM (media.adeo.com) sont en pleine résolution (~5-6 Mo) → Jina échoue à
// les charger ("Failed to load image"). On demande une version redimensionnée (~800px).
function adeoResize(url: string): string {
  return url.includes("media.adeo.com") && !url.includes("?") ? `${url}?width=800` : url;
}

function apiKey(): string {
  const k = process.env.PILOTERR_API_KEY;
  if (!k) throw new Error("PILOTERR_API_KEY manquante");
  return k;
}

async function piloterrGet(path: string, query: string): Promise<unknown> {
  const url = new URL(`${PILOTERR_BASE}${path}`);
  url.searchParams.set("query", query);
  let lastErr: unknown;
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

// ── Cdiscount ────────────────────────────────────────────────────────────────
async function fetchCdiscountCandidates(category: string, maxPages: number): Promise<Candidate[]> {
  const kw = FURNITURE_KEYWORDS[category];
  if (!kw) return [];
  const out: Candidate[] = [];
  for (let pg = 1; pg <= maxPages; pg++) {
    const searchUrl = `https://www.cdiscount.com/search/10/${encodeURIComponent(kw)}.html?page=${pg}`;
    let json: { results?: unknown[]; pagination?: { has_next_page?: boolean } };
    try {
      json = (await piloterrGet("/v2/cdiscount/search", searchUrl)) as typeof json;
    } catch (e) {
      console.warn(`[cdiscount] search ${category} p${pg}:`, e instanceof Error ? e.message : e);
      break;
    }
    const results = (json.results ?? []) as Array<Record<string, unknown>>;
    if (results.length === 0) break;
    for (const r of results) {
      const images = r.images as string[] | undefined;
      out.push({
        external_id: String(r.id ?? ""),
        url: String(r.url ?? ""),
        title: String(r.title ?? ""),
        price: r.price != null ? Number(r.price) : null,
        image: images?.[0] ?? (r.image as string | undefined) ?? null,
        is_sponsored: !!r.is_sponsored,
        seller: (r.seller as { name?: string } | undefined)?.name ?? null,
      });
    }
    if (!json.pagination?.has_next_page) break;
    await sleep(300);
  }
  return out;
}

async function detailCdiscount(c: Candidate, category: string): Promise<PartnerProductInput | null> {
  let d: {
    images?: string[]; brand?: string; description?: string; specifications?: Record<string, unknown>;
    rating?: number | string; reviews_count?: number | string; condition?: string;
    ean?: string; original_price?: number | string; seller?: { name?: string };
  };
  try {
    d = (await piloterrGet("/v2/cdiscount/product", c.url)) as typeof d;
  } catch (e) {
    console.warn(`[cdiscount] product ${c.external_id}:`, e instanceof Error ? e.message : e);
    return null;
  }
  const imgs = (d.images?.length ? d.images : c.image ? [c.image] : []).filter(Boolean) as string[];
  if (imgs.length === 0) return null;
  return {
    merchant: "cdiscount",
    external_id: c.external_id,
    category,
    name: (c.title || "").slice(0, 255),
    price: c.price,
    currency: "EUR",
    product_url: c.url,
    image_urls: imgs,
    primary_image_url: imgs[0],
    source_type: "eco_new",
    description: d.description?.slice(0, 2000),
    attributes: {
      brand: d.brand, specifications: d.specifications, rating: d.rating,
      reviews_count: d.reviews_count, condition: d.condition, ean: d.ean,
      original_price: d.original_price, seller: d.seller?.name,
    },
  };
}

// ── IKEA (1-step : image + rating + reviews dans le search) ───────────────────
async function fetchIkeaCandidates(category: string, maxPages: number): Promise<Candidate[]> {
  const kw = FURNITURE_KEYWORDS[category];
  if (!kw) return [];
  const out: Candidate[] = [];
  for (let pg = 1; pg <= maxPages; pg++) {
    const url = `https://www.ikea.com/fr/fr/search/?q=${encodeURIComponent(kw)}&page=${pg}`;
    let json: { results?: unknown[]; pagination?: { has_next_page?: boolean } };
    try {
      json = (await piloterrGet("/v2/ikea/search", url)) as typeof json;
    } catch (e) {
      console.warn(`[ikea] search ${category} p${pg}:`, e instanceof Error ? e.message : e);
      break;
    }
    const results = (json.results ?? []) as Array<Record<string, unknown>>;
    if (results.length === 0) break;
    for (const r of results) {
      if (!r.id || !r.url || !r.image) continue;
      out.push({
        external_id: String(r.id),
        url: String(r.url),
        title: [r.title, r.subtitle].filter(Boolean).join(" "),
        price: r.price_amount != null ? Number(r.price_amount) : null,
        image: r.image as string,
        rating: r.rating != null ? Number(r.rating) : null,
        reviews_count: r.reviews_count != null ? Number(r.reviews_count) : null,
        seller: "IKEA",
      });
    }
    if (!json.pagination?.has_next_page) break;
    await sleep(300);
  }
  return out;
}

// Couleurs de base pour dédupliquer les variantes (1 entrée par couleur distincte).
const IKEA_COLOR_WORDS = [
  "blanc", "noir", "gris", "anthracite", "beige", "taupe", "écru", "crème", "marron",
  "bleu", "vert", "olive", "kaki", "rose", "rouge", "jaune", "orange", "terracotta",
  "moutarde", "chêne", "naturel", "noyer", "bouleau", "doré",
];
function baseColor(name: string): string {
  const t = name.toLowerCase();
  return IKEA_COLOR_WORDS.find((c) => t.includes(c)) ?? t.trim();
}

// Éclate une réf IKEA en 1 entrée PAR COULEUR (image + couleur propres), plafonné.
// 1 appel produit → toutes les variantes (image+couleur) → N entrées couleur-aware.
async function detailIkeaVariants(c: Candidate, category: string, maxVariants: number): Promise<PartnerProductInput[]> {
  let d: {
    images?: string[]; image?: string; description?: string; dimensions?: Record<string, unknown>;
    category?: string; price_amount?: number | string;
    variants?: Array<{ id?: string | number; name?: string; image?: string; url?: string }>;
  };
  try {
    d = (await piloterrGet("/v2/ikea/product", c.url)) as typeof d;
  } catch (e) {
    console.warn(`[ikea] product ${c.external_id}:`, e instanceof Error ? e.message : e);
    return [];
  }
  const model = c.title.trim(); // ex. "POÄNG Fauteuil" (modèle + type, sans couleur)
  const fallbackImg = d.images?.[0] ?? c.image ?? null;
  const variants = d.variants?.length
    ? d.variants
    : [{ id: c.external_id, name: "", image: fallbackImg ?? undefined, url: c.url }];

  const out: PartnerProductInput[] = [];
  const seenColors = new Set<string>();
  for (const v of variants) {
    if (out.length >= maxVariants) break;
    const img = v.image ?? fallbackImg;
    if (!v.id || !img) continue;
    const colorLabel = (v.name ?? "").trim();
    const col = baseColor(colorLabel);
    if (seenColors.has(col)) continue; // 1 entrée par couleur distincte
    seenColors.add(col);
    out.push({
      merchant: "ikea",
      external_id: String(v.id),
      category,
      name: `${model} ${colorLabel}`.trim().slice(0, 255),
      price: c.price ?? (d.price_amount != null ? Number(d.price_amount) : null),
      currency: "EUR",
      product_url: v.url ?? c.url,
      image_urls: [img],
      primary_image_url: img,
      source_type: "eco_new",
      description: `${colorLabel}. ${d.description ?? ""}`.trim().slice(0, 2000),
      attributes: {
        brand: "IKEA", color: colorLabel || null, model,
        dimensions: d.dimensions, ikea_category: d.category,
        rating: c.rating, reviews_count: c.reviews_count,
      },
    });
  }
  return out;
}

export class PiloterrSource implements ProductSource {
  constructor(public readonly merchant: PiloterrMerchant) {}

  // STREAM : yield chaque produit dès qu'il est prêt (l'ingestion l'insère aussitôt).
  fetchProducts(category: string, limit: number): AsyncIterable<PartnerProductInput> {
    if (this.merchant === "cdiscount") return this.fetchCdiscount(category, limit);
    if (this.merchant === "ikea") return this.fetchIkea(category, limit);
    return this.fetchLeroyMerlin(category, limit);
  }

  private async *fetchCdiscount(category: string, limit: number): AsyncGenerator<PartnerProductInput> {
    const cands = await fetchCdiscountCandidates(category, Math.ceil(limit / 45) + 2);
    const selected = selectCandidates(cands, category, limit);
    for (const c of selected) {
      await sleep(1100); // throttle 2e appel
      const d = await detailCdiscount(c, category);
      if (d) yield d;
    }
  }

  private async *fetchIkea(category: string, limit: number): AsyncGenerator<PartnerProductInput> {
    const cands = await fetchIkeaCandidates(category, Math.ceil(limit / 24) + 1);
    // Le search IKEA est déjà ciblé (libellés type "Siège pivotant" ≠ "fauteuil") → relevance off.
    const refs = selectCandidates(cands, category, limit, { relevance: false });
    let count = 0;
    for (const c of refs) {
      if (count >= limit) break;
      await sleep(1100); // throttle 2e appel (1 appel → toutes les variantes couleur)
      const entries = await detailIkeaVariants(c, category, 4); // ≤4 couleurs/réf
      for (const e of entries) {
        if (count >= limit) break;
        yield e;
        count++;
      }
    }
  }

  private async *fetchLeroyMerlin(category: string, limit: number): AsyncGenerator<PartnerProductInput> {
    const keywords = LM_KEYWORDS[category];
    if (!keywords) return;
    const filter = LM_FILTERS[category];
    const seen = new Set<string>();
    let count = 0;
    for (const kw of keywords) {
      if (count >= limit) break;
      let json: { results?: unknown[] };
      try {
        json = (await piloterrGet("/v2/leroymerlin/search", kw)) as typeof json;
      } catch {
        continue;
      }
      const results = (json.results ?? []) as Array<{ sku?: string; url?: string; title?: string; price?: number }>;
      for (const r of results) {
        if (count >= limit) break;
        if (!r.sku || !r.url || seen.has(r.sku)) continue;
        const title = r.title ?? "";
        if (filter?.exclude?.test(title)) continue; // hors-sujet (peinture métal, nettoyants sol…)
        if (filter?.include && !filter.include.test(title)) continue; // doit être un vrai produit de la catégorie
        seen.add(r.sku);
        try {
          await sleep(1100);
          const d = (await piloterrGet("/v2/leroymerlin/product", r.url)) as {
            images?: string[]; brand?: string; description?: string; features?: Record<string, unknown>;
          };
          const imgs = (d.images ?? []).filter(Boolean).map(adeoResize);
          if (imgs.length === 0) continue;
          yield {
            merchant: "leroy_merlin",
            external_id: r.sku,
            category,
            name: (r.title ?? "").slice(0, 255),
            price: r.price != null ? Number(r.price) : null,
            currency: "EUR",
            product_url: r.url,
            image_urls: imgs,
            primary_image_url: imgs[0],
            source_type: "eco_new",
            description: d.description?.slice(0, 2000),
            attributes: { brand: d.brand, features: d.features },
          };
          count++;
        } catch {
          continue;
        }
      }
    }
  }
}
