/**
 * Matching NEUF : pour un item de la liste de courses, trouve les vrais produits
 * du catalogue (partner_products) les plus proches.
 *
 * Principe : jina-clip-v2 met texte ET image dans le même espace → on embed la
 * DESCRIPTION (texte) de l'item (la "requête") et on cosine-match contre les
 * embeddings IMAGE des produits, filtré par catégorie (RPC match_partner_products).
 * Les embeddings PRODUITS sont pré-calculés (import) ; on n'embed à la volée QUE la
 * requête. La version batch fait UN seul appel Jina pour toute la liste.
 */
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { computeTextEmbedding, computeBatchTextEmbeddings } from "@/lib/embeddings/jina";
import { MATCH_BLEND_ALPHA, MATCH_MIN_SIMILARITY } from "@/lib/constants";
import type { ProductMatch } from "@/lib/types";

// Catégorie d'item → catégorie catalogue. null = non-shoppable (pas de match).
const CATEGORY_ALIASES: Record<string, string> = {
  dining_chair: "chair",
};
const NON_SHOPPABLE = new Set([
  // architecture / non-produit (floor EST shoppable → revêtements de sol LM)
  "wall", "ceiling", "window", "door", "french_door", "wall_opening",
  "frame", "mirror", "plant", "decor_object", "other",
  // pas (encore) dans le catalogue
  "ceiling_light", "table_lamp", "lamp",
]);

function catalogCategory(cat: string): string | null {
  if (!cat || NON_SHOPPABLE.has(cat)) return null;
  return CATEGORY_ALIASES[cat] ?? cat;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): ProductMatch {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    merchant: r.merchant,
    source_type: r.source_type,
    price: r.price != null ? Number(r.price) : null,
    primary_image_url: r.primary_image_url ?? null,
    product_url: r.product_url ?? null,
    similarity: Math.round(Number(r.similarity) * 1000) / 1000,
  };
}

async function rpcMatch(embedding: number[], category: string, topN: number): Promise<ProductMatch[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAdmin() as any;
  const { data, error } = await supabase.rpc("match_partner_products_hybrid", {
    query_embedding: embedding,
    match_category: category,
    match_count: topN,
    alpha: MATCH_BLEND_ALPHA,
  });
  if (error) {
    console.warn("[partnerMatch] RPC échoué:", error.message);
    return [];
  }
  return (data ?? [])
    .map(mapRow)
    .filter((m: ProductMatch) => m.similarity >= MATCH_MIN_SIMILARITY);
}

export async function matchPartnerProducts(category: string, description: string, topN = 4): Promise<ProductMatch[]> {
  const cat = catalogCategory(category);
  if (!cat || !description?.trim()) return [];
  let emb: number[];
  try {
    emb = await computeTextEmbedding(description);
  } catch (e) {
    console.warn("[partnerMatch] embedding échoué:", e instanceof Error ? e.message : e);
    return [];
  }
  return rpcMatch(emb, cat, topN);
}

// Familles de matériau de sol : on ne propose pas un carrelage pour un parquet bois.
// Le `product` filtre sur le TYPE de revêtement (parquet/stratifié, carrelage…), PAS la
// matière imitée : un "Carrelage effet bois chêne" contient "bois/chêne" mais reste du
// carrelage → il ne doit PAS passer le filtre bois.
const FLOOR_MATERIALS: Array<{ render: RegExp; product: RegExp }> = [
  { render: /parquet|\bbois\b|stratifi|ch[êe]ne|chevron|noyer|teck|point de hongrie/i,
    product: /parquet|stratifi|plancher|bois massif|lame.{0,14}bois/i },
  { render: /carrelage|c[ée]ramique|gr[èe]s|c[ée]rame|fa[ïi]ence|tomette/i,
    product: /carrelage|c[ée]ramique|gr[èe]s|c[ée]rame|tomette/i },
  { render: /b[ée]ton|cir[ée]|r[ée]sine/i, product: /b[ée]ton|cir[ée]|r[ée]sine/i },
  { render: /\bpvc\b|vinyle|lino/i, product: /\bpvc\b|vinyle|lino|lame.{0,14}pvc/i },
];

// SOL : cosine MAIS filtré par famille de matériau (le texte→image seul confond
// "parquet bois" et "carrelage effet bois"). On prend un large pool cosine puis on
// garde le bon matériau (parquet/bois → sols bois, pas carrelage).
export async function matchFloorProducts(description: string, topN = 4): Promise<ProductMatch[]> {
  const pool = await matchPartnerProducts("floor", description, 24);
  if (pool.length === 0) return [];
  const mat = FLOOR_MATERIALS.find((m) => m.render.test(description));
  if (!mat) return pool.slice(0, topN);
  const sameMat = pool.filter((p) => mat.product.test(p.name));
  return (sameMat.length > 0 ? sameMat : pool).slice(0, topN);
}

/** Batch : UN seul appel Jina (toutes les descriptions shoppables), puis RPC en parallèle. */
export async function matchPartnerProductsBatch(
  items: { category: string; description: string }[],
  topN = 4,
): Promise<ProductMatch[][]> {
  const cats = items.map((it) => catalogCategory(it.category));
  const toEmbed = items
    .map((it, i) => ({ i, text: it.description?.trim() ?? "" }))
    .filter((x) => cats[x.i] && x.text);

  if (toEmbed.length === 0) return items.map(() => []);

  let embs: number[][];
  try {
    embs = await computeBatchTextEmbeddings(toEmbed.map((x) => x.text));
  } catch (e) {
    console.warn("[partnerMatch] batch embedding échoué:", e instanceof Error ? e.message : e);
    return items.map(() => []);
  }
  const embByIdx = new Map<number, number[]>();
  toEmbed.forEach((x, k) => embByIdx.set(x.i, embs[k]));

  return Promise.all(
    items.map(async (_it, i) => {
      const cat = cats[i];
      const emb = embByIdx.get(i);
      return cat && emb ? rpcMatch(emb, cat, topN) : [];
    }),
  );
}
