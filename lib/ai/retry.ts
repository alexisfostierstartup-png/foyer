// Retry avec backoff exponentiel + jitter pour les erreurs IA TRANSITOIRES
// (surcharge serveur 503, 500, rate-limit 429, coupures réseau). Les spikes de
// demande Gemini sont temporaires : on retente plutôt que de remonter l'erreur.

const TRANSIENT = [
  /\b503\b/, /service unavailable/i, /overloaded/i, /high demand/i,
  /\b500\b/, /internal error/i, /\bunavailable\b/i,
  /\b429\b/, /rate.?limit/i, /too many requests/i, /resource exhausted/i,
  /ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|socket hang up|network/i,
];

export function isTransientAiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // Quota/facturation : retenter n'aide pas (limite atteinte) → ne pas réessayer.
  if (/quota|billing|exceeded your current quota|api key|permission/i.test(msg)) {
    return false;
  }
  return TRANSIENT.some((re) => re.test(msg));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseMs?: number; label?: string } = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseMs = opts.baseMs ?? 700;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !isTransientAiError(err)) throw err;
      // backoff exponentiel + jitter (±30 %)
      const delay = Math.round(baseMs * 2 ** attempt * (0.7 + Math.random() * 0.6));
      console.warn(
        `[ai:retry] ${opts.label ?? "call"} erreur transitoire (tentative ${attempt + 1}/${retries + 1}), retry dans ${delay}ms — ${err instanceof Error ? err.message.slice(0, 140) : String(err)}`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
