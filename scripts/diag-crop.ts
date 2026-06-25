#!/usr/bin/env npx tsx
/**
 * DIAG crop (lecture seule) — investigue les edge cases d'extraction du RENDU.
 * Pour des catégories données : affiche la bbox, SAUVE le crop dans scripts/out/crop-<cat>.png,
 * et montre la réponse BRUTE de Gemini (texte + parsed). Révèle si le souci est le crop
 * (mauvaise région) ou l'extraction (Gemini). Ne persiste rien en base.
 *
 * Usage : npx tsx scripts/diag-crop.ts <projectId> [cats=tv_stand,floor,sofa]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { writeFileSync } from "node:fs";

const MODEL = "gemini-2.5-flash-lite";
const NON_DETECTABLE = new Set(["ceiling", "door", "french_door", "window", "wall_opening"]);

async function main() {
  const projectId = process.argv[2];
  const cats = (process.argv[3] ?? "tv_stand,floor,sofa").split(",");
  if (!projectId) { console.error("Usage: diag-crop <projectId> [cats]"); process.exit(1); }

  const { getProject } = await import("../lib/storage/projects");
  const { buildBeforeAfterComposite, confirmChanges, computeRenderAdditions, fetchImageBytes } = await import("../lib/ai/pipeline");
  const { getElementCategories } = await import("../lib/db/assets");
  const { extractCrop } = await import("../lib/shopping/crop");
  const { getVisionProvider } = await import("../lib/ai/provider");
  const { getSchemaV3, schemaForCategory, buildExtractionPrompt } = await import("../lib/shopping/attributeSchemaV3");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const project: any = await getProject(projectId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidates = (project.element_decisions ?? []).filter((d: any) => !NON_DETECTABLE.has(d.category));
  const renderBytes = await fetchImageBytes(project.generatedRenderUrl);

  const byCat = new Map<string, { bbox: { x: number; y: number; w: number; h: number }; desc: string; src: string }>();
  const comp = await buildBeforeAfterComposite(project.basePhotoUrl, project.generatedRenderUrl);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await confirmChanges(projectId, candidates as any, comp.buffer as any, comp.afterLeftFrac, comp.afterWidthFrac);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const d of candidates as any[]) { const b = r.bboxById.get(d.element_id); if (b) byCat.set(d.category, { bbox: b, desc: (r.afterById.get(d.element_id) || d.description || "").trim(), src: "audit" }); }
  const ecs = await getElementCategories().catch(() => []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const taxonomy = new Map((ecs as any[]).map((c) => [c.slug, c.catalog_category]));
  try {
    const adds = await computeRenderAdditions(projectId, project.generatedRenderUrl, project.roomType, candidates, taxonomy);
    for (const a of adds) if (a.bbox) byCat.set(a.category, { bbox: a.bbox, desc: (a.detail || a.element || "").trim(), src: "addition" });
  } catch (e) { console.log(`  (additions ignorées: ${(e as Error).message?.slice(0, 60)})`); }

  for (const cat of cats) {
    const entry = byCat.get(cat);
    console.log(`\n══════════ ${cat}`);
    if (!entry) { console.log("  (aucune bbox — pas candidat ni addition)"); continue; }
    const { x, y, w, h } = entry.bbox;
    console.log(`  source=${entry.src} · desc="${entry.desc}"`);
    console.log(`  bbox  x=${x.toFixed(3)} y=${y.toFixed(3)} w=${w.toFixed(3)} h=${h.toFixed(3)}  (aire=${(w * h).toFixed(3)})`);
    const crop = await extractCrop(renderBytes, entry.bbox);
    if (!crop) { console.log("  ⚠️ crop dégénéré (null)"); continue; }
    const path = `scripts/out/crop-${cat}.png`;
    writeFileSync(path, crop);
    console.log(`  crop sauvé → ${path} (${crop.length} octets)`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await getVisionProvider("gemini_vision").analyze(buildExtractionPrompt(getSchemaV3(schemaForCategory(cat))), [crop as any], { model: MODEL });
    console.log(`  Gemini brut: ${JSON.stringify(res.text).slice(0, 300)}`);
    console.log(`  parsed:      ${JSON.stringify(res.parsed)}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
