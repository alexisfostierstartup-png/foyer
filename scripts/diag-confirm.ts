#!/usr/bin/env npx tsx
/**
 * VALIDATION Étape 2 (lecture seule, ne mute rien) — exerce le VRAI chemin de prod :
 *   1. confirmChanges (prompt confirm_changes MODIFIÉ) → vérifie que `attrs` est émis par élément ;
 *   2. matchPartnerProductsBlendBatch (matcher AVEC re-rank structuré) → montre structScore + rang.
 *
 * Usage : npx tsx scripts/diag-confirm.ts <projectId>
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const NON_DETECTABLE = new Set(["ceiling", "door", "french_door", "window", "wall_opening"]);

async function main() {
  const projectId = process.argv[2];
  if (!projectId) { console.error("Usage: diag-confirm <projectId>"); process.exit(1); }

  const { getProject } = await import("../lib/storage/projects");
  const { buildBeforeAfterComposite, confirmChanges, fetchImageBytes } = await import("../lib/ai/pipeline");
  const { extractCrop } = await import("../lib/shopping/crop");
  const { matchPartnerProductsBlendBatch } = await import("../lib/shopping/partnerMatch");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const project: any = await getProject(projectId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidates = (project.element_decisions ?? []).filter((d: any) => !NON_DETECTABLE.has(d.category));

  const comp = await buildBeforeAfterComposite(project.basePhotoUrl, project.generatedRenderUrl);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await confirmChanges(projectId, candidates as any, comp.buffer as any, comp.afterLeftFrac, comp.afterWidthFrac);

  console.log(`\n===== A1 : attrs émis par confirm_changes (${r.attrsById.size} éléments) =====`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byId = new Map((candidates as any[]).map((d) => [d.element_id, d]));
  for (const [eid, attrs] of r.attrsById) {
    const d = byId.get(eid);
    console.log(`  ${String(d?.category ?? "?").padEnd(13)} ${JSON.stringify(attrs)}`);
  }
  if (r.attrsById.size === 0) { console.log("  ⚠️ AUCUN attrs émis — le prompt n'a pas renvoyé le champ."); process.exit(0); }

  // A3 : matcher avec re-rank structuré sur quelques éléments shoppables.
  const renderBytes = await fetchImageBytes(project.generatedRenderUrl);
  const SHOP = new Set(["sofa", "armchair", "chair", "coffee_table", "side_table", "rug", "tv_stand", "bookshelf", "dresser"]);
  const items: { eid: string; category: string; description: string; crop: Buffer | null; attrs: Record<string, unknown> }[] = [];
  for (const [eid, attrs] of r.attrsById) {
    const d = byId.get(eid);
    if (!d || !SHOP.has(d.category)) continue;
    const box = r.bboxById.get(eid);
    const crop = box ? await extractCrop(renderBytes, box) : null;
    items.push({ eid, category: d.category, description: (r.afterById.get(eid) || d.description || "").trim(), crop, attrs });
  }
  console.log(`\n===== A3 : matcher avec re-rank structuré (${items.length} éléments) =====`);
  const results = await matchPartnerProductsBlendBatch(items.map((it) => ({ category: it.category, description: it.description, crop: it.crop, attrs: it.attrs })), 5);
  items.forEach((it, i) => {
    console.log(`\n  ── ${it.category} — attrs rendu: ${JSON.stringify(it.attrs)}`);
    for (const m of results[i] ?? []) {
      const ss = m.structScore != null ? `struct=${m.structScore.toFixed(2)}` : "struct=—";
      console.log(`     sim=${m.similarity.toFixed(3)} ${ss} | ${m.merchant} ${String(m.name).slice(0, 42)}`);
    }
  });
  process.exit(0);
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
