/**
 * fetchHtml — couche de récupération HTML AGNOSTIQUE DU PROVIDER, pour les sites
 * protégés anti-bot (DataDome : Maisons du Monde, La Redoute, 3Suisses…).
 *
 * Provider par défaut : Bright Data Web Unlocker (endpoint REST), qui gère proxies
 * résidentiels + rendu JS + résolution du challenge DataDome en une requête. On peut
 * brancher un autre provider (Scrapfly asp=true en backup) sans toucher aux appelants :
 * tout passe par fetchHtml(url).
 *
 * Le scraping direct (navigateur/curl) se fait bloquer (403/CAPTCHA DataDome) — voir
 * la mémoire projet "scraping anti-bot". Web Unlocker est lent (~30-60s/req) et peut
 * renvoyer des 502 transitoires → retries avec backoff.
 */

const BRIGHTDATA_ENDPOINT = "https://api.brightdata.com/request";

export type FetchHtmlResult = { status: number; html: string; ms: number };

function token(): string {
  const t = process.env.BRIGHTDATA_API_TOKEN;
  if (!t) throw new Error("BRIGHTDATA_API_TOKEN manquant (.env.local)");
  return t;
}
const zone = () => process.env.BRIGHTDATA_ZONE || "web_unlocker1";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Récupère le HTML rendu d'une URL via Bright Data Web Unlocker.
 * Retry sur 5xx / 429 / erreur réseau (le 502 « unlock timeout » est fréquent et
 * passe quasi toujours au 2e essai). Lève si tous les essais échouent.
 */
export async function fetchHtml(
  url: string,
  opts: { retries?: number; timeoutMs?: number } = {},
): Promise<FetchHtmlResult> {
  const retries = opts.retries ?? 3;
  const timeoutMs = opts.timeoutMs ?? 120_000;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const t0 = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(BRIGHTDATA_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ zone: zone(), url, format: "raw" }),
        signal: ctrl.signal,
      });
      const html = await res.text();
      const ms = Date.now() - t0;
      if (res.ok) return { status: res.status, html, ms };
      // 4xx (hors 429) = définitif (URL morte, etc.) → on ne retry pas.
      if (res.status < 500 && res.status !== 429) return { status: res.status, html, ms };
      lastErr = new Error(`Web Unlocker ${res.status} (${ms}ms): ${html.slice(0, 120)}`);
    } catch (e) {
      lastErr = e;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) await sleep(2000 * attempt); // backoff 2s, 4s…
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
