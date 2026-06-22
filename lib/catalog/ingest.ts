/**
 * Ingestion AGNOSTIQUE DE LA SOURCE : prend un ProductSource (Piloterr test ou
 * Awin prod) et peuple partner_products avec embedding image (Jina), en marquant
 * les lignes comme jeu de test (purgeable en une requête).
 */
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { computeImageEmbedding, computeTextEmbedding } from "@/lib/embeddings/jina";
import { withTracking } from "@/lib/tracking";
import type { ProductSource } from "./types";

export const TEST_SCRAPE_MARKER = "test_scrape";

export type CategoryStat = { fetched: number; inserted: number; skipped: number; failed: number; error?: string };
export type IngestStats = { merchant: string; perCategory: Record<string, CategoryStat>; totalInserted: number };

type IngestOptions = { perCategory: number; maxTotal: number; force?: boolean };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Erreur FATALE (solde Jina épuisé) → on doit ABORTER tout le run, sinon on continue
// à appeler Piloterr (crédits brûlés) pour des produits qu'on ne peut pas embedder.
function isFatalEmbeddingError(e: unknown): boolean {
  return e instanceof Error && /Insufficient account balance|AUTHZ_INSUFFICIENT_BALANCE/i.test(e.message);
}

export async function ingestFromSource(
  source: ProductSource,
  categories: string[],
  options: IngestOptions,
): Promise<IngestStats> {
  // Cast `any` (comme lib/shopping/sync.ts) : la colonne embedding (pgvector) et le
  // jsonb metadata ne sont pas dans les types générés du client.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAdmin() as any;
  const perCategory: Record<string, CategoryStat> = {};
  let totalInserted = 0;

  for (const category of categories) {
    if (totalInserted >= options.maxTotal) {
      console.warn(`[ingest:${source.merchant}] cap ${options.maxTotal} atteint — stop.`);
      break;
    }
    // Reprise : si la catégorie est déjà (quasi) complète, on la saute → aucun re-fetch Piloterr.
    const { count: already } = await supabase
      .from("partner_products")
      .select("id", { count: "exact", head: true })
      .eq("merchant", source.merchant)
      .eq("category", category);
    if (!options.force && (already ?? 0) >= Math.floor(options.perCategory * 0.8)) {
      console.log(`[ingest:${source.merchant}] ${category}: déjà ${already} en base → skip (reprise).`);
      perCategory[category] = { fetched: 0, inserted: 0, skipped: already ?? 0, failed: 0 };
      continue;
    }

    const stat: CategoryStat = { fetched: 0, inserted: 0, skipped: 0, failed: 0 };
    try {
      for await (const p of source.fetchProducts(category, options.perCategory)) {
        if (totalInserted >= options.maxTotal) break;
        stat.fetched++;
        try {
          // Dédup manuel : l'index unique (merchant, external_id) est PARTIEL
          // (WHERE external_id IS NOT NULL) → onConflict pas fiable.
          const { data: existing } = await supabase
            .from("partner_products")
            .select("id, embedding")
            .eq("merchant", p.merchant)
            .eq("external_id", p.external_id)
            .limit(1)
            .maybeSingle();

          if (existing?.embedding != null) { stat.skipped++; continue; }
          if (!p.primary_image_url) { stat.failed++; continue; }

          const embedding = await withTracking(
            "embedding",
            () => computeImageEmbedding(p.primary_image_url),
            { merchant: p.merchant, category },
          );
          // Embedding TEXTE (nom + description) → blend visuel/sémantique au matching.
          const textEmbedding = await computeTextEmbedding(`${p.name}. ${p.description ?? ""}`.trim());

          const row = {
            merchant: p.merchant,
            external_id: p.external_id,
            category: p.category,
            name: p.name,
            description: p.description ?? null,
            price: p.price,
            currency: p.currency ?? "EUR",
            product_url: p.product_url,
            image_urls: p.image_urls,
            primary_image_url: p.primary_image_url,
            source_type: p.source_type,
            availability_status: "available",
            embedding: JSON.stringify(embedding), // pgvector attend '[...]'
            text_embedding: JSON.stringify(textEmbedding),
            last_synced_at: new Date().toISOString(),
            metadata: { ingestion: TEST_SCRAPE_MARKER, scraped_at: new Date().toISOString(), ...(p.attributes ?? {}) },
          };

          const res = existing
            ? await supabase.from("partner_products").update(row).eq("id", existing.id)
            : await supabase.from("partner_products").insert(row);
          if (res.error) throw new Error(res.error.message);

          stat.inserted++;
          totalInserted++;
          await sleep(1500); // lisse le débit d'embeddings (rate limit Jina ~100k tokens/min)
        } catch (e) {
          if (isFatalEmbeddingError(e)) throw e; // solde Jina épuisé → ABORT (sinon on brûle Piloterr)
          stat.failed++;
          console.warn(`[ingest:${source.merchant}] ${p.external_id} échec:`, e instanceof Error ? e.message : e);
        }
      }
      console.log(
        `[ingest:${source.merchant}] ${category}: ${stat.fetched} fetched / ${stat.inserted} insérés / ${stat.skipped} skippés / ${stat.failed} échecs`,
      );
    } catch (e) {
      if (isFatalEmbeddingError(e)) {
        console.error("\n⛔ Jina : solde épuisé → ARRÊT du run. Recharge https://jina.ai/api-dashboard puis relance (le dédup + skip-reprise reprennent sans re-dépenser).");
        throw e;
      }
      stat.error = e instanceof Error ? e.message : String(e);
      console.warn(`[ingest:${source.merchant}] ${category} ÉCHEC catégorie:`, stat.error);
    }
    perCategory[category] = stat;
    await sleep(1100); // throttle ≥1 req/s entre catégories
  }

  console.log(`[ingest:${source.merchant}] TOTAL insérés: ${totalInserted}`);
  return { merchant: source.merchant, perCategory, totalInserted };
}
