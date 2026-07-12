export const dynamic = "force-dynamic";

import { createSupabaseAdmin } from "@/lib/supabase/server";
import { CatalogAdmin } from "@/components/admin/CatalogAdmin";

type PartnerProduct = {
  id: string;
  name: string;
  category: string;
  merchant: string;
  price: number | null;
  partner_tier: string;
  source_type: string;
  availability_status: string;
  primary_image_url: string;
  last_synced_at: string | null;
  created_at: string;
  metadata?: { attrs?: Record<string, unknown> } | null;
};

type SyncRun = {
  id: string;
  merchant: string;
  source: string;
  status: string;
  items_added: number;
  items_updated: number;
  items_marked_unavailable: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
};

export default async function AdminCatalogPage() {
  const supabase = createSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: products, count }, { data: syncRuns }, { data: merchantRows }, { data: categoryRows }] = await Promise.all([
    (supabase as any)
      .from("partner_products")
      .select("id, name, category, merchant, price, partner_tier, source_type, availability_status, primary_image_url, last_synced_at, created_at, metadata, style_affinity", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(20),
    (supabase as any)
      .from("partner_sync_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20),
    // Marchand = source de vérité partner_merchants (inclut ceux à 0 produit, ex. en pause).
    (supabase as any).from("partner_merchants").select("merchant").order("merchant"),
    // Catégorie = source de vérité RPC distinct_catalog_categories (calculé côté Postgres,
    // pas plafonné à 1000 lignes comme un SELECT brut) — remplace la liste dérivée de
    // SCHEMA_V3 qui omettait les catégories sans schéma dédié (curtains, cushion, bed…).
    (supabase as any).rpc("distinct_catalog_categories"),
  ]);

  const merchants = [...new Set((merchantRows ?? []).map((r: { merchant: string }) => r.merchant))] as string[];
  const categories = ((categoryRows ?? []) as { category: string }[]).map((r) => r.category);

  return (
    <CatalogAdmin
      initialProducts={(products ?? []) as PartnerProduct[]}
      totalCount={count ?? 0}
      syncRuns={(syncRuns ?? []) as SyncRun[]}
      merchants={merchants}
      categories={categories}
    />
  );
}
