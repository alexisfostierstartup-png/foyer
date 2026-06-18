#!/usr/bin/env npx tsx
/**
 * PURGE du jeu de TEST catalog — supprime toutes les lignes partner_products
 * marquées metadata.ingestion='test_scrape'. À lancer le jour du passage aux
 * flux d'affiliation Awin (ne touche AUCUNE autre donnée).
 *
 * Usage : npx tsx scripts/purge-test-catalog.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config(); // fallback .env

async function main() {
  const { createSupabaseAdmin } = await import("../lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAdmin() as any;

  const { data, error } = await supabase
    .from("partner_products")
    .delete()
    .eq("metadata->>ingestion", "test_scrape")
    .select("id");

  if (error) {
    console.error("❌ Purge échouée:", error.message);
    process.exit(1);
  }
  console.log(`🧹 Purgé ${data?.length ?? 0} produits de test (metadata.ingestion='test_scrape').`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
