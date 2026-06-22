#!/usr/bin/env npx tsx
/**
 * Backfill du text_embedding (buildProductText : nom + description + specs) des
 * produits partner_products — terme sémantique du blend visuel/texte au matching.
 * Jina uniquement (PAS de Piloterr). Batché + throttlé.
 *
 * Par défaut : idempotent (ne touche que text_embedding NULL).
 * Avec --all : RE-EMBED tous les produits (après enrichissement de buildProductText).
 *
 * Usage :
 *   npx tsx scripts/backfill-text-embeddings.ts          # seulement les manquants
 *   npx tsx scripts/backfill-text-embeddings.ts --all    # ré-embed tout le catalogue
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  const reembedAll = process.argv.includes("--all");
  const { createSupabaseAdmin } = await import("../lib/supabase/server");
  const { computeBatchTextEmbeddings } = await import("../lib/embeddings/jina");
  const { buildProductText } = await import("../lib/catalog/productText");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAdmin() as any;

  // Pagination : Supabase plafonne à 1000 lignes/req → on lit par pages.
  type Row = { id: string; name: string; description: string | null; metadata: Record<string, unknown> | null };
  const products: Row[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    let q = supabase
      .from("partner_products")
      .select("id, name, description, metadata")
      .not("embedding", "is", null)
      .order("id")
      .range(from, from + PAGE - 1);
    if (!reembedAll) q = q.is("text_embedding", null);
    const { data, error } = await q;
    if (error) {
      console.error("query échouée:", error.message);
      process.exit(1);
    }
    const page = (data ?? []) as Row[];
    products.push(...page);
    if (page.length < PAGE) break;
  }

  console.log(`${products.length} produits à ${reembedAll ? "RE-EMBED (--all)" : "backfill"}.`);
  if (products.length === 0) process.exit(0);

  const BATCH = 16;
  let done = 0;
  for (let i = 0; i < products.length; i += BATCH) {
    const chunk = products.slice(i, i + BATCH);
    const texts = chunk.map((p) => buildProductText(p));
    let embs: number[][];
    try {
      embs = await computeBatchTextEmbeddings(texts);
    } catch (e) {
      console.warn("batch embedding échoué:", e instanceof Error ? e.message : e);
      continue;
    }
    await Promise.all(
      chunk.map((p, k) =>
        supabase.from("partner_products").update({ text_embedding: JSON.stringify(embs[k]) }).eq("id", p.id),
      ),
    );
    done += chunk.length;
    if (done % 160 === 0 || done === products.length) console.log(`  ${done}/${products.length}`);
  }
  console.log(`✅ Backfill terminé : ${done} produits.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
