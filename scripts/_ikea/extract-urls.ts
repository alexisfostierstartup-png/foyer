#!/usr/bin/env npx tsx
/* eslint-disable */
/**
 * Parse les blocs Notion (notion-raw*.ts) → {external_id, url, category} dédupliqués
 * (global, par external_id ; 1er vu gagne). Écrit ikea-notion-urls.json + rapport.
 * Gratuit (aucune API). Les collisions inter-catégories sont loguées.
 */
import { writeFileSync } from "fs";
import { RAW } from "./notion-raw";
import { RAW2 } from "./notion-raw-2";
import { RAW3 } from "./notion-raw-3";

const ALL: Record<string, string> = { ...RAW, ...RAW2, ...RAW3 };

// id IKEA = dernier segment du slug : digits OU s+digits (combos). On strip #content / slash.
function externalId(url: string): string | null {
  const clean = url.split("#")[0].replace(/\/+$/, "");
  const slug = clean.split("/p/")[1] ?? "";
  const m = slug.match(/-(s?\d{6,})$/);
  return m ? m[1] : null;
}
function normalize(url: string): string {
  return url.split("#")[0].replace(/\/+$/, "") + "/";
}

const seen = new Map<string, string>(); // external_id → category (1er vu)
const out: { external_id: string; url: string; category: string }[] = [];
const collisions: string[] = [];
const perCat: Record<string, number> = {};
let badId = 0;

for (const [category, block] of Object.entries(ALL)) {
  const urls = (block.match(/https:\/\/www\.ikea\.com\/[^\s)\]]+/g) ?? []);
  for (const raw of urls) {
    const id = externalId(raw);
    if (!id) { badId++; console.warn("  [no-id]", raw); continue; }
    if (seen.has(id)) {
      if (seen.get(id) !== category) collisions.push(`${id}: ${seen.get(id)} ⟂ ${category}`);
      continue;
    }
    seen.set(id, category);
    out.push({ external_id: id, url: normalize(raw), category });
    perCat[category] = (perCat[category] ?? 0) + 1;
  }
}

const outPath = `${__dirname}/ikea-notion-urls.json`;
writeFileSync(outPath, JSON.stringify(out, null, 2));

console.log("=== Produits uniques par catégorie ===");
for (const [c, n] of Object.entries(perCat).sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)}  ${c}`);
console.log(`----\nTOTAL unique: ${out.length}  (ids invalides: ${badId})`);
console.log(`\nCollisions inter-catégories (1er gagne) : ${collisions.length}`);
collisions.slice(0, 30).forEach((c) => console.log("  " + c));
console.log(`\n→ ${outPath}`);
