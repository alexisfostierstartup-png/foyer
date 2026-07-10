#!/usr/bin/env npx tsx
/* eslint-disable */
/**
 * Scrape IKEA via Piloterr (/v2/ikea/product) pour les URLs sélectionnées dans Notion
 * (ikea-notion-todo.json) → PartnerProductInput → ikea-notion.json. 1 produit par URL
 * (la couleur précise choisie : on prend l'image de la variante dont l'id == external_id,
 * sinon images[0]). RÉSUMABLE (skip les ids déjà dans le json) + throttlé. Erreurs tolérées.
 *
 * Usage : npx tsx scripts/_ikea/scrape-ikea.ts [--limit=N] [--sleep=1200]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { readFileSync, writeFileSync, existsSync } from "fs";

const DIR = __dirname;
const TODO = `${DIR}/ikea-notion-todo.json`;
const OUT = `${DIR}/ikea-notion.json`;
const ERR = `${DIR}/ikea-notion.errors.json`;
const PILOTERR_BASE = "https://api.piloterr.com";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function piloterrGet(path: string, query: string): Promise<any> {
  const k = process.env.PILOTERR_API_KEY;
  if (!k) throw new Error("PILOTERR_API_KEY manquante");
  const url = new URL(`${PILOTERR_BASE}${path}`);
  url.searchParams.set("query", query);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { headers: { "x-api-key": k } });
    } catch (e) { lastErr = e; await sleep(2000 * (attempt + 1)); continue; }
    if (res.ok) return res.json();
    if (res.status < 500) throw new Error(`Piloterr ${path} → ${res.status} ${(await res.text().catch(() => "")).slice(0, 160)}`);
    lastErr = new Error(`Piloterr ${path} → ${res.status}`);
    await sleep(2000 * (attempt + 1));
  }
  throw lastErr instanceof Error ? lastErr : new Error("Piloterr échec");
}

// Nom lisible depuis le slug d'URL (la marque = 1er token en majuscules).
function nameFromSlug(url: string): string {
  let slug = (url.split("/p/")[1] ?? "").replace(/\/+$/, "").replace(/-s?\d{6,}$/, "");
  const words = slug.split("-").filter(Boolean);
  if (words[0]) words[0] = words[0].toUpperCase();
  return words.join(" ").slice(0, 255);
}

async function main() {
  const args = process.argv.slice(2);
  const limit = Number(args.find((a) => a.startsWith("--limit="))?.slice(8) ?? 0);
  const sleepMs = Number(args.find((a) => a.startsWith("--sleep="))?.slice(8) ?? 1200);

  const todo: { external_id: string; url: string; category: string }[] = JSON.parse(readFileSync(TODO, "utf8"));
  const out: any[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
  const errors: any[] = existsSync(ERR) ? JSON.parse(readFileSync(ERR, "utf8")) : [];
  const done = new Set(out.map((p) => p.external_id));
  const failed = new Set(errors.map((e) => e.external_id));

  const queue = todo.filter((t) => !done.has(t.external_id) && !failed.has(t.external_id));
  const slice = limit > 0 ? queue.slice(0, limit) : queue;
  console.log(`[scrape-ikea] todo=${todo.length} done=${done.size} failed=${failed.size} → à faire=${slice.length} (sleep ${sleepMs}ms)`);

  let n = 0, ok = 0, ko = 0;
  for (const t of slice) {
    n++;
    try {
      const d = await piloterrGet("/v2/ikea/product", t.url);
      const variants: any[] = Array.isArray(d?.variants) ? d.variants : [];
      const match = variants.find((v) => String(v?.id) === t.external_id);
      const img = match?.image || d?.images?.[0] || d?.image || null;
      if (!img) throw new Error("pas d'image");
      const colorLabel = (match?.name ?? "").trim();
      out.push({
        merchant: "ikea",
        external_id: t.external_id,
        category: t.category,
        name: nameFromSlug(t.url),
        description: `${colorLabel} ${d?.description ?? ""}`.trim().slice(0, 2000) || undefined,
        price: d?.price_amount != null ? Number(d.price_amount) : null,
        currency: "EUR",
        product_url: t.url,
        affiliate_url: undefined, // IKEA : pas de programme d'affiliation FR câblé
        image_urls: [img],
        primary_image_url: img,
        source_type: "eco_new",
        attributes: {
          brand: "IKEA", platform: "piloterr", color: colorLabel || undefined,
          dimensions: d?.dimensions ?? undefined, ikea_category: d?.category ?? undefined,
        },
      });
      ok++;
    } catch (e) {
      ko++;
      errors.push({ external_id: t.external_id, url: t.url, category: t.category, error: e instanceof Error ? e.message : String(e) });
    }
    if (n % 10 === 0 || n === slice.length) {
      writeFileSync(OUT, JSON.stringify(out, null, 2));
      writeFileSync(ERR, JSON.stringify(errors, null, 2));
      console.log(`  ${n}/${slice.length} · ok=${ok} ko=${ko} · total json=${out.length}`);
    }
    await sleep(sleepMs);
  }
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  writeFileSync(ERR, JSON.stringify(errors, null, 2));
  console.log(`✅ fini : +${ok} (json=${out.length}), erreurs +${ko} (total err=${errors.length})`);
  process.exit(0);
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
