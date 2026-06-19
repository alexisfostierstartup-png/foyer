#!/usr/bin/env npx tsx
/**
 * Backfill du text_embedding (nom + description) des produits partner_products qui
 * n'en ont pas encore — pour le blend visuel/sémantique au matching.
 * Jina uniquement (PAS de Piloterr). Idempotent (ne touche que text_embedding null).
 *
 * Usage : npx tsx scripts/backfill-text-embeddings.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  const { createSupabaseAdmin } = await import("../lib/supabase/server");
  const { computeBatchTextEmbeddings } = await import("../lib/embeddings/jina");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAdmin() as any;

  const { data: rows, error } = await supabase
    .from("partner_products")
    .select("id, name, description")
    .is("text_embedding", null)
    .not("embedding", "is", null);
  if (error) {
    console.error("query échouée:", error.message);
    process.exit(1);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const products = (rows ?? []) as Array<{ id: string; name: string; description: string | null }>;
  console.log(`${products.length} produits à backfill.`);
  if (products.length === 0) process.exit(0);

  const BATCH = 16;
  let done = 0;
  for (let i = 0; i < products.length; i += BATCH) {
    const chunk = products.slice(i, i + BATCH);
    const texts = chunk.map((p) => `${p.name}. ${p.description ?? ""}`.trim());
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
    console.log(`  ${done}/${products.length}`);
  }
  console.log(`✅ Backfill terminé : ${done} produits.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
