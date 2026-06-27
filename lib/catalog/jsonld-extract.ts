/**
 * jsonld-extract — extrait un PartnerProductInput depuis le HTML d'une fiche produit
 * e-commerce qui expose le schema.org Product en JSON-LD (cas de MdM, La Redoute,
 * 3Suisses…). AGNOSTIQUE du marchand : on lit le <script type="application/ld+json">
 * + les paires <dt>/<dd> de caractéristiques (couleur/matière/dimensions). Pas de
 * dépendance HTML (regex) → réutilisable partout.
 *
 * Le JSON-LD donne nom + prix + images HD + description + GTIN ; les dt/dd enrichissent
 * metadata (couleur/matière/structure/dimensions) → terme TEXTE du matching. La couleur
 * perceptuelle (color_hex) est de toute façon recalculée depuis l'image au backfill.
 */
import type { PartnerProductInput } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJsonLdBlocks(html: string): any[] {
  const out: any[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      out.push(JSON.parse(m[1].trim()));
    } catch {
      /* bloc LD malformé → ignoré */
    }
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findProduct(node: any): any | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const x of node) {
      const f = findProduct(x);
      if (f) return f;
    }
    return null;
  }
  const t = node["@type"];
  if (t === "Product" || (Array.isArray(t) && t.includes("Product"))) return node;
  if (node["@graph"]) return findProduct(node["@graph"]);
  return null;
}

const stripTags = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

// Paires <dt>label</dt><dd>valeur</dd> dédupliquées par label (MdM duplique mobile+desktop).
function extractSpecs(html: string): Record<string, string> {
  const specs: Record<string, string> = {};
  const re = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const k = stripTags(m[1]);
    const v = stripTags(m[2]);
    if (k && v && !(k in specs)) specs[k] = v;
  }
  return specs;
}

export type ExtractMeta = { merchant: string; category: string; external_id: string; product_url: string };

/** Retourne le produit normalisé, ou { error } si pas de JSON-LD Product / pas d'image. */
export function extractProduct(
  html: string,
  meta: ExtractMeta,
): PartnerProductInput | { error: string } {
  const blocks = parseJsonLdBlocks(html);
  const prod = blocks.map(findProduct).find(Boolean);
  if (!prod) {
    if (/captcha-delivery|datadome/i.test(html)) return { error: "datadome-block" };
    return { error: "no-product-ld" };
  }

  // Offers : objet ou tableau.
  let off = prod.offers;
  if (Array.isArray(off)) off = off[0] ?? {};
  off = off ?? {};
  const priceNum = Number(off.price ?? off.lowPrice ?? NaN);
  const availability = String(off.availability || "").includes("InStock") ? "available" : "unavailable";
  const seller = off.seller?.name ?? null;

  const images: string[] = (Array.isArray(prod.image) ? prod.image : [prod.image])
    .filter((x: unknown): x is string => typeof x === "string" && x.length > 0)
    .slice(0, 5);
  if (!images.length) return { error: "no-image" };

  const specs = extractSpecs(html);
  const dimParts = [
    specs["Longueur"] && `L ${specs["Longueur"]}`,
    specs["Hauteur"] && `H ${specs["Hauteur"]}`,
    specs["Profondeur"] && `P ${specs["Profondeur"]}`,
  ].filter(Boolean);
  const dimensions = dimParts.length ? dimParts.join(" × ") : specs["Dimensions hors tout"] || null;

  const name = stripTags(String(prod.name || ""));
  const placesM = name.match(/(\d+(?:[/-]\d+)?)\s*places?/i);

  return {
    merchant: meta.merchant,
    external_id: meta.external_id,
    category: meta.category,
    name: name.slice(0, 255),
    description: (typeof prod.description === "string" ? stripTags(prod.description) : "").slice(0, 2000) || undefined,
    price: Number.isFinite(priceNum) ? priceNum : null,
    currency: off.priceCurrency || "EUR",
    product_url: meta.product_url,
    affiliate_url: undefined, // MdM = Effinity, non câblé → clic retombe sur product_url
    image_urls: images,
    primary_image_url: images[0],
    source_type: "eco_new",
    attributes: {
      brand: (prod.brand?.name || prod.brand) ?? null,
      seller,
      couleur: specs["Couleur principale"] || null,
      matiere: specs["Matière principale"] || null,
      structure: specs["Matière de la structure"] || null,
      made_in: specs["Made in"] || null,
      dimensions,
      gtin: prod.gtin13 || prod.gtin || null,
      sku: prod.sku || null,
      places: placesM ? placesM[1] : null,
      convertible: /convertible|clic[- ]?clac|canap[ée]-?lit/i.test(`${name} ${meta.product_url}`),
      availability,
      platform: "effinity",
    },
  };
}
