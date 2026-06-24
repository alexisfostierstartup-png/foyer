#!/usr/bin/env npx tsx
/**
 * CANARY Étape 2 (lecture seule) : Gemini extrait les ATTRIBUTS STRUCTURÉS (vocab V3
 * fermé) du RENDU (élément) ET de produits candidats, puis on compare attribut par
 * attribut (couverture-aware, couleur en ΔE). Objectif : juger la COHÉRENCE de
 * l'extraction et si le bon produit remonte — avant d'industrialiser sur 7300 produits.
 *
 * Usage : npx tsx scripts/diag-attrs.ts <projectId> [cats=rug,coffee_table,sofa] [topN=3]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const NON_DETECTABLE = new Set(["ceiling", "door", "french_door", "window", "wall_opening"]);

// Référentiel V3 (sous-ensemble) — vocab EN fermé + poids (somme 100).
type Attr = { key: string; weight: number; type: "enum" | "hex"; vocab?: string[] };
const SCHEMA: Record<string, Attr[]> = {
  sofa: [
    { key: "seats", weight: 20, type: "enum", vocab: ["1", "2", "3", "4", "5+"] },
    { key: "configuration", weight: 20, type: "enum", vocab: ["straight", "corner_left", "corner_right", "chaise", "modular", "panoramic", "sofa_bed"] },
    { key: "color", weight: 25, type: "hex" },
    { key: "upholstery", weight: 15, type: "enum", vocab: ["fabric", "velvet", "corduroy", "linen", "boucle", "chenille", "leather", "faux_leather"] },
    { key: "legs_type", weight: 12, type: "enum", vocab: ["tapered", "block", "metal_thin", "plinth", "casters", "none"] },
    { key: "legs_material", weight: 8, type: "enum", vocab: ["light_wood", "dark_wood", "black_metal", "gold_metal", "chrome_metal"] },
  ],
  coffee_table: [
    { key: "shape", weight: 30, type: "enum", vocab: ["round", "oval", "rectangular", "square", "nesting", "organic"] },
    { key: "top_material", weight: 20, type: "enum", vocab: ["light_wood", "dark_wood", "oak", "walnut", "white_lacquer", "black", "marble", "glass", "metal", "travertine", "concrete"] },
    { key: "top_color", weight: 15, type: "hex" },
    { key: "legs_material", weight: 15, type: "enum", vocab: ["wood", "black_metal", "gold_metal", "chrome_metal", "same_as_top"] },
    { key: "legs_type", weight: 15, type: "enum", vocab: ["four_legs", "central", "tapered", "sled", "casters"] },
    { key: "storage", weight: 5, type: "enum", vocab: ["none", "lower_shelf", "drawers", "lift_top"] },
  ],
  rug: [
    { key: "pattern", weight: 30, type: "enum", vocab: ["plain", "geometric", "chevron", "berber_diamond", "oriental", "abstract", "striped", "checked"] },
    { key: "color", weight: 25, type: "hex" }, // 🔀 plain→40 / motif→15 (appliqué plus bas)
    { key: "weave", weight: 20, type: "enum", vocab: ["flatweave", "shaggy", "berber", "tufted", "braided_jute", "kilim", "fringed", "low_velvet"] },
    { key: "shape", weight: 15, type: "enum", vocab: ["rectangular", "round", "oval", "runner"] },
    { key: "material", weight: 10, type: "enum", vocab: ["wool", "cotton", "jute_sisal", "synthetic", "viscose"] },
  ],
};

function extractionPrompt(cat: string): string {
  const attrs = SCHEMA[cat];
  const lines = attrs.map((a) =>
    a.type === "hex"
      ? `  "${a.key}": "#rrggbb (couleur dominante)"`
      : `  "${a.key}": one of [${a.vocab!.join(", ")}]`,
  );
  return `Tu décris un objet de catégorie "${cat}" pour du matching produit. Observe UNIQUEMENT l'objet principal (ignore le décor/fond). Renvoie un JSON STRICT, choisis EXACTEMENT une valeur du vocabulaire par clé, ou "unknown" si non déterminable depuis l'image :\n{\n${lines.join(",\n")}\n}`;
}

async function main() {
  const projectId = process.argv[2];
  const cats = (process.argv[3] || "rug,coffee_table,sofa").split(",");
  const topN = Number(process.argv[4] ?? 3);
  if (!projectId) { console.error("Usage: diag-attrs <projectId> [cats] [topN]"); process.exit(1); }

  const { getProject } = await import("../lib/storage/projects");
  const { buildBeforeAfterComposite, confirmChanges, computeRenderAdditions, fetchImageBytes } = await import("../lib/ai/pipeline");
  const { getElementCategories } = await import("../lib/db/assets");
  const { extractCrop } = await import("../lib/shopping/crop");
  const { computeBatchImageEmbeddingsFromBytes, computeBatchTextEmbeddings } = await import("../lib/embeddings/jina");
  const { getVisionProvider } = await import("../lib/ai/provider");
  const { createSupabaseAdmin } = await import("../lib/supabase/server");
  const { hexToLab, deltaE } = await import("../lib/color");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const project: any = await getProject(projectId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidates = (project.element_decisions ?? []).filter((d: any) => !NON_DETECTABLE.has(d.category));
  const renderBytes = await fetchImageBytes(project.generatedRenderUrl);

  // bbox+desc par catégorie (candidats + ajouts).
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
  const fetchImg = async (url: string): Promise<Buffer | null> => {
    try { return Buffer.from(await (await fetch(url, { headers: { "User-Agent": UA, Accept: "image/jpeg,image/webp" } })).arrayBuffer()); } catch { return null; }
  };
  const extract = async (cat: string, image: Buffer): Promise<Record<string, string>> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await getVisionProvider("gemini_vision").analyze(extractionPrompt(cat), [image as any]);
      return (res.parsed ?? {}) as Record<string, string>;
    } catch (e) { return { _error: e instanceof Error ? e.message.slice(0, 60) : "err" }; }
  };

  // Score structuré couverture-aware (couleur en ΔE, enum 0/1), + conditionnel rug.
  const structScore = (cat: string, A: Record<string, string>, B: Record<string, string>) => {
    let attrs = SCHEMA[cat].map((a) => ({ ...a }));
    if (cat === "rug") { const plain = A.pattern === "plain"; attrs = attrs.map((a) => a.key === "color" ? { ...a, weight: plain ? 40 : 15 } : a); }
    let num = 0, den = 0; const detail: string[] = [];
    for (const a of attrs) {
      const va = A[a.key], vb = B[a.key];
      if (!va || !vb || va === "unknown" || vb === "unknown") continue; // non comparable
      let sim: number;
      if (a.type === "hex") { const la = hexToLab(va), lb = hexToLab(vb); sim = la && lb ? Math.max(0, 1 - deltaE(la, lb) / 28) : 0; }
      else sim = va === vb ? 1 : 0;
      num += a.weight * sim; den += a.weight;
      detail.push(`${a.key}:${va}${va === vb ? "=" : "≠"}${vb}${a.type === "hex" ? `(${sim.toFixed(2)})` : ""}`);
    }
    return { score: den ? num / den : 0, coverage: den / 100, detail: detail.join("  ") };
  };

  for (const cat of cats) {
    const entry = byCat.get(cat); if (!entry) { console.log(`\n[${cat}] pas de bbox`); continue; }
    const crop = await extractCrop(renderBytes, entry.bbox); if (!crop) { console.log(`[${cat}] crop null`); continue; }
    console.log(`\n══════════ ${cat} — "${entry.desc.slice(0, 50)}"`);
    const renderAttrs = await extract(cat, crop);
    console.log(`  RENDU  : ${JSON.stringify(renderAttrs)}`);

    // top-N candidats par blend (crop+desc).
    const [cropEmb] = await computeBatchImageEmbeddingsFromBytes([crop]);
    const [descEmb] = await computeBatchTextEmbeddings([entry.desc]);
    const { data } = await sb.rpc("match_partner_products_blend", { crop_embedding: cropEmb, desc_embedding: descEmb, match_category: cat, match_count: topN, w_eco_new: 0.7, w_secondhand: 0.7 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const p of (data ?? []) as any[]) {
      const img = await fetchImg(p.primary_image_url);
      const pAttrs = img ? await extract(cat, img) : { _error: "img fetch fail" };
      const m = structScore(cat, renderAttrs, pAttrs);
      console.log(`  ─ ${p.merchant} ${String(p.name).slice(0, 40)}  [blend ${(+p.similarity).toFixed(3)}]`);
      console.log(`     PRODUIT: ${JSON.stringify(pAttrs)}`);
      console.log(`     STRUCT score=${m.score.toFixed(3)} couverture=${(m.coverage * 100).toFixed(0)}%  ${m.detail}`);
    }
  }
  process.exit(0);
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
