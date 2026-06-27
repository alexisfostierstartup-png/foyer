#!/usr/bin/env npx tsx
/**
 * Diagnostic LECTURE SEULE de l'embedding/matching pour UN élément d'un projet :
 *  - effet du CADRAGE : cosine image crop SERRÉ vs crop LÂCHE (rendu entier),
 *  - plafond cross-domaine : meilleur cosine image atteignable (crop rendu vs photo catalogue),
 *  - effet du POIDS w : séparation bon/mauvais produit à w ∈ {0.5, 0.7, 0.85}.
 *
 * Usage : npx tsx scripts/diag-embedding.ts <projectId> <category>
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const NON_DETECTABLE = new Set(["ceiling", "door", "french_door", "window", "wall_opening"]);

async function main() {
  const projectId = process.argv[2];
  const category = process.argv[3];
  if (!projectId || !category) { console.error("Usage: diag-embedding <projectId> <category>"); process.exit(1); }

  const { getProject } = await import("../lib/storage/projects");
  const { buildBeforeAfterComposite, confirmChanges, fetchImageBytes } = await import("../lib/ai/pipeline");
  const { extractCrop } = await import("../lib/shopping/crop");
  const { computeBatchImageEmbeddingsFromBytes, computeBatchTextEmbeddings } = await import("../lib/embeddings/jina");
  const { createSupabaseAdmin } = await import("../lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const project: any = await getProject(projectId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidates = (project.element_decisions ?? []).filter((d: any) => !NON_DETECTABLE.has(d.category));

  const comp = await buildBeforeAfterComposite(project.basePhotoUrl, project.generatedRenderUrl);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await confirmChanges(projectId, candidates as any, comp.buffer as any, comp.afterLeftFrac, comp.afterWidthFrac);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const el = candidates.find((d: any) => d.category === category && r.bboxById.has(d.element_id));
  if (!el) { console.error(`Aucun élément '${category}' avec bbox dans ce projet.`); process.exit(1); }
  const bbox = r.bboxById.get(el.element_id)!;
  const desc = (r.afterById.get(el.element_id) || el.description || "").trim();
  console.log(`\nÉlément ${el.element_id} (${category}) — "${desc.slice(0, 60)}"`);
  console.log(`bbox: x=${bbox.x.toFixed(2)} y=${bbox.y.toFixed(2)} w=${bbox.w.toFixed(2)} h=${bbox.h.toFixed(2)}`);

  const renderBytes = await fetchImageBytes(project.generatedRenderUrl);
  const tight = await extractCrop(renderBytes, bbox);
  if (!tight) { console.error("crop serré null"); process.exit(1); }
  // crop LÂCHE = rendu entier (simule une bbox pleine image / scène polluée).
  const [tightEmb, looseEmb] = await computeBatchImageEmbeddingsFromBytes([tight, renderBytes]);
  const [descEmb] = await computeBatchTextEmbeddings([desc]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createSupabaseAdmin() as any;
  const rank = async (cropEmb: number[]) => {
    const { data } = await sb.rpc("match_partner_products_blend", {
      crop_embedding: cropEmb, desc_embedding: descEmb, match_category: category, match_count: 8, w_eco_new: 1, w_secondhand: 1,
    });
    return (data ?? []) as Array<{ name: string; merchant: string; sim_image: number; sim_text: number }>;
  };

  const tightRanked = await rank(tightEmb);
  const looseRanked = await rank(looseEmb);
  const blend = (img: number, txt: number, w: number) => (w * img + (1 - w) * txt).toFixed(3);

  console.log(`\n=== Top-8 par COSINE IMAGE (crop serré) — plafond cross-domaine + effet de w ===`);
  console.log(`  img    txt   | w.5  w.7  w.85 | produit`);
  for (const p of tightRanked) {
    console.log(`  ${p.sim_image.toFixed(3)}  ${p.sim_text.toFixed(3)} | ${blend(p.sim_image, p.sim_text, 0.5)} ${blend(p.sim_image, p.sim_text, 0.7)} ${blend(p.sim_image, p.sim_text, 0.85)} | ${p.merchant} ${p.name.slice(0, 48)}`);
  }

  const top = tightRanked[0];
  const looseTop = looseRanked.find((x) => x.name === top?.name);
  console.log(`\n=== Effet du CADRAGE sur le top-1 (${top?.name.slice(0, 40)}) ===`);
  console.log(`  crop SERRÉ : cos_image = ${top?.sim_image.toFixed(3)}`);
  console.log(`  rendu ENTIER (lâche) : cos_image = ${looseTop ? looseTop.sim_image.toFixed(3) : "hors top-8"}  ← pollution scène`);

  const best = tightRanked[0], worst = tightRanked[tightRanked.length - 1];
  console.log(`\n=== Séparation bon/mauvais selon w (top-1 vs dernier du top-8) ===`);
  for (const w of [0.5, 0.7, 0.85]) {
    const g = (w * best.sim_image + (1 - w) * best.sim_text) - (w * worst.sim_image + (1 - w) * worst.sim_text);
    console.log(`  w=${w} : top1=${blend(best.sim_image, best.sim_text, w)}  dernier=${blend(worst.sim_image, worst.sim_text, w)}  écart=${g.toFixed(3)}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
