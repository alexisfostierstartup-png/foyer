#!/usr/bin/env npx tsx
/**
 * DIAG Étape 2 (lecture seule) — montre ce que donnerait le matching avec le SCORE
 * STRUCTURÉ sur un vrai projet. Pour chaque meuble du rendu : attrs extraits du rendu
 * (flash-lite) comparés aux attrs DÉJÀ STOCKÉS des produits candidats (gratuit), score
 * structuré (coverage-aware, ΔE couleur), combiné image+structuré, et classement
 * AVANT (blend actuel) vs APRÈS (combiné). Ne persiste rien.
 *
 * Usage : npx tsx scripts/diag-struct.ts <projectId> [cats]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const MODEL = "gemini-2.5-flash-lite";
const NON_DETECTABLE = new Set(["ceiling", "door", "french_door", "window", "wall_opening"]);

// Poids par attribut (miroir Notion, renorm coverage-aware) + poids image w par catégorie.
const WEIGHTS: Record<string, Record<string, number>> = {
  sofa: { seats: 20, configuration: 20, color: 25, upholstery: 15, legs_type: 12, legs_material: 8 },
  armchair: { shape: 35, color: 22, upholstery: 18, legs_type: 10, armrests: 15 },
  chair: { shape: 35, color: 25, material: 20, legs_type: 10, armrests: 10 },
  coffee_table: { shape: 30, top_material: 20, top_color: 15, legs_material: 15, legs_type: 15, storage: 5 },
  side_table: { shape: 30, top_material: 25, top_color: 25, legs_type: 20 },
  rug: { pattern: 30, color: 25, weave: 20, shape: 15 },
  tv_stand: { shape: 25, color: 25, material: 20, storage: 15, legs: 15 },
  bookshelf: { shape: 35, color: 20, material: 20, structure: 15, mount: 10 },
  dresser: { shape: 20, color: 25, material: 20, drawers: 20, legs: 15 },
  floor_material: { type: 40, color: 30, pattern: 20, finish: 10 },
  floor_lamp: { structure: 25, shade_type: 25, base_shape: 15, base_finish: 20, color: 15 },
  pendant_lamp: { shape: 35, shade_material: 25, color: 25, finish: 15 },
  default: { color: 45, material: 30, shape: 25 },
};
const W_IMAGE: Record<string, number> = { sofa: 0.45, armchair: 0.55, chair: 0.55, coffee_table: 0.5, side_table: 0.55, rug: 0.6, tv_stand: 0.45, bookshelf: 0.45, dresser: 0.45, floor_material: 0.55, floor_lamp: 0.55, pendant_lamp: 0.6, default: 0.55 };

async function main() {
  const projectId = process.argv[2];
  const catsArg = process.argv[3];
  if (!projectId) { console.error("Usage: diag-struct <projectId> [cats]"); process.exit(1); }

  const { getProject } = await import("../lib/storage/projects");
  const { buildBeforeAfterComposite, confirmChanges, computeRenderAdditions, fetchImageBytes } = await import("../lib/ai/pipeline");
  const { getElementCategories } = await import("../lib/db/assets");
  const { extractCrop } = await import("../lib/shopping/crop");
  const { computeBatchImageEmbeddingsFromBytes, computeBatchTextEmbeddings } = await import("../lib/embeddings/jina");
  const { getVisionProvider } = await import("../lib/ai/provider");
  const { getSchemaV3, schemaForCategory, buildExtractionPrompt } = await import("../lib/shopping/attributeSchemaV3");
  const { createSupabaseAdmin } = await import("../lib/supabase/server");
  const { hexToLab, deltaE } = await import("../lib/color");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const project: any = await getProject(projectId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidates = (project.element_decisions ?? []).filter((d: any) => !NON_DETECTABLE.has(d.category));
  const renderBytes = await fetchImageBytes(project.generatedRenderUrl);

  const byCat = new Map<string, { bbox: { x: number; y: number; w: number; h: number }; desc: string }>();
  const comp = await buildBeforeAfterComposite(project.basePhotoUrl, project.generatedRenderUrl);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await confirmChanges(projectId, candidates as any, comp.buffer as any, comp.afterLeftFrac, comp.afterWidthFrac);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const d of candidates as any[]) { const b = r.bboxById.get(d.element_id); if (b) byCat.set(d.category, { bbox: b, desc: (r.afterById.get(d.element_id) || d.description || "").trim() }); }
  const ecs = await getElementCategories().catch(() => []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const taxonomy = new Map((ecs as any[]).map((c) => [c.slug, c.catalog_category]));
  const adds = await computeRenderAdditions(projectId, project.generatedRenderUrl, project.roomType, candidates, taxonomy);
  for (const a of adds) if (a.bbox) byCat.set(a.category, { bbox: a.bbox, desc: (a.detail || a.element || "").trim() });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createSupabaseAdmin() as any;
  const cats = catsArg ? catsArg.split(",") : [...byCat.keys()];

  const structScore = (schemaName: string, A: Record<string, unknown>, B: Record<string, unknown>) => {
    const w = WEIGHTS[schemaName] ?? WEIGHTS.default;
    let num = 0, den = 0;
    for (const [k, wt] of Object.entries(w)) {
      const va = A[k], vb = B[k];
      const bad = (v: unknown) => v == null || v === "unknown" || v === "n/a";
      if (bad(va) || bad(vb)) continue;
      let sim: number;
      if (k.toLowerCase().includes("color")) { const la = hexToLab(String(va)), lb = hexToLab(String(vb)); sim = la && lb ? Math.max(0, 1 - deltaE(la, lb) / 28) : 0; }
      else sim = String(va) === String(vb) ? 1 : 0;
      num += wt * sim; den += wt;
    }
    return { score: den ? num / den : 0, cov: den };
  };

  for (const cat of cats) {
    const entry = byCat.get(cat); if (!entry) continue;
    const schemaName = schemaForCategory(cat);
    const crop = await extractCrop(renderBytes, entry.bbox); if (!crop) continue;
    // attrs du rendu (flash-lite)
    let renderAttrs: Record<string, unknown> = {};
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await getVisionProvider("gemini_vision").analyze(buildExtractionPrompt(getSchemaV3(schemaName)), [crop as any], { model: MODEL });
      renderAttrs = (res.parsed ?? {}) as Record<string, unknown>;
    } catch { /* */ }
    // candidats par blend
    const [cropEmb] = await computeBatchImageEmbeddingsFromBytes([crop]);
    const [descEmb] = await computeBatchTextEmbeddings([entry.desc]);
    const { data } = await sb.rpc("match_partner_products_blend", { crop_embedding: cropEmb, desc_embedding: descEmb, match_category: cat, match_count: 8, w_eco_new: 0.7, w_secondhand: 0.7 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data ?? []) as any[];
    const ids = rows.map((p) => p.id);
    const { data: meta } = await sb.from("partner_products").select("id, metadata").in("id", ids);
    const attrsById = new Map<string, Record<string, unknown> | null>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (meta ?? []).map((m: any) => [m.id, (m.metadata?.attrs ?? null) as Record<string, unknown> | null]),
    );
    const wImg = W_IMAGE[schemaName] ?? 0.55;

    const enriched = rows.map((p) => {
      const pa = attrsById.get(p.id);
      const s = pa ? structScore(schemaName, renderAttrs, pa) : { score: 0, cov: 0 };
      const combined = wImg * (+p.sim_image || 0) + (1 - wImg) * s.score;
      return { name: String(p.name).slice(0, 40), merch: p.merchant, simImage: +p.sim_image || 0, blend: +p.similarity, struct: s.score, cov: s.cov, combined, hasAttrs: !!pa };
    });

    console.log(`\n══════════ ${cat}  —  rendu: ${JSON.stringify(renderAttrs)}`);
    const fmt = (e: typeof enriched[number]) => `    img=${e.simImage.toFixed(2)} struct=${e.struct.toFixed(2)}(cov${e.cov}) → combiné=${e.combined.toFixed(3)} | ${e.merch} ${e.name}${e.hasAttrs ? "" : " [pas d'attrs]"}`;
    console.log(`  AVANT (blend actuel) :`);
    enriched.slice().sort((a, b) => b.blend - a.blend).slice(0, 4).forEach((e) => console.log(fmt(e)));
    console.log(`  APRÈS (image+structuré, w=${wImg}) :`);
    enriched.slice().sort((a, b) => b.combined - a.combined).slice(0, 4).forEach((e) => console.log(fmt(e)));
  }
  process.exit(0);
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
