export type UsageInput = {
  provider: string;
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  imagesIn?: number;
  imagesOut?: number;
  apiRequests?: number;
};

type PricingEntry = {
  per_1m_input_tokens?: number;
  per_1m_output_tokens?: number;
  per_image_in?: number;
  per_image_out?: number;
  per_request?: number;
  per_1k_embeddings?: number;
};

// USD prices — updated June 2025 (Gemini public pricing)
const DEFAULT_PRICING: Record<string, PricingEntry> = {
  // Gemini 2.5 Flash Lite (vision/text)
  "gemini_vision/gemini-2.5-flash-lite": {
    per_1m_input_tokens: 0.10,
    per_1m_output_tokens: 0.40,
    per_image_in: 0.001316, // ≈ avg image counted as ~13k tokens
  },
  // Gemini 2.5 Flash (thinking, legacy)
  "gemini_vision/gemini-2.5-flash": {
    per_1m_input_tokens: 0.30,
    per_1m_output_tokens: 2.50,
  },
  // Gemini 2.5 Flash Image generation (nano_banana)
  "nano_banana/gemini-2.5-flash-image": {
    per_image_out: 0.039,
    per_image_in: 0.001316,
    per_1m_input_tokens: 0.10,
  },
  // Flux Kontext (when implemented)
  "flux_kontext/flux-kontext-pro": {
    per_image_out: 0.055,
  },
  // Jina embeddings
  "jina/jina-embeddings-v3": {
    per_1k_embeddings: 0.00002,
  },
  // Piloterr scraping
  "piloterr/scraper": {
    per_request: 0.001,
  },
};

// TODO: load overrides from assets (category='ai_pricing', slug='pricing_overrides', data=JSON)
// once the assets.category constraint is extended to include 'ai_pricing'.

function lookupPricing(
  provider: string,
  model: string | null | undefined,
  overrides: Record<string, PricingEntry>,
): PricingEntry {
  const fullKey = model ? `${provider}/${model}` : provider;
  return overrides[fullKey] ?? overrides[provider] ?? DEFAULT_PRICING[fullKey] ?? DEFAULT_PRICING[provider] ?? {};
}

export function computeCostSync(usage: UsageInput, overrides: Record<string, PricingEntry> = {}): number {
  const p = lookupPricing(usage.provider, usage.model, overrides);
  let cost = 0;
  if (p.per_1m_input_tokens && usage.inputTokens) {
    cost += (usage.inputTokens / 1_000_000) * p.per_1m_input_tokens;
  }
  if (p.per_1m_output_tokens && usage.outputTokens) {
    cost += (usage.outputTokens / 1_000_000) * p.per_1m_output_tokens;
  }
  if (p.per_image_in && usage.imagesIn) {
    cost += usage.imagesIn * p.per_image_in;
  }
  if (p.per_image_out && usage.imagesOut) {
    cost += usage.imagesOut * p.per_image_out;
  }
  if (p.per_request && usage.apiRequests) {
    cost += usage.apiRequests * p.per_request;
  }
  return cost;
}

export async function computeCost(usage: UsageInput): Promise<number> {
  return computeCostSync(usage, {});
}
