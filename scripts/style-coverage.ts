#!/usr/bin/env npx tsx
/**
 * DASHBOARD DES TROUS CATALOGUE — matrice de couverture style × catégorie basée
 * sur les tags CORE (partner_products.style_affinity). Un produit "core" incarne
 * le style : c'est la couverture crédible, pas la compatibilité molle.
 *
 * Sortie : bench/style-coverage.html (heatmap séquentielle, comptes visibles,
 * zéros = trous marqués). Relançable à volonté (lecture seule).
 *
 * Usage : npx tsx scripts/style-coverage.ts [--min-products=30]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { readFile, writeFile } from "fs/promises";
import path from "path";

async function main() {
  const { createSupabaseAdmin } = await import("../lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createSupabaseAdmin() as any;

  const stylesJson = JSON.parse(await readFile(path.join(process.cwd(), "data/styles.json"), "utf8"));
  const styles: string[] = (Array.isArray(stylesJson) ? stylesJson : stylesJson.styles).map((s: { slug: string }) => s.slug);

  // Pagination (Supabase plafonne à 1000 lignes par SELECT).
  const rows: { category: string; style_affinity: string[] | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data: page, error } = await sb
      .from("partner_products")
      .select("category, style_affinity")
      .not("primary_image_url", "is", null)
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(page ?? []));
    if (!page || page.length < 1000) break;
  }
  const totalByCat = new Map<string, number>();
  const taggedByCat = new Map<string, number>();
  const cell = new Map<string, number>(); // `${style}|${cat}`
  for (const p of rows) {
    totalByCat.set(p.category, (totalByCat.get(p.category) ?? 0) + 1);
    const tags = p.style_affinity ?? [];
    if (tags.length > 0) taggedByCat.set(p.category, (taggedByCat.get(p.category) ?? 0) + 1);
    for (const s of tags) cell.set(`${s}|${p.category}`, (cell.get(`${s}|${p.category}`) ?? 0) + 1);
  }
  const minProducts = Number(process.argv.find((a) => a.startsWith("--min-products="))?.slice(15) ?? 30);
  const cats = [...totalByCat.entries()].filter(([, n]) => n >= minProducts).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const taggedTotal = rows.filter((r) => (r.style_affinity ?? []).length > 0).length;

  const styleTotals = new Map<string, number>();
  for (const s of styles) styleTotals.set(s, cats.reduce((a, c) => a + (cell.get(`${s}|${c}`) ?? 0), 0));
  const sortedStyles = [...styles].sort((a, b) => (styleTotals.get(b) ?? 0) - (styleTotals.get(a) ?? 0));

  // Échelle séquentielle mono-teinte (sauge — cohérente avec la charte des rapports) :
  // interpolation de la légèreté sur échelle LOG (les comptes sont très asymétriques).
  const maxCell = Math.max(1, ...cell.values());
  const bg = (n: number): string => {
    if (n === 0) return "transparent";
    const t = Math.log(1 + n) / Math.log(1 + maxCell); // 0..1
    const light = 94 - t * 52; // 94% → 42%
    return `hsl(140 22% ${light}%)`;
  };
  const ink = (n: number): string => (Math.log(1 + n) / Math.log(1 + maxCell) > 0.55 ? "var(--cell-ink-inv)" : "var(--ink)");

  const header = cats.map((c) => `<th class="rot"><div>${c.replace(/_/g, " ")}</div></th>`).join("");
  const body = sortedStyles.map((s) => {
    const cells = cats.map((c) => {
      const n = cell.get(`${s}|${c}`) ?? 0;
      return n === 0
        ? `<td class="zero" title="${s} × ${c} : aucun produit core">0</td>`
        : `<td style="background:${bg(n)};color:${ink(n)}" title="${s} × ${c} : ${n} produit(s) core">${n}</td>`;
    }).join("");
    return `<tr><th class="row">${s}</th>${cells}<td class="tot">${styleTotals.get(s)}</td></tr>`;
  }).join("\n");
  const footer = cats.map((c) => `<td class="tot">${taggedByCat.get(c) ?? 0}<span class="sub">/${totalByCat.get(c)}</span></td>`).join("");

  const html = `<!doctype html><meta charset="utf-8"><title>Foyer — couverture catalogue par style</title>
<style>
:root{--ground:#FBF9F6;--ink:#26221C;--ink2:#6B6459;--hair:#E5E0D7;--cell-ink-inv:#F6F4EF;--zero:#B4423A}
@media (prefers-color-scheme: dark){:root{--ground:#1C1A15;--ink:#EDE9E1;--ink2:#A29A8C;--hair:#38342B;--cell-ink-inv:#F6F4EF;--zero:#D97B72}}
body{background:var(--ground);color:var(--ink);font:13.5px/1.45 "Avenir Next","Helvetica Neue",Arial,sans-serif;margin:28px;}
h1{font-size:22px;margin:0 0 4px}.meta{color:var(--ink2);margin-bottom:20px;font-size:13px}
.scroll{overflow-x:auto}
table{border-collapse:collapse;font-variant-numeric:tabular-nums}
td,th{padding:5px 9px;text-align:right;border:1px solid var(--hair);min-width:34px}
th.row{text-align:left;font-weight:600;position:sticky;left:0;background:var(--ground)}
th.rot{height:110px;vertical-align:bottom;padding:4px}
th.rot div{writing-mode:vertical-rl;transform:rotate(200grad);white-space:nowrap;font-weight:600;color:var(--ink2);font-size:12px}
td.zero{color:var(--zero);font-weight:700;outline:1.5px dashed var(--zero);outline-offset:-3px}
td.tot,tr.totrow td{font-weight:700;background:none}
.sub{color:var(--ink2);font-weight:400;font-size:11px}
.legend{margin-top:14px;color:var(--ink2);font-size:12.5px;display:flex;gap:18px;align-items:center}
.sw{display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:-2px;margin-right:5px}
</style>
<h1>Couverture catalogue par style — tags core</h1>
<div class="meta">${taggedTotal} produits taggés core sur ${rows.length} · catégories ≥ ${minProducts} produits · généré le ${new Date().toISOString().slice(0, 16).replace("T", " ")} · relancer : <code>npx tsx scripts/style-coverage.ts</code></div>
<div class="scroll">
<table>
<tr><th></th>${header}<th class="rot"><div>TOTAL style</div></th></tr>
${body}
<tr class="totrow"><th class="row">taggés / total cat.</th>${footer}<td></td></tr>
</table>
</div>
<div class="legend">
<span><span class="sw" style="background:hsl(140 22% 88%)"></span>peu</span>
<span><span class="sw" style="background:hsl(140 22% 65%)"></span>moyen</span>
<span><span class="sw" style="background:hsl(140 22% 44%)"></span>beaucoup (échelle log)</span>
<span style="color:var(--zero);font-weight:600">0 = trou (aucun produit qui incarne le style)</span>
</div>`;

  const out = path.join(process.cwd(), "bench/style-coverage.html");
  await writeFile(out, html);
  console.log(`✅ ${out} — ${taggedTotal}/${rows.length} produits core-taggés, ${cats.length} catégories, max cellule ${maxCell}`);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
