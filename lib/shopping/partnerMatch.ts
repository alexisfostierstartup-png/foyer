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
import type { ProductMatch } from "@/lib/types";

// Catégorie d'item → catégorie catalogue. null = non-shoppable (pas de match).
const CATEGORY_ALIASES: Record<string, string> = {
  dining_chair: "chair",
};
const NON_SHOPPABLE = new Set([
  // architecture / non-produit
  "floor", "wall", "ceiling", "window", "door", "french_door", "wall_opening",
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
  const { data, error } = await supabase.rpc("match_partner_products", {
    query_embedding: embedding,
    match_category: category,
    match_count: topN,
  });
  if (error) {
    console.warn("[partnerMatch] RPC échoué:", error.message);
    return [];
  }
  return (data ?? []).map(mapRow);
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
