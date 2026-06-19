/**
 * Matching NEUF : pour un item de la liste de courses, trouve les vrais produits
 * du catalogue (partner_products) les plus proches.
 *
 * Principe : jina-clip-v2 met texte ET image dans le même espace → on embed la
 * DESCRIPTION (texte) de l'item et on cosine-match contre les embeddings IMAGE des
 * produits, filtré par catégorie (RPC match_partner_products). Quasi-gratuit (les
 * embeddings produits sont pré-calculés ; 1 petit embedding texte + 1 requête).
 */
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { computeTextEmbedding } from "@/lib/embeddings/jina";
import type { ProductMatch } from "@/lib/types";

export async function matchPartnerProducts(
  category: string,
  description: string,
  topN = 4,
): Promise<ProductMatch[]> {
  if (!category || !description?.trim()) return [];

  let emb: number[];
  try {
    emb = await computeTextEmbedding(description);
  } catch (e) {
    console.warn("[partnerMatch] embedding texte échoué:", e instanceof Error ? e.message : e);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAdmin() as any;
  const { data, error } = await supabase.rpc("match_partner_products", {
    query_embedding: emb,
    match_category: category,
    match_count: topN,
  });
  if (error) {
    console.warn("[partnerMatch] RPC échoué:", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    merchant: r.merchant,
    source_type: r.source_type,
    price: r.price != null ? Number(r.price) : null,
    primary_image_url: r.primary_image_url ?? null,
    product_url: r.product_url ?? null,
    similarity: Math.round(Number(r.similarity) * 1000) / 1000,
  }));
}

/** Enrichit une liste d'items avec leurs produits matchés (en parallèle). */
export async function attachMatches<T extends { category: string; name: string; detail?: string }>(
  items: T[],
): Promise<(T & { matches: ProductMatch[] })[]> {
  return Promise.all(
    items.map(async (it) => ({
      ...it,
      matches: await matchPartnerProducts(it.category, `${it.name} ${it.detail ?? ""}`.trim()),
    })),
  );
}
