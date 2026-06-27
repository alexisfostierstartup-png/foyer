#!/usr/bin/env npx tsx
/**
 * Scrape Maisons du Monde (canapés) via Bright Data Web Unlocker → mdm-sofas.json.
 * Parallèle (pool de concurrence), retries (fetchHtml), CHECKPOINT + REPRISE :
 * relancer ne refait QUE les external_id encore absents du JSON (Web Unlocker est lent
 * ~30-60s/req et coûte 1 req/succès sur le quota → on ne re-scrape jamais l'acquis).
 *
 * Usage :
 *   npx tsx scripts/_mdm/scrape-mdm.ts            # concurrence 6
 *   npx tsx scripts/_mdm/scrape-mdm.ts 8          # concurrence 8
 *   npx tsx scripts/_mdm/scrape-mdm.ts 6 --retry-errors   # re-tente seulement les échecs
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fetchHtml } from "../../lib/catalog/fetchHtml";
import { extractProduct } from "../../lib/catalog/jsonld-extract";
import type { PartnerProductInput } from "../../lib/catalog/types";

const DIR = "scripts/_mdm";
const URLS = `${DIR}/urls-unique.json`;
const OUT = `${DIR}/mdm-sofas.json`;
const ERR = `${DIR}/mdm-sofas.errors.json`;
const MERCHANT = "maisons_du_monde";
const CATEGORY = "sofa";

type UrlRow = { external_id: string; product_url: string };
const readJson = <T>(p: string, fallback: T): T => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback);

async function main() {
  const args = process.argv.slice(2);
  const concurrency = Number(args.find((a) => /^\d+$/.test(a)) ?? 6);
  const retryErrorsOnly = args.includes("--retry-errors");
  const limit = Number(args.find((a) => a.startsWith("--limit="))?.slice("--limit=".length) ?? Infinity);

  const urls: UrlRow[] = readJson(URLS, []);
  const results: PartnerProductInput[] = readJson(OUT, []);
  let errors: Array<UrlRow & { error: string }> = readJson(ERR, []);
  const done = new Set(results.map((r) => r.external_id));

  let todo = urls.filter((u) => !done.has(u.external_id));
  if (retryErrorsOnly) {
    const errIds = new Set(errors.map((e) => e.external_id));
    todo = todo.filter((u) => errIds.has(u.external_id));
  }
  if (Number.isFinite(limit)) todo = todo.slice(0, limit);
  errors = []; // recomputé pour ce run

  console.log(
    `[scrape-mdm] ${urls.length} URLs | ${done.size} déjà faits | ${todo.length} à scraper | concurrence ${concurrency}`,
  );
  if (!todo.length) {
    console.log("✅ Rien à faire — tout est déjà scrapé.");
    return;
  }

  let idx = 0,
    completed = 0,
    ok = 0;
  const flush = () => {
    writeFileSync(OUT, JSON.stringify(results, null, 2));
    writeFileSync(ERR, JSON.stringify(errors, null, 2));
  };

  async function worker() {
    while (idx < todo.length) {
      const it = todo[idx++];
      try {
        const { status, html, ms } = await fetchHtml(it.product_url, { retries: 3 });
        if (status !== 200) {
          errors.push({ ...it, error: `http ${status}` });
        } else {
          const p = extractProduct(html, { merchant: MERCHANT, category: CATEGORY, ...it });
          if ("error" in p) {
            errors.push({ ...it, error: p.error });
          } else {
            results.push(p);
            ok++;
            console.log(`  ✓ ${it.external_id} ${Math.round(ms / 1000)}s — ${p.name.slice(0, 50)} — ${p.price ?? "?"}€`);
          }
        }
      } catch (e) {
        errors.push({ ...it, error: String(e instanceof Error ? e.message : e).slice(0, 140) });
        console.log(`  ✗ ${it.external_id} — ${String(e instanceof Error ? e.message : e).slice(0, 80)}`);
      }
      completed++;
      if (completed % 5 === 0) {
        flush();
        console.log(`[scrape-mdm] ${completed}/${todo.length} (ok=${ok}, err=${errors.length})`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, worker));
  flush();
  console.log(`\n✅ Terminé. Total scrapés: ${results.length}/${urls.length} | échecs ce run: ${errors.length}`);
  if (errors.length) console.log(`   Re-tenter: npx tsx scripts/_mdm/scrape-mdm.ts ${concurrency} --retry-errors`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
