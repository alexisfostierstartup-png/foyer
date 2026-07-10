#!/usr/bin/env npx tsx
/**
 * Vérifie lib/catalog/effinity-category-map.ts contre scripts/_import7/full-categories.json
 * (tous les chemins distincts réels, sans filtre). Rapporte : total mappé par catégorie
 * Foyer, et les chemins NON mappés avec un volume notable (>=5) — pour vérifier qu'on
 * n'écarte rien d'important par erreur.
 */
import { readFileSync } from "fs";
import { resolveEffinityCategory } from "../../lib/catalog/effinity-category-map";

type Manifest = Record<string, { total: number; paths: [string, number][] }>;

function main() {
  const manifest: Manifest = JSON.parse(readFileSync("scripts/_import7/full-categories.json", "utf8"));
  const only = process.argv[2];

  const globalMapped = new Map<string, number>();
  let globalUnmapped = 0;
  let globalTotal = 0;

  for (const [brand, { total, paths }] of Object.entries(manifest)) {
    if (only && brand !== only) continue;
    const mapped = new Map<string, number>();
    const unmapped: [string, number][] = [];
    for (const [path, count] of paths) {
      const cat = resolveEffinityCategory(path);
      globalTotal += count;
      if (cat) {
        mapped.set(cat, (mapped.get(cat) ?? 0) + count);
        globalMapped.set(cat, (globalMapped.get(cat) ?? 0) + count);
      } else {
        unmapped.push([path, count]);
        globalUnmapped += count;
      }
    }
    const mappedTotal = [...mapped.values()].reduce((a, b) => a + b, 0);
    console.log(`\n=== ${brand} — ${total} lignes total, ${mappedTotal} mappées (${((mappedTotal / total) * 100).toFixed(1)}%) ===`);
    console.log("Par catégorie:", [...mapped.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}=${n}`).join(", "));
    const notable = unmapped.filter(([, n]) => n >= 5).sort((a, b) => b[1] - a[1]);
    console.log(`Non mappés notables (>=5, ${notable.length} chemins) :`);
    for (const [path, n] of notable.slice(0, 60)) console.log(`  ${n.toString().padStart(6)}  ${path}`);
  }

  if (!only) {
    console.log(`\n\n=== TOTAL GLOBAL ===`);
    console.log(`${globalTotal} lignes, ${globalTotal - globalUnmapped} mappées, ${globalUnmapped} non mappées`);
    console.log([...globalMapped.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}=${n}`).join("\n"));
  }
}

main();
