#!/usr/bin/env npx tsx
/**
 * Validation ÉTAPE 5 du matching blend (crop image + description texte).
 * LECTURE SEULE : ne persiste RIEN (n'appelle jamais updateProject) → ne touche pas
 * les projets. Pour 3-4 éléments changés d'un projet réel :
 *   - extrait le CROP du rendu (sauvé dans scripts/out/ pour vérifier le cadrage),
 *   - top-3 BLEND (score + cosines image/texte décomposés),
 *   - top-3 TEXTE-SEUL (ancien matching hybrid) en comparaison.
 *
 * Usage : npx tsx scripts/validate-blend.ts <projectId> [maxElements=4]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const NON_DETECTABLE = new Set(["ceiling", "door", "french_door", "window", "wall_opening"]);

async function main() {
  const projectId = process.argv[2];
  const maxEl = Number(process.argv[3] ?? 4);
  if (!projectId) {
    console.error("Usage: npx tsx scripts/validate-blend.ts <projectId> [maxElements]");
    process.exit(1);
  }

  const { getProject } = await import("../lib/storage/projects");
  const { buildBeforeAfterComposite, confirmChanges, fetchImageBytes } = await import("../lib/ai/pipeline");
  const { extractCrop } = await import("../lib/shopping/crop");
  const { matchPartnerProductsBlendBatch, matchFloorProductsBlend, matchPartnerProducts } = await import("../lib/shopping/partnerMatch");
  const { getMatchingWeights } = await import("../lib/shopping/matchingConfig");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const project: any = await getProject(projectId);
  if (!project?.generatedRenderUrl || !project?.basePhotoUrl) {
    console.error("Projet sans rendu/photo de base."); process.exit(1);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const decisions: any[] = project.element_decisions ?? [];
  const candidates = decisions.filter((d) => !NON_DETECTABLE.has(d.category));

  console.log(`\n=== Projet ${projectId} (style ${project.selectedStyleId}) — ${candidates.length} candidats ===`);

  // 1. Audit RÉEL → bboxes (chemin de prod : composite AVANT|APRÈS + confirm_changes v2).
  const comp = await buildBeforeAfterComposite(project.basePhotoUrl, project.generatedRenderUrl);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await confirmChanges(projectId, candidates as any, comp.buffer as any, comp.afterLeftFrac, comp.afterWidthFrac);
  console.log(`Audit : ${r.appliedIds.size} changés, ${r.bboxById.size} bboxes émises.`);
  console.log(`Géométrie APRÈS dans le composite : leftFrac=${comp.afterLeftFrac.toFixed(3)} widthFrac=${comp.afterWidthFrac.toFixed(3)}`);

  const renderBytes = await fetchImageBytes(project.generatedRenderUrl);

  // 2. Sélection : éléments CHANGÉS avec bbox.
  const picked = candidates
    .filter((d) => r.appliedIds.has(d.element_id) && r.bboxById.has(d.element_id))
    .slice(0, maxEl);
  if (picked.length === 0) {
    console.log("Aucun élément changé avec bbox — rien à valider (le rendu n'a peut-être rien changé de shoppable).");
    process.exit(0);
  }

  const outDir = path.join(process.cwd(), "scripts", "out");
  await mkdir(outDir, { recursive: true });

  const fmt = (m: { name: string; similarity: number; source_type: string; merchant: string; simImage?: number; simText?: number }) =>
    `    ${m.similarity.toFixed(3)}  [img=${m.simImage ?? "—"} txt=${m.simText ?? "—"}]  ${m.source_type}/${m.merchant}  ${m.name.slice(0, 60)}`;

  for (const d of picked) {
    const bbox = r.bboxById.get(d.element_id)!;
    const desc = (r.afterById.get(d.element_id) || d.description || d.element || "").trim();
    const w = await getMatchingWeights(d.category === "floor" ? "floor" : "default");
    console.log(`\n──────────────────────────────────────────────────────────`);
    console.log(`Élément ${d.element_id} • catégorie=${d.category}`);
    console.log(`  desc(APRÈS) : "${desc.slice(0, 80)}"`);
    console.log(`  bbox(rendu, 0-1) : x=${bbox.x.toFixed(3)} y=${bbox.y.toFixed(3)} w=${bbox.w.toFixed(3)} h=${bbox.h.toFixed(3)}`);
    console.log(`  poids : image_weight eco_new=${w.image_weight.eco_new} secondhand=${w.image_weight.secondhand}`);

    const crop = await extractCrop(renderBytes, bbox);
    if (crop) {
      const f = path.join(outDir, `crop-${d.category}-${d.element_id}.jpg`);
      await writeFile(f, crop);
      console.log(`  crop : ${f} (${crop.length} o) — VÉRIFIER LE CADRAGE`);
    } else {
      console.log(`  crop : null (bbox dégénérée) → texte seul`);
    }

    // SOL → chemin réel matchFloorProductsBlend (blend + filtre matériau). Sinon batch générique.
    const blend = d.category === "floor"
      ? await matchFloorProductsBlend(desc, crop, 3)
      : ((await matchPartnerProductsBlendBatch([{ category: d.category, description: desc, crop }], 3))[0] ?? []);
    const textOnly = await matchPartnerProducts(d.category, desc, 3);

    console.log(`  ▸ BLEND (crop+texte) top-3 :`);
    blend.forEach((m) => console.log(fmt(m)));
    if (!blend.length) console.log("    (aucun au-dessus du seuil → 'À sourcer')");
    console.log(`  ▸ TEXTE-SEUL (ancien hybrid) top-3 :`);
    textOnly.forEach((m) => console.log(fmt(m)));
    if (!textOnly.length) console.log("    (vide)");
  }

  console.log(`\n=== fin ===`);
  process.exit(0);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
