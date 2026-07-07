import { NextRequest, NextResponse } from "next/server";
import { fetchHtml } from "@/lib/catalog/fetchHtml";
import { extractProduct } from "@/lib/catalog/jsonld-extract";
import { detectCategory } from "@/lib/shopping/sync";
import { getClientIp, checkRateLimit, RATE_LIMITED_BODY } from "@/lib/security/rateLimit";

export const maxDuration = 60;

// Extraction produit depuis une URL collée par l'user (« indiquer votre référence »).
// Best-effort : JSON-LD Product d'abord (MdM, La Redoute, Cdiscount…), puis fallback
// Open Graph (og:image/og:title). Si rien d'exploitable → { ok:false } et l'UI propose
// d'importer un JPEG directement (on NE génère JAMAIS un rendu avec une image bidon).
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", quot: '"', apos: "'", nbsp: " ", lt: "<", gt: ">",
  eacute: "é", egrave: "è", ecirc: "ê", euml: "ë", agrave: "à", acirc: "â", auml: "ä",
  ugrave: "ù", ucirc: "û", uuml: "ü", ocirc: "ô", ouml: "ö", icirc: "î", iuml: "ï",
  ccedil: "ç", ntilde: "ñ", oelig: "œ", aelig: "æ", deg: "°", euro: "€", hellip: "…",
  laquo: "«", raquo: "»", rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', ndash: "–", mdash: "—",
};

// Décode les entités HTML — indispensable AUSSI sur l'imageUrl (ex. Roche Bobois expose
// une URL de render avec `&amp;` dans le JSON-LD → sans décodage l'URL est cassée et le
// serveur renvoie une image PAR DÉFAUT ≠ le produit → rendu halluciné).
function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&([a-z0-9]+);/gi, (m, n) => NAMED_ENTITIES[n.toLowerCase()] ?? m)
    .trim();
}

// GARDE-FOU anti-hallucination : on ne renvoie une image que si on arrive VRAIMENT à
// la récupérer comme image (statut 200 + content-type image/*). Sinon → échec propre,
// l'user importe un JPEG. Le user peut coller 1000+ sites → jamais de rendu sur du vide.
async function isReachableImage(url: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12_000);
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) return false;
    // On lit quelques octets pour confirmer un vrai contenu image (pas un corps vide/HTML).
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 512;
  } catch {
    return false;
  }
}

function ogFallback(html: string): { imageUrl?: string; name?: string } {
  const pick = (re: RegExp) => html.match(re)?.[1]?.trim();
  const imageUrl =
    pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    pick(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const name =
    pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    pick(/<title[^>]*>([^<]+)<\/title>/i);
  return { imageUrl, name };
}

export async function POST(request: NextRequest) {
  if (!(await checkRateLimit(getClientIp(request), "generate", 30))) {
    return NextResponse.json(RATE_LIMITED_BODY, { status: 429 });
  }

  let url: string;
  try {
    url = String(((await request.json()) as { url?: string }).url ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide" }, { status: 400 });
  }
  if (!/^https?:\/\/.+\..+/i.test(url)) {
    return NextResponse.json({ ok: false, error: "Lien invalide" }, { status: 400 });
  }

  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return NextResponse.json({ ok: false, error: "Lien invalide" }, { status: 400 });
  }

  try {
    const { html } = await fetchHtml(url, { retries: 2, timeoutMs: 45_000 });

    // 1) JSON-LD Product.
    const p = extractProduct(html, {
      merchant: host,
      category: "unknown",
      external_id: url,
      product_url: url,
    });

    let candidates: string[] = [];
    let name: string | undefined;
    let price: number | null = null;

    if (!("error" in p)) {
      candidates = p.image_urls?.length ? p.image_urls : [p.primary_image_url];
      name = p.name;
      price = p.price;
    } else {
      // 2) Fallback Open Graph.
      const og = ogFallback(html);
      if (og.imageUrl) candidates = [og.imageUrl];
      name = og.name;
    }

    // On PRÉFÈRE le packshot principal : on déprioritise les crops zoom/détail/texture
    // (ex. Roche Bobois met en 1er un gros plan de la maille → mauvais pour l'intégration).
    const DETAIL = /zoom|detail|swatch|texture|vignette|thumb|closeup|_d\d|matiere/i;
    candidates = [...new Set(candidates.filter(Boolean).map(decodeEntities))]
      .sort((a, b) => (DETAIL.test(a) ? 1 : 0) - (DETAIL.test(b) ? 1 : 0));

    // On garde la 1re image RÉELLEMENT récupérable (anti-hallucination).
    let imageUrl: string | undefined;
    for (const c of candidates) {
      if (await isReachableImage(c)) { imageUrl = c; break; }
    }
    if (!imageUrl) {
      // Échec propre : aucune image exploitable → l'UI bascule sur import JPEG.
      return NextResponse.json({ ok: false, error: "no_image", host }, { status: 200 });
    }

    const clean = name ? decodeEntities(name) : null;
    const category = clean ? detectCategory(clean) : null;
    return NextResponse.json({
      ok: true,
      product: { imageUrl, name: clean, price, merchant: host, url, category },
    });
  } catch (err) {
    console.error("[products/extract] error:", err);
    // Site bloqué / illisible → échec propre.
    return NextResponse.json({ ok: false, error: "fetch_failed", host }, { status: 200 });
  }
}
