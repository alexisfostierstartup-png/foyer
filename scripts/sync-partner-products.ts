#!/usr/bin/env npx tsx
/**
 * Script de sync manuelle des produits partenaires.
 * Usage :
 *   npx tsx scripts/sync-partner-products.ts [merchant] [--test-limit N]
 *
 * Exemples :
 *   npx tsx scripts/sync-partner-products.ts                    # tous les merchants
 *   npx tsx scripts/sync-partner-products.ts manomano           # un seul
 *   npx tsx scripts/sync-partner-products.ts --test-limit 50    # 50 produits max par merchant
 *
 * Merchants supportés : manomano, castorama, la_redoute
 */

import "dotenv/config";

// Chargement des variables d'env locales
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const SUPPORTED = ["manomano", "castorama", "la_redoute"] as const;
type Merchant = (typeof SUPPORTED)[number];

async function main() {
  const args = process.argv.slice(2);
  const testLimitIdx = args.indexOf("--test-limit");
  const testLimit = testLimitIdx !== -1 ? parseInt(args[testLimitIdx + 1] ?? "100") : 100;

  const merchantArg = args.find((a) => !a.startsWith("--") && a !== String(testLimit));
  const merchants: Merchant[] = merchantArg
    ? (SUPPORTED.includes(merchantArg as Merchant) ? [merchantArg as Merchant] : [])
    : [...SUPPORTED];

  if (merchants.length === 0) {
    console.error(`❌ Merchant inconnu : ${merchantArg}. Supportés : ${SUPPORTED.join(", ")}`);
    process.exit(1);
  }

  console.log(`🔄 Sync ${merchants.join(", ")} (limit=${testLimit})…\n`);

  // Import dynamique après que les env vars soient disponibles
  const { syncMerchantProducts } = await import("../lib/shopping/sync");

  let hasError = false;
  for (const merchant of merchants) {
    try {
      console.log(`⏳ ${merchant}…`);
      const result = await syncMerchantProducts(merchant, { testLimit });
      console.log(
        `✅ ${merchant} : +${result.added} ajoutés / ~${result.updated} mis à jour / ${result.markedUnavailable} discontinués / ${result.errors} erreurs\n`,
      );
    } catch (err) {
      console.error(`❌ ${merchant} :`, err instanceof Error ? err.message : err, "\n");
      hasError = true;
    }
  }

  process.exit(hasError ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
