import { createSupabaseAdmin } from "@/lib/supabase/server";
import {
  computeBatchImageEmbeddings,
  computeBatchTextEmbeddings,
  cosineSimilarity,
} from "@/lib/embeddings/jina";
import { withTracking } from "@/lib/tracking";

export type LbcSearchParams = {
  category: string;
  styleKeywords?: string[];
  city?: string;
  radius_km?: number;
  max_price?: number;
  limit?: number;
};

export type LbcItem = {
  id: string;
  title: string;
  description?: string;
  price: number;
  city: string;
  distance_km?: number;
  image_url: string;
  product_url: string;
  posted_at: string;
  image_embedding?: number[];
  text_embedding?: number[];
};

const CACHE_TTL_MS = 10 * 60 * 1000;

async function buildHash(params: LbcSearchParams): Promise<string> {
  const canonical = JSON.stringify({
    category: params.category,
    styleKeywords: (params.styleKeywords ?? []).slice().sort(),
    city: params.city ?? "Paris",
    radius_km: params.radius_km ?? 100,
    max_price: params.max_price ?? null,
    limit: params.limit ?? 40,
  });
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

async function checkCache(hash: string): Promise<LbcItem[] | null> {
  const supabase = createSupabaseAdmin();
  const cutoff = new Date(Date.now() - CACHE_TTL_MS).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("lbc_search_cache")
    .select("results, fetched_at")
    .eq("filters_hash", hash)
    .gte("fetched_at", cutoff)
    .single();
  if (!data) return null;
  return data.results as LbcItem[];
}

async function saveCache(hash: string, params: LbcSearchParams, items: LbcItem[]): Promise<void> {
  const supabase = createSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("lbc_search_cache").upsert(
    {
      category: params.category,
      filters: params,
      filters_hash: hash,
      results: items,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "filters_hash" },
  );
}

async function fetchFromPiloterr(params: LbcSearchParams): Promise<LbcItem[]> {
  const apiKey = process.env.PILOTERR_API_KEY;
  if (!apiKey) {
    console.warn("[lbc] PILOTERR_API_KEY absent — LBC désactivé");
    return [];
  }

  const keywords = (params.styleKeywords ?? []).join(" ");
  const body = {
    category: params.category,
    location: params.city ?? "Paris",
    radius: params.radius_km ?? 100,
    ...(params.max_price ? { max_price: params.max_price } : {}),
    limit: params.limit ?? 40,
    ...(keywords ? { keywords } : {}),
  };

  const res = await fetch("https://api.piloterr.com/v2/leboncoin/listings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.warn(`[lbc] Piloterr ${res.status} — fallback`);
    return [];
  }

  const data = (await res.json()) as {
    listings?: Array<{
      id?: string;
      subject?: string;
      body?: string;
      price?: number[];
      location?: { city?: string };
      images?: { thumb_url?: string; urls?: string[] };
      url?: string;
      first_publication_date?: string;
    }>;
  };

  return (data.listings ?? [])
    .map((item) => ({
      id: item.id ?? crypto.randomUUID(),
      title: item.subject ?? "",
      description: item.body,
      price: item.price?.[0] ?? 0,
      city: item.location?.city ?? "",
      image_url: item.images?.urls?.[0] ?? item.images?.thumb_url ?? "",
      product_url: item.url ?? "",
      posted_at: item.first_publication_date ?? new Date().toISOString(),
    }))
    .filter((i) => i.title && i.image_url && i.price > 0);
}

export async function searchLbc(params: LbcSearchParams): Promise<LbcItem[]> {
  const hash = await buildHash(params);

  const cached = await checkCache(hash);
  if (cached) {
    console.log(`[lbc] cache hit ${params.category}`);
    return cached;
  }

  let items: LbcItem[] = [];
  try {
    items = await withTracking("scraping_lbc", () => fetchFromPiloterr(params), {
      category: params.category,
    });
  } catch (err) {
    console.warn("[lbc] Piloterr error:", err);
    return [];
  }

  if (items.length === 0) return [];

  // Calcul embeddings par batch (amendment α-11/2)
  try {
    const imageUrls = items.map((i) => i.image_url);
    const texts = items.map((i) => `${i.title} ${i.description ?? ""}`.trim());

    const [imageEmbs, textEmbs] = await Promise.all([
      withTracking("embedding", () => computeBatchImageEmbeddings(imageUrls), {
        count: imageUrls.length,
        type: "image",
      }),
      withTracking("embedding", () => computeBatchTextEmbeddings(texts), {
        count: texts.length,
        type: "text",
      }),
    ]);

    for (let i = 0; i < items.length; i++) {
      items[i].image_embedding = imageEmbs[i];
      items[i].text_embedding = textEmbs[i];
    }
  } catch (err) {
    console.warn("[lbc] Embeddings failed, items sans embeddings:", err);
  }

  await saveCache(hash, params, items);
  return items;
}

// Score hybride LBC (amendment α-11/2) : 0.5×visuel + 0.3×texte + 0.2×prix/fraîcheur
export function computeLbcHybridScore(
  item: LbcItem,
  targetEmbedding: number[],
  maxPrice?: number,
): number {
  const visualSim = item.image_embedding
    ? cosineSimilarity(targetEmbedding, item.image_embedding)
    : 0;

  const textSim = item.text_embedding
    ? cosineSimilarity(targetEmbedding, item.text_embedding)
    : visualSim; // fallback si pas de text emb

  let priceFit = 1.0;
  if (maxPrice && item.price > 0) {
    priceFit = item.price <= maxPrice ? 1.0 : Math.max(0, maxPrice / item.price);
  }

  const ageMs = Date.now() - new Date(item.posted_at).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const freshness = Math.max(0, 1 - ageDays / 90);

  const priceFreshness = 0.5 * priceFit + 0.5 * freshness;

  return 0.5 * visualSim + 0.3 * textSim + 0.2 * priceFreshness;
}
