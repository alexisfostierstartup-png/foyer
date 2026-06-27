#!/usr/bin/env npx tsx
/**
 * PROTOTYPE Étape 1 (lecture seule) : re-ranking couleur hex/ΔE.
 * Pour sofa/coffee_table/rug d'un projet : hex de l'élément (Gemini sur le rendu) + hex
 * dominant de chaque produit (image, région centrale) → ΔE CIELAB → re-classe le top-N
 * blend en mélangeant score blend et proximité couleur. Montre avant/après.
 *
 * Usage : npx tsx scripts/diag-color.ts <projectId> [cats] [colorWeight=0.35]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const NON_DETECTABLE = new Set(["ceiling", "door", "french_door", "window", "wall_opening"]);

async function main() {
  const projectId = process.argv[2];
  const cats = (process.argv[3] || "sofa,coffee_table,rug").split(",");
  const cw = Number(process.argv[4] ?? 0.35);
  if (!projectId) { console.error("Usage: diag-color <projectId> [cats] [colorWeight]"); process.exit(1); }

  const { getProject } = await import("../lib/storage/projects");
  const { buildBeforeAfterComposite, confirmChanges, computeRenderAdditions, fetchImageBytes } = await import("../lib/ai/pipeline");
  const { getElementCategories } = await import("../lib/db/assets");
  const { extractCrop } = await import("../lib/shopping/crop");
  const { computeBatchImageEmbeddingsFromBytes, computeBatchTextEmbeddings } = await import("../lib/embeddings/jina");
  const { getVisionProvider } = await import("../lib/ai/provider");
  const { createSupabaseAdmin } = await import("../lib/supabase/server");
  const { hexToLab, deltaE } = await import("../lib/color");
  const sharp = (await import("sharp")).default;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const project: any = await getProject(projectId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidates = (project.element_decisions ?? []).filter((d: any) => !NON_DETECTABLE.has(d.category));
  const renderBytes = await fetchImageBytes(project.generatedRenderUrl);

  // 1. hex de chaque élément via Gemini (sur le rendu) — pas sur le crop (sol pollue).
  const hexPrompt = `Pour CHACUNE de ces catégories présentes dans l'image: ${cats.join(", ")}. Donne la couleur DOMINANTE de l'objet (pas du fond/sol) en hexadécimal. Réponds en JSON strict: {${cats.map((c) => `"${c}":"#rrggbb"`).join(",")}}.`;
  const hexRes = await getVisionProvider("gemini_vision").analyze(hexPrompt, [{ storageUrl: project.generatedRenderUrl } as never]);
  const elemHex = (hexRes.parsed ?? {}) as Record<string, string>;
  console.log("hex éléments (Gemini):", elemHex);

  // 2. bbox+desc par catégorie (candidats + ajouts).
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
  async function prodHex(url: string): Promise<string | null> {
    try {
      const buf = Buffer.from(await (await fetch(url, { headers: { "User-Agent": UA, Accept: "image/avif,image/webp,*/*" } })).arrayBuffer());
      const m = await sharp(buf).metadata(); const W = m.width!, H = m.height!;
      const px = await sharp(buf).extract({ left: Math.round(W * 0.3), top: Math.round(H * 0.3), width: Math.round(W * 0.4), height: Math.round(H * 0.4) }).resize(1, 1).raw().toBuffer();
      return "#" + [px[0], px[1], px[2]].map((x) => x.toString(16).padStart(2, "0")).join("");
    } catch { return null; }
  }

  for (const cat of cats) {
    const entry = byCat.get(cat); if (!entry) { console.log(`\n[${cat}] pas de bbox`); continue; }
    const crop = await extractCrop(renderBytes, entry.bbox); if (!crop) continue;
    const [cropEmb] = await computeBatchImageEmbeddingsFromBytes([crop]);
    const [descEmb] = await computeBatchTextEmbeddings([entry.desc]);
    const { data } = await sb.rpc("match_partner_products_blend", { crop_embedding: cropEmb, desc_embedding: descEmb, match_category: cat, match_count: 30, w_eco_new: 0.7, w_secondhand: 0.7 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data ?? []) as any[];
    const eLab = elemHex[cat] ? hexToLab(elemHex[cat]) : null;
    const enriched = [];
    for (const p of rows) {
      const ph = await prodHex(p.primary_image_url);
      const dE = eLab && ph ? deltaE(eLab, hexToLab(ph)!) : null;
      const colorScore = dE == null ? 0.5 : Math.max(0, 1 - dE / 30);
      const blend = 0.7 * p.sim_image + 0.3 * p.sim_text;
      enriched.push({ name: String(p.name).slice(0, 40), merch: p.merchant, blend, ph, dE, final: (1 - cw) * blend + cw * colorScore });
    }
    console.log(`\n══ ${cat} — élément hex=${elemHex[cat]} — "${entry.desc.slice(0, 45)}"`);
    console.log("  AVANT (blend) top-4 :");
    enriched.slice().sort((a, b) => b.blend - a.blend).slice(0, 4).forEach((e) => console.log(`    blend=${e.blend.toFixed(3)} ${e.merch} ${e.name} [hex ${e.ph} ΔE${e.dE?.toFixed(0) ?? "—"}]`));
    console.log("  APRÈS (blend+couleur) top-4 :");
    enriched.slice().sort((a, b) => b.final - a.final).slice(0, 4).forEach((e) => console.log(`    final=${e.final.toFixed(3)} (blend ${e.blend.toFixed(3)}) ${e.merch} ${e.name} [hex ${e.ph} ΔE${e.dE?.toFixed(0) ?? "—"}]`));
  }
  process.exit(0);
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
