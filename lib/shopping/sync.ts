import { createSupabaseAdmin } from "@/lib/supabase/server";
import { computeImageEmbedding } from "@/lib/embeddings/jina";

type SyncOptions = {
  testLimit?: number;
};

type SyncResult = {
  merchant: string;
  added: number;
  updated: number;
  markedUnavailable: number;
  errors: number;
};

// ── Awin feed URL builder ────────────────────────────────────────────────────
// Merchant IDs Awin (FR) :
// ManoMano : 14190 | Castorama : 2822 | La Redoute : 1460
const AWIN_MERCHANT_IDS: Record<string, number> = {
  manomano: 14190,
  castorama: 2822,
  la_redoute: 1460,
};

// Catégories Awin → catégorie Foyer
const AWIN_CATEGORY_MAP: Record<string, string> = {
  canapé: "sofa", "canapés": "sofa",
  "fauteuil": "armchair", "fauteuils": "armchair",
  "table basse": "coffee_table", "tables basses": "coffee_table",
  "table d'appoint": "side_table",
  "tapis": "rug",
  "lampe": "lamp", "suspension": "lamp", "luminaire": "lamp",
  "lampadaire": "floor_lamp",
  "meuble tv": "tv_stand", "meuble télé": "tv_stand",
  "étagère": "bookshelf", "bibliothèque": "bookshelf",
  "lit": "bed",
  "table de nuit": "nightstand", "chevet": "nightstand",
  "commode": "dresser", "armoire": "dresser",
  "rideau": "curtains",
  "coussin": "cushion",
  "peinture": "paint",
  "moulure": "mouldings", "plinthes": "mouldings",
  "parquet": "floor_material", "carrelage": "floor_material",
};

const TARGET_CATEGORIES = new Set([
  "sofa", "armchair", "coffee_table", "side_table", "rug", "lamp",
  "floor_lamp", "tv_stand", "bookshelf", "bed", "nightstand", "dresser",
  "curtains", "cushion", "paint", "mouldings", "floor_material",
]);

function detectCategory(productName: string, awinCategory?: string): string | null {
  const text = `${productName} ${awinCategory ?? ""}`.toLowerCase();
  for (const [key, cat] of Object.entries(AWIN_CATEGORY_MAP)) {
    if (text.includes(key)) return cat;
  }
  return null;
}

function detectEcoLabel(description: string, name: string): string {
  const text = `${name} ${description}`.toLowerCase();
  const labels = ["fsc", "pefc", "ange bleu", "ecolabel", "nf environnement", "oeko-tex"];
  if (labels.some((l) => text.includes(l))) return "eco_label_certified";
  return "eco_new";
}

// ── Style affinity heuristic ─────────────────────────────────────────────────
function detectStyleAffinity(name: string, description: string): string[] {
  const text = `${name} ${description}`.toLowerCase();
  const styles: string[] = [];
  if (/scandinave|nordique|chêne|bois clair|hêtre/.test(text)) styles.push("bois-clair");
  if (/lin|coton|naturel|doux|pastel|beige/.test(text)) styles.push("doux");
  if (/industriel|béton|métal|loft|acier/.test(text)) styles.push("brut");
  if (/vintage|retro|années 6|années 7|mid-century|pieds compas/.test(text)) styles.push("vintage");
  if (/méditerranée|provençal|céramique|mosaïque/.test(text)) styles.push("mediterraneen");
  if (/boho|bohème|rotin|macramé|raphia/.test(text)) styles.push("bohemian");
  return styles;
}

// ── Awin feed fetch ──────────────────────────────────────────────────────────
type AwinProduct = {
  aw_product_id: string;
  product_name: string;
  description: string;
  search_price: string;
  merchant_product_category_path: string;
  aw_image_url: string;
  merchant_deep_link: string;
  aw_deep_link: string;
};

async function fetchAwinFeed(
  merchantId: number,
  options: SyncOptions,
): Promise<AwinProduct[]> {
  const publisherId = process.env.AWIN_PUBLISHER_ID;
  const token = process.env.AWIN_API_TOKEN;
  if (!publisherId || !token) throw new Error("AWIN_PUBLISHER_ID ou AWIN_API_TOKEN manquant");

  const limit = options.testLimit ?? 500;
  const url = `https://productdata.awin.com/datafeed/list/apikey/${token}/network/6/merchantList/${merchantId}/columnsOverride/aw_product_id,product_name,description,search_price,merchant_product_category_path,aw_image_url,merchant_deep_link,aw_deep_link/format/json/?limit=${limit}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "foyer-alpha-sync/1.0" },
  });
  if (!res.ok) throw new Error(`Awin feed ${merchantId} returned ${res.status}`);

  const json = (await res.json()) as { campaignId?: number; feedItems?: AwinProduct[] };
  return json.feedItems ?? [];
}

// ── Main sync function ───────────────────────────────────────────────────────
export async function syncMerchantProducts(
  merchant: string,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const result: SyncResult = { merchant, added: 0, updated: 0, markedUnavailable: 0, errors: 0 };
  const supabase = createSupabaseAdmin();

  const merchantId = AWIN_MERCHANT_IDS[merchant];
  if (!merchantId) throw new Error(`Merchant inconnu : ${merchant}`);

  // Log début sync
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: runData } = await (supabase as any).from("partner_sync_runs").insert({
    merchant,
    source: "awin_feed",
    status: "running",
    started_at: new Date().toISOString(),
  }).select("id").single();
  const runId = runData?.id;

  const syncedIds = new Set<string>();

  try {
    const products = await fetchAwinFeed(merchantId, options);
    console.log(`[sync:${merchant}] ${products.length} produits récupérés`);

    for (const p of products) {
      try {
        const category = detectCategory(p.product_name, p.merchant_product_category_path);
        if (!category || !TARGET_CATEGORIES.has(category)) continue;

        const price = parseFloat(p.search_price) || 0;
        const sourceType = detectEcoLabel(p.description ?? "", p.product_name);
        const styleAffinity = detectStyleAffinity(p.product_name, p.description ?? "");

        const externalId = p.aw_product_id;
        syncedIds.add(externalId);

        // Check if exists
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await (supabase as any)
          .from("partner_products")
          .select("id, embedding")
          .eq("merchant", merchant)
          .eq("external_id", externalId)
          .single();

        const needsEmbedding = !existing || !existing.embedding;

        let embedding: number[] | null = null;
        if (needsEmbedding && p.aw_image_url) {
          try {
            embedding = await computeImageEmbedding(p.aw_image_url);
          } catch {
            console.warn(`[sync:${merchant}] embedding failed for ${externalId}`);
          }
        }

        const upsertData = {
          merchant,
          external_id: externalId,
          category,
          name: p.product_name.slice(0, 255),
          description: p.description?.slice(0, 2000),
          price,
          product_url: p.merchant_deep_link,
          affiliate_url: p.aw_deep_link,
          image_urls: p.aw_image_url ? [p.aw_image_url] : [],
          primary_image_url: p.aw_image_url ?? "",
          style_affinity: styleAffinity,
          source_type: sourceType,
          availability_status: "available",
          last_synced_at: new Date().toISOString(),
          ...(embedding ? { embedding: JSON.stringify(embedding) } : {}),
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: upsertError } = await (supabase as any)
          .from("partner_products")
          .upsert(upsertData, { onConflict: "merchant,external_id" });

        if (upsertError) {
          console.error(`[sync:${merchant}] upsert error:`, upsertError.message);
          result.errors++;
        } else {
          if (existing) result.updated++;
          else result.added++;
        }
      } catch (itemErr) {
        console.error(`[sync:${merchant}] item error:`, itemErr);
        result.errors++;
      }
    }

    // Marquer comme discontinued les produits non vus dans ce flux
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: staleProducts } = await (supabase as any)
      .from("partner_products")
      .select("id, external_id")
      .eq("merchant", merchant)
      .eq("availability_status", "available")
      .not("external_id", "is", null);

    for (const stale of staleProducts ?? []) {
      if (!syncedIds.has(stale.external_id)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("partner_products")
          .update({ availability_status: "discontinued" })
          .eq("id", stale.id);
        result.markedUnavailable++;
      }
    }

    // Finalise run log
    if (runId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("partner_sync_runs").update({
        status: "success",
        items_added: result.added,
        items_updated: result.updated,
        items_marked_unavailable: result.markedUnavailable,
        finished_at: new Date().toISOString(),
      }).eq("id", runId);
    }
  } catch (err) {
    if (runId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("partner_sync_runs").update({
        status: "failed",
        error_message: err instanceof Error ? err.message : String(err),
        finished_at: new Date().toISOString(),
      }).eq("id", runId);
    }
    throw err;
  }

  console.log(`[sync:${merchant}] ✅ +${result.added} / ~${result.updated} / ✗${result.markedUnavailable}`);
  return result;
}
