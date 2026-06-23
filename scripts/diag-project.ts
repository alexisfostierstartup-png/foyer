#!/usr/bin/env npx tsx
/**
 * Diagnostic complet d'un projet (lecture seule) : pour sofa/coffee_table/rug,
 *  - sauve le CROP (vérifier le cadrage),
 *  - classe le top-8 catalogue par COSINE IMAGE (sim_image/sim_text/blend),
 *  - localise un produit précis (option --find=<uuid>) : son rang image + ses cosines.
 *
 * Usage : npx tsx scripts/diag-project.ts <projectId> [cats=sofa,coffee_table,rug] [--find=uuid]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const NON_DETECTABLE = new Set(["ceiling", "door", "french_door", "window", "wall_opening"]);

async function main() {
  const args = process.argv.slice(2);
  const find = args.find((a) => a.startsWith("--find="))?.slice(7);
  const pos = args.filter((a) => !a.startsWith("--"));
  const projectId = pos[0];
  const cats = (pos[1] || "sofa,coffee_table,rug").split(",");
  if (!projectId) { console.error("Usage: diag-project <projectId> [cats] [--find=uuid]"); process.exit(1); }

  const { getProject } = await import("../lib/storage/projects");
  const { buildBeforeAfterComposite, confirmChanges, computeRenderAdditions, fetchImageBytes } = await import("../lib/ai/pipeline");
  const { getElementCategories } = await import("../lib/db/assets");
  const { extractCrop } = await import("../lib/shopping/crop");
  const { computeBatchImageEmbeddingsFromBytes, computeBatchTextEmbeddings } = await import("../lib/embeddings/jina");
  const { createSupabaseAdmin } = await import("../lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const project: any = await getProject(projectId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidates = (project.element_decisions ?? []).filter((d: any) => !NON_DETECTABLE.has(d.category));
  // bbox+desc par catégorie : candidats (audit) ET ajouts (inventaire rendu).
  const byCat = new Map<string, { bbox: { x: number; y: number; w: number; h: number }; desc: string }>();
  const comp = await buildBeforeAfterComposite(project.basePhotoUrl, project.generatedRenderUrl);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await confirmChanges(projectId, candidates as any, comp.buffer as any, comp.afterLeftFrac, comp.afterWidthFrac);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const d of candidates as any[]) {
    const b = r.bboxById.get(d.element_id);
    if (b) byCat.set(d.category, { bbox: b, desc: (r.afterById.get(d.element_id) || d.description || "").trim() });
  }
  const ecs = await getElementCategories().catch(() => []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const taxonomy = new Map((ecs as any[]).map((c) => [c.slug, c.catalog_category]));
  const adds = await computeRenderAdditions(projectId, project.generatedRenderUrl, project.roomType, candidates, taxonomy);
  for (const a of adds) if (a.bbox) byCat.set(a.category, { bbox: a.bbox, desc: (a.detail || a.element || "").trim() });
  const renderBytes = await fetchImageBytes(project.generatedRenderUrl);
  const sharp = (await import("sharp")).default;
  const meta = await sharp(renderBytes).metadata();
  console.log(`rendu: ${meta.width}×${meta.height}px`);
  const outDir = path.join(process.cwd(), "scripts", "out");
  await mkdir(outDir, { recursive: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createSupabaseAdmin() as any;

  for (const cat of cats) {
    const entry = byCat.get(cat);
    if (!entry) { console.log(`\n[${cat}] aucune bbox (ni candidat ni ajout)`); continue; }
    const { bbox, desc } = entry;
    const crop = await extractCrop(renderBytes, bbox);
    console.log(`\n══════════ ${cat} — "${desc.slice(0, 60)}"  bbox=${JSON.stringify(Object.fromEntries(Object.entries(bbox).map(([k, v]) => [k, +(+v).toFixed(2)])))}`);
    if (crop) { await writeFile(path.join(outDir, `dp-${cat}.jpg`), crop); console.log(`  crop → scripts/out/dp-${cat}.jpg`); }
    if (!crop) { console.log("  crop null"); continue; }
    const [cropEmb] = await computeBatchImageEmbeddingsFromBytes([crop]);
    const [descEmb] = await computeBatchTextEmbeddings([desc]);

    const { data } = await sb.rpc("match_partner_products_blend", {
      crop_embedding: cropEmb, desc_embedding: descEmb, match_category: cat, match_count: 400, w_eco_new: 1, w_secondhand: 1,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data ?? []) as any[];
    console.log(`  top-8 par cosine IMAGE (sur ${rows.length} candidats ${cat}) :`);
    for (const p of rows.slice(0, 8)) {
      console.log(`    img=${(+p.sim_image).toFixed(3)} txt=${(+p.sim_text).toFixed(3)} blend.7=${(0.7 * p.sim_image + 0.3 * p.sim_text).toFixed(3)} | ${p.merchant} ${String(p.name).slice(0, 44)}`);
    }
    if (find) {
      const idx = rows.findIndex((p) => p.id === find);
      if (idx >= 0) {
        const p = rows[idx];
        console.log(`  ▸ PRODUIT CIBLE (${find.slice(0, 8)}) rang IMAGE #${idx + 1}/${rows.length} : img=${(+p.sim_image).toFixed(3)} txt=${(+p.sim_text).toFixed(3)} | ${String(p.name).slice(0, 50)}`);
      } else console.log(`  ▸ PRODUIT CIBLE ${find.slice(0, 8)} : HORS top-400 ${cat}`);
    }
  }
  process.exit(0);
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
