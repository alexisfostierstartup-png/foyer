import { createSupabaseAdmin } from "@/lib/supabase/server";

export type UsageInput = {
  provider: string;
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  imagesIn?: number;
  imagesOut?: number;
  apiRequests?: number;
};

export type PricingEntry = {
  per_1m_input_tokens?: number | null;
  per_1m_output_tokens?: number | null;
  per_image_in?: number | null;
  per_image_out?: number | null;
  per_request?: number | null;
  per_1k_embeddings?: number | null;
};

// Hardcoded fallback — used only if DB is unavailable
const DEFAULT_PRICING: Record<string, PricingEntry> = {
  // NB: pas de per_image_in — sur Gemini 2.5 l'image d'entrée est déjà comptée
  // dans les tokens d'entrée (promptTokenCount). L'ajouter double-comptait.
  "gemini_vision/gemini-2.5-flash-lite": {
    per_1m_input_tokens: 0.10, per_1m_output_tokens: 0.40,
  },
  "gemini_vision/gemini-2.5-flash": {
    per_1m_input_tokens: 0.30, per_1m_output_tokens: 2.50,
  },
  // Alias servis au nouveau projet (clé NANO_BANANA_API_KEY) — les modèles 2.5
  // texte sont bloqués pour les nouveaux projets. Tarifs approximatifs (Gemini 3
  // Flash) — à recaler sur la première facture.
  "gemini_vision/gemini-flash-lite-latest": {
    per_1m_input_tokens: 0.15, per_1m_output_tokens: 0.60,
  },
  "gemini_vision/gemini-flash-latest": {
    per_1m_input_tokens: 0.50, per_1m_output_tokens: 3.00,
  },
  "nano_banana/gemini-2.5-flash-image": {
    per_image_out: 0.039, per_1m_input_tokens: 0.30,
  },
  // Gemini 3 Pro Image (« Nano Banana 2 »), appelé en direct chez Google. Une image
  // 1K-2K = 1 120 tokens de sortie facturés 120 $/M, soit 0,134 $ ; le prompt (~7 000
  // tokens à 2 $/M) ajoute ~0,014 $. Total ~0,148 $ l'image, contre 0,041 $ pour NB1 —
  // et c'est ce qui achète une architecture qui ne bouge pas. Sans cette ligne, le suivi
  // comptait NB2 à ZÉRO : on aurait basculé le modèle sans jamais voir la facture monter.
  "nano_banana_2/gemini-3-pro-image-preview": {
    per_image_out: 0.134, per_1m_input_tokens: 2.0,
  },
  "flux_kontext/flux-kontext-pro": { per_image_out: 0.055 },
  "jina/jina-embeddings-v3": { per_1k_embeddings: 0.00002 },
  "piloterr/scraper": { per_request: 0.001 },
};

// In-process cache — 5-minute TTL
let _cache: Record<string, PricingEntry> | null = null;
let _cachedAt = 0;
const TTL = 5 * 60 * 1000;

export function invalidatePricingCache() {
  _cache = null;
  _cachedAt = 0;
}

async function loadPricing(): Promise<Record<string, PricingEntry>> {
  if (_cache && Date.now() - _cachedAt < TTL) return _cache;

  try {
    const { data, error } = await createSupabaseAdmin()
      .from("ai_pricing")
      .select("*")
      .eq("is_active", true);

    if (error || !data?.length) return DEFAULT_PRICING;

    const map: Record<string, PricingEntry> = {};
    for (const row of data) {
      const key = row.model ? `${row.provider}/${row.model}` : row.provider;
      map[key] = {
        per_1m_input_tokens: row.per_1m_input_tokens,
        per_1m_output_tokens: row.per_1m_output_tokens,
        per_image_in: row.per_image_in,
        per_image_out: row.per_image_out,
        per_request: row.per_request,
        per_1k_embeddings: row.per_1k_embeddings,
      };
    }
    _cache = map;
    _cachedAt = Date.now();
    return map;
  } catch {
    return DEFAULT_PRICING;
  }
}

function lookupPricing(
  provider: string,
  model: string | null | undefined,
  pricing: Record<string, PricingEntry>,
): PricingEntry {
  const fullKey = model ? `${provider}/${model}` : provider;
  return pricing[fullKey] ?? pricing[provider] ?? {};
}

function applyPricing(usage: UsageInput, p: PricingEntry): number {
  let cost = 0;
  if (p.per_1m_input_tokens && usage.inputTokens)  cost += (usage.inputTokens / 1_000_000) * p.per_1m_input_tokens;
  if (p.per_1m_output_tokens && usage.outputTokens) cost += (usage.outputTokens / 1_000_000) * p.per_1m_output_tokens;
  if (p.per_image_in && usage.imagesIn)             cost += usage.imagesIn * p.per_image_in;
  if (p.per_image_out && usage.imagesOut)           cost += usage.imagesOut * p.per_image_out;
  if (p.per_request && usage.apiRequests)           cost += usage.apiRequests * p.per_request;
  return cost;
}

export function computeCostSync(usage: UsageInput, pricing: Record<string, PricingEntry> = DEFAULT_PRICING): number {
  return applyPricing(usage, lookupPricing(usage.provider, usage.model, pricing));
}

export async function computeCost(usage: UsageInput): Promise<number> {
  const pricing = await loadPricing();
  return applyPricing(usage, lookupPricing(usage.provider, usage.model, pricing));
}
