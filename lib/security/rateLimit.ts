import { createSupabaseAdmin } from "@/lib/supabase/server";

/**
 * IP de l'appelant. Sur Vercel, `x-forwarded-for` est posé par la plateforme ;
 * on prend la première IP (le client réel). Repli sur `x-real-ip` puis "unknown".
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Rate limit par IP (fenêtre fixe, compteur atomique en DB via `rate_limit_hit`).
 * Retourne `true` si la requête est AUTORISÉE. **Fail-open** : si le limiteur
 * échoue (DB indispo…), on autorise — on ne bloque jamais un usage légitime à
 * cause d'un incident d'infra (crédits Gemini surveillés manuellement en bêta).
 */
export async function checkRateLimit(
  ip: string,
  bucket: string,
  limit: number,
  windowSeconds = 3600,
): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (createSupabaseAdmin() as any).rpc("rate_limit_hit", {
      p_ip: ip,
      p_bucket: bucket,
      p_window_seconds: windowSeconds,
      p_limit: limit,
    });
    if (error) {
      console.warn(`[ratelimit] rpc error (fail-open) bucket=${bucket}:`, error.message);
      return true;
    }
    return data === true;
  } catch (e) {
    console.warn("[ratelimit] exception (fail-open):", e instanceof Error ? e.message : e);
    return true;
  }
}

/** Réponse 429 standard quand la limite est atteinte. */
export const RATE_LIMITED_BODY = {
  error: "Trop de requêtes depuis votre connexion. Réessayez dans quelques minutes.",
};
