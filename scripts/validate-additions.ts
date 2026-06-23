#!/usr/bin/env npx tsx
/**
 * Valide le fix CROP SUR LES AJOUTS (lecture seule) : pour un projet (typiquement pièce
 * vide), montre que les additions du rendu obtiennent maintenant une bbox → crop → match
 * IMAGE, vs l'ancien matching TEXTE SEUL. Sauve les crops pour inspection.
 *
 * Usage : npx tsx scripts/validate-additions.ts <projectId> [categories=sofa,coffee_table,rug]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { writeFile, mkdir } from "fs/promises";
import path from "path";

async function main() {
  const projectId = process.argv[2];
  const cats = (process.argv[3] || "sofa,coffee_table,rug").split(",");
  if (!projectId) { console.error("Usage: validate-additions <projectId> [cats]"); process.exit(1); }

  const { getProject } = await import("../lib/storage/projects");
  const { computeRenderAdditions, fetchImageBytes } = await import("../lib/ai/pipeline");
  const { getElementCategories } = await import("../lib/db/assets");
  const { extractCrop } = await import("../lib/shopping/crop");
  const { matchPartnerProductsBlendBatch, matchPartnerProducts } = await import("../lib/shopping/partnerMatch");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const project: any = await getProject(projectId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidates = (project.element_decisions ?? []).filter((d: any) => !["ceiling","door","french_door","window","wall_opening"].includes(d.category));
  const elementCategories = await getElementCategories().catch(() => []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const taxonomy = new Map((elementCategories as any[]).map((c) => [c.slug, c.catalog_category]));

  const adds = await computeRenderAdditions(projectId, project.generatedRenderUrl, project.roomType, candidates, taxonomy);
  console.log(`\n${adds.length} additions détectées. bbox présentes: ${adds.filter((a) => a.bbox).length}`);

  const renderBytes = await fetchImageBytes(project.generatedRenderUrl);
  const outDir = path.join(process.cwd(), "scripts", "out");
  await mkdir(outDir, { recursive: true });
  const fmt = (m: { name: string; similarity: number; simImage?: number; simText?: number; merchant: string }) =>
    `    ${m.similarity.toFixed(3)} [img=${m.simImage ?? "—"} txt=${m.simText ?? "—"}] ${m.merchant} ${m.name.slice(0, 46)}`;

  for (const cat of cats) {
    const a = adds.find((x) => x.category === cat);
    if (!a) { console.log(`\n[${cat}] aucune addition`); continue; }
    console.log(`\n────────── ${cat} : "${(a.detail || a.element || "").slice(0, 60)}"`);
    const crop = a.bbox ? await extractCrop(renderBytes, a.bbox) : null;
    if (crop) {
      const f = path.join(outDir, `add-${cat}.jpg`);
      await writeFile(f, crop);
      console.log(`  bbox ${JSON.stringify(a.bbox)} → crop ${f} (${crop.length} o)`);
    } else {
      console.log(`  pas de bbox → crop null`);
    }
    const desc = `${a.detail ?? ""} ${a.element ?? ""}`.trim();
    const withCrop = (await matchPartnerProductsBlendBatch([{ category: cat, description: desc, crop }], 3))[0] ?? [];
    const textOnly = await matchPartnerProducts(cat, desc, 3);
    console.log(`  ▸ NOUVEAU (crop+texte) :`); withCrop.forEach((m) => console.log(fmt(m)));
    if (!withCrop.length) console.log("    (aucun ≥ seuil)");
    console.log(`  ▸ ANCIEN (texte seul) :`); textOnly.forEach((m) => console.log(fmt(m)));
    if (!textOnly.length) console.log("    (vide)");
  }
  process.exit(0);
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
