#!/usr/bin/env npx tsx
/**
 * Dump LECTURE SEULE de l'audit confirm_changes d'un projet : candidats (élément AVANT),
 * results (changed/after/bbox), et ADDITIONS (net-new APRÈS). Sauve base+render pour
 * inspection visuelle. Ne persiste rien.
 * Usage : npx tsx scripts/audit-dump.ts <projectId>
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const NON_DETECTABLE = new Set(["ceiling", "door", "french_door", "window", "wall_opening"]);

async function main() {
  const projectId = process.argv[2];
  if (!projectId) { console.error("Usage: audit-dump <projectId>"); process.exit(1); }
  const { getProject } = await import("../lib/storage/projects");
  const { buildBeforeAfterComposite, confirmChanges, fetchImageBytes, computeRenderAdditions } = await import("../lib/ai/pipeline");
  const { getElementCategories } = await import("../lib/db/assets");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const project: any = await getProject(projectId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const decisions: any[] = project.element_decisions ?? [];
  const candidates = decisions.filter((d) => !NON_DETECTABLE.has(d.category));

  console.log(`\n=== ${projectId} (room=${project.roomType} style=${project.selectedStyleId}) ===`);
  console.log(`\n--- CANDIDATS (éléments détectés dans l'AVANT, ${candidates.length}) ---`);
  for (const d of decisions) {
    console.log(`  [${NON_DETECTABLE.has(d.category) ? "skip" : "cand"}] ${d.element_id} • ${d.category} • mismatch=${d.mismatch_type ?? "—"} • "${(d.description ?? "").slice(0, 50)}"`);
  }

  const outDir = path.join(process.cwd(), "scripts", "out");
  await mkdir(outDir, { recursive: true });
  const [base, render] = await Promise.all([
    fetchImageBytes(project.basePhotoUrl),
    fetchImageBytes(project.generatedRenderUrl),
  ]);
  await writeFile(path.join(outDir, "_base.jpg"), base);
  await writeFile(path.join(outDir, "_render.jpg"), render);
  console.log(`\nbase+render sauvés dans scripts/out/_base.jpg / _render.jpg`);

  const comp = await buildBeforeAfterComposite(project.basePhotoUrl, project.generatedRenderUrl);
  await writeFile(path.join(outDir, "_composite.jpg"), comp.buffer);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await confirmChanges(projectId, candidates as any, comp.buffer as any, comp.afterLeftFrac, comp.afterWidthFrac);

  console.log(`\n--- RESULTS (audit) : ${r.appliedIds.size} changés / ${r.judgedIds.size} jugés / ${r.bboxById.size} bbox ---`);
  for (const d of candidates) {
    const changed = r.appliedIds.has(d.element_id);
    const after = r.afterById.get(d.element_id);
    console.log(`  ${changed ? "CHANGÉ " : "garde  "} ${d.element_id} • ${d.category}${after ? ` → "${after.slice(0, 50)}"` : ""}`);
  }

  console.log(`\n--- [ANCIEN] ADDITIONS via prompt audit : ${r.additions.length} ---`);
  for (const a of r.additions) {
    console.log(`  + ${a.category} • "${(a.detail ?? a.element ?? "").slice(0, 60)}"`);
  }

  // NOUVEAU : inventaire complet du rendu réconcilié avec l'AVANT.
  const elementCategories = await getElementCategories().catch(() => []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const taxonomy = new Map((elementCategories as any[]).map((c) => [c.slug, c.catalog_category]));
  const newAdds = await computeRenderAdditions(projectId, project.generatedRenderUrl, project.roomType, candidates as any, taxonomy);
  console.log(`\n--- [NOUVEAU] ADDITIONS via inventaire rendu : ${newAdds.length} ---`);
  for (const a of newAdds) {
    console.log(`  + ${a.category} • "${(a.detail ?? a.element ?? "").slice(0, 60)}"`);
  }

  process.exit(0);
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
