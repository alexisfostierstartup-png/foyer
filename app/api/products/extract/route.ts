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
function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&(l|g)t;/g, (_, c) => (c === "l" ? "<" : ">"))
    .trim();
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

    let imageUrl: string | undefined;
    let name: string | undefined;
    let price: number | null = null;

    if (!("error" in p)) {
      imageUrl = p.primary_image_url;
      name = p.name;
      price = p.price;
    } else {
      // 2) Fallback Open Graph.
      const og = ogFallback(html);
      imageUrl = og.imageUrl;
      name = og.name;
    }

    if (!imageUrl) {
      // Échec propre : on ne peut pas récupérer l'image → l'UI bascule sur import JPEG.
      return NextResponse.json(
        { ok: false, error: "no_image", host },
        { status: 200 },
      );
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
