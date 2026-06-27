/**
 * Matching NEUF : pour un item de la liste de courses, trouve les vrais produits
 * du catalogue (partner_products) les plus proches.
 *
 * Principe : jina-clip-v2 met texte ET image dans le même espace → on embed la
 * DESCRIPTION (texte) de l'item (la "requête") et on cosine-match contre les
 * embeddings IMAGE des produits, filtré par catégorie (RPC match_partner_products).
 * Les embeddings PRODUITS sont pré-calculés (import) ; on n'embed à la volée QUE la
 * requête. La version batch fait UN seul appel Jina pour toute la liste.
 */
import { createSupabaseAdmin } from "@/lib/supabase/server";
import {
  computeTextEmbedding,
  computeBatchTextEmbeddings,
  computeBatchImageEmbeddingsFromBytes,
} from "@/lib/embeddings/jina";
import { withTracking } from "@/lib/tracking";
import { MATCH_BLEND_ALPHA, MATCH_MIN_SIMILARITY } from "@/lib/constants";
import {
  getMatchingWeights,
  minScoreForSource,
  DEFAULT_WEIGHTS,
  type MatchingWeights,
} from "./matchingConfig";
import { hexToLab, deltaE } from "@/lib/color";
import { structuredScoreForCategory, wEffForCoverage } from "./attributeScore";
import type { ProductMatch } from "@/lib/types";

// Catégorie d'item → catégorie catalogue. null = non-shoppable (pas de match).
const CATEGORY_ALIASES: Record<string, string> = {
  dining_chair: "chair",
};
const NON_SHOPPABLE = new Set([
  // architecture / non-produit (floor EST shoppable → revêtements de sol LM)
  "wall", "ceiling", "window", "door", "french_door", "wall_opening",
  "frame", "mirror", "plant", "decor_object", "other",
  // pas (encore) dans le catalogue
  "ceiling_light", "table_lamp", "lamp",
]);

function catalogCategory(cat: string): string | null {
  if (!cat || NON_SHOPPABLE.has(cat)) return null;
  return CATEGORY_ALIASES[cat] ?? cat;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): ProductMatch {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    merchant: r.merchant,
    source_type: r.source_type,
    price: r.price != null ? Number(r.price) : null,
    primary_image_url: r.primary_image_url ?? null,
    product_url: r.product_url ?? null,
    similarity: Math.round(Number(r.similarity) * 1000) / 1000,
  };
}

async function rpcMatch(embedding: number[], category: string, topN: number): Promise<ProductMatch[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAdmin() as any;
  const { data, error } = await supabase.rpc("match_partner_products_hybrid", {
    query_embedding: embedding,
    match_category: category,
    match_count: topN,
    alpha: MATCH_BLEND_ALPHA,
  });
  if (error) {
    console.warn("[partnerMatch] RPC échoué:", error.message);
    return [];
  }
  return (data ?? [])
    .map(mapRow)
    .filter((m: ProductMatch) => m.similarity >= MATCH_MIN_SIMILARITY);
}

export async function matchPartnerProducts(category: string, description: string, topN = 4): Promise<ProductMatch[]> {
  const cat = catalogCategory(category);
  if (!cat || !description?.trim()) return [];
  let emb: number[];
  try {
    emb = await computeTextEmbedding(description);
  } catch (e) {
    console.warn("[partnerMatch] embedding échoué:", e instanceof Error ? e.message : e);
    return [];
  }
  return rpcMatch(emb, cat, topN);
}

// Familles de matériau de sol : on ne propose pas un carrelage pour un parquet bois.
// Le `product` filtre sur le TYPE de revêtement (parquet/stratifié, carrelage…), PAS la
// matière imitée : un "Carrelage effet bois chêne" contient "bois/chêne" mais reste du
// carrelage → il ne doit PAS passer le filtre bois.
const FLOOR_MATERIALS: Array<{ render: RegExp; product: RegExp }> = [
  { render: /parquet|\bbois\b|stratifi|ch[êe]ne|chevron|noyer|teck|point de hongrie/i,
    product: /parquet|stratifi|plancher|bois massif|lame.{0,14}bois/i },
  { render: /carrelage|c[ée]ramique|gr[èe]s|c[ée]rame|fa[ïi]ence|tomette/i,
    product: /carrelage|c[ée]ramique|gr[èe]s|c[ée]rame|tomette/i },
  { render: /b[ée]ton|cir[ée]|r[ée]sine/i, product: /b[ée]ton|cir[ée]|r[ée]sine/i },
  { render: /\bpvc\b|vinyle|lino/i, product: /\bpvc\b|vinyle|lino|lame.{0,14}pvc/i },
];

// SOL : cosine MAIS filtré par famille de matériau (le texte→image seul confond
// "parquet bois" et "carrelage effet bois"). On prend un large pool cosine puis on
// garde le bon matériau (parquet/bois → sols bois, pas carrelage).
export async function matchFloorProducts(description: string, topN = 4): Promise<ProductMatch[]> {
  const pool = await matchPartnerProducts("floor", description, 24);
  if (pool.length === 0) return [];
  const mat = FLOOR_MATERIALS.find((m) => m.render.test(description));
  if (!mat) return pool.slice(0, topN);
  const sameMat = pool.filter((p) => mat.product.test(p.name));
  return (sameMat.length > 0 ? sameMat : pool).slice(0, topN);
}

// ============================================================================
// BLEND CROP↔image + DESCRIPTION↔texte (V1.5) — cible = 2 signaux de la même
// détection. Score = w·cos(crop, image_produit) + (1−w)·cos(desc, texte_produit),
// w (poids image) par catégorie × source (config assets). crop absent → texte seul.
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowBlend(r: any): ProductMatch {
  return {
    ...mapRow(r),
    simImage: r.sim_image != null ? Math.round(Number(r.sim_image) * 1000) / 1000 : undefined,
    simText: r.sim_text != null ? Math.round(Number(r.sim_text) * 1000) / 1000 : undefined,
    colorHex: r.color_hex ?? null,
  };
}

// Re-ranking COULEUR (hex/ΔE) : bonus/malus selon la proximité perceptuelle entre la
// couleur de l'ÉLÉMENT (lue par Gemini sur le rendu) et celle du PRODUIT. Pas un match
// exact : latitude réglable (threshold). colorScore∈[0,1] → bonus = w·(2·score−1) ∈ [−w,+w].
// Couleur inconnue (produit ou élément) → pas de bonus (neutre). Mute le score affiché.
function applyColorRerank(
  matches: ProductMatch[],
  elementHex: string | null | undefined,
  weights: MatchingWeights,
): ProductMatch[] {
  const w = weights.color.weight;
  const eLab = elementHex ? hexToLab(elementHex) : null;
  if (!eLab || w <= 0) return matches;
  for (const m of matches) {
    const pLab = m.colorHex ? hexToLab(m.colorHex) : null;
    if (!pLab) continue;
    const dE = deltaE(eLab, pLab);
    m.colorDeltaE = Math.round(dE * 10) / 10;
    const colorScore = Math.max(0, 1 - dE / weights.color.threshold);
    const bonus = w * (2 * colorScore - 1);
    m.similarity = Math.max(0, Math.min(1, Math.round((m.similarity + bonus) * 1000) / 1000));
  }
  return matches.sort((a, b) => b.similarity - a.similarity);
}

// SCORE RÉFERENTIEL (Étape 2, formule Notion) : remplace le blend+bonus additifs par la
// combinaison pondérée  final = cos(image) · w_eff + texte_structuré · (1 − w_eff).
//  - texte_structuré = score d'attrs V3 (couleur conditionnelle + motif + forme…) ; si aucun
//    attribut comparable (produit sans attrs, cov 0) → fallback sur le cosine TEXTE générique.
//  - w_eff coverage-aware (monte vers w_max quand peu d'attrs). Reste dans [0,1] → pas de
//    saturation. Le STRUCTURÉ est un terme de 1er rang, plus un bonus faible bridé.
// Le seuil "À sourcer" reste appliqué AVANT sur le blend (inchangé) → ce re-score ne crée pas
// de nouveau "À sourcer", il ne fait que (re)classer. crop absent (sim_image null) → garde le blend.
async function applyReferentialScore(
  matches: ProductMatch[],
  category: string,
  elementAttrs: Record<string, unknown> | null | undefined,
): Promise<ProductMatch[]> {
  if (matches.length === 0) return matches;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAdmin() as any;
  const { data } = await supabase.from("partner_products").select("id, metadata").in("id", matches.map((m) => m.id));
  const attrsById = new Map<string, Record<string, unknown> | null>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data ?? []).map((r: any) => [r.id, (r.metadata?.attrs ?? null) as Record<string, unknown> | null]),
  );
  for (const m of matches) {
    const pa = attrsById.get(m.id);
    const { score, coverage, details } = structuredScoreForCategory(category, elementAttrs, pa);
    // structScore + détail par attribut TOUJOURS calculés/affichés (même en texte seul, ex.
    // un tapis dont le crop a échoué) → on voit toujours la comparaison d'attributs sur /final.
    m.structScore = Math.round(score * 1000) / 1000;
    m.attrScores = details.map((d) => ({
      key: d.key, render: d.render, product: d.product, weight: d.weight, sim: d.sim, compared: d.compared,
    }));
    // Le SCORE (ranking) n'intègre le structuré QUE s'il y a un crop image (sinon on garde le
    // score blend texte tel quel → on ne change pas un ranking texte-seul déjà bon).
    if (m.simImage == null) continue;
    const wEff = wEffForCoverage(category, coverage);
    // cov 0 (élément OU produit sans attrs comparables) → le texte structuré n'existe pas →
    // fallback sur le cosine texte générique pour ne pas sous-scorer.
    const textSide = coverage > 0 ? score : (m.simText ?? score);
    m.similarity = Math.max(0, Math.min(1, Math.round((m.simImage * wEff + textSide * (1 - wEff)) * 1000) / 1000));
    m.imgWeight = Math.round(wEff * 100) / 100; // poids image effectif (debug)
  }
  return matches.sort((a, b) => (b.similarity - a.similarity) || ((b.structScore ?? 0) - (a.structScore ?? 0)));
}

async function rpcBlend(
  cropEmbedding: number[] | null,
  descEmbedding: number[],
  category: string,
  topN: number,
  weights: MatchingWeights,
): Promise<ProductMatch[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAdmin() as any;
  const { data, error } = await supabase.rpc("match_partner_products_blend", {
    crop_embedding: cropEmbedding, // null → texte seul côté SQL
    desc_embedding: descEmbedding,
    match_category: category,
    match_count: topN,
    w_eco_new: weights.image_weight.eco_new,
    w_secondhand: weights.image_weight.secondhand,
  });
  if (error) {
    console.warn("[partnerMatch] RPC blend échoué:", error.message);
    return [];
  }
  // Scores BRUTS : le seuil d'affichage est appliqué par l'appelant, APRÈS d'éventuels
  // filtres (ex. matériau du sol) — sinon le seuil prunerait le pool avant le filtre et
  // ne laisserait que des produits hors-matériau bien notés (carrelage effet bois).
  return (data ?? []).map(mapRowBlend);
}

// Seuil d'affichage PAR SOURCE. Le seuil ne sert PLUS à éliminer le neuf (eco_new) : tant
// qu'il n'y a pas d'alternative LBC/seconde-main (non codée), le NEUF doit TOUJOURS être
// proposé (le top-N catalogue), même à faible similarité — sinon des catégories pourtant
// présentes (tapis, side_table) ressortent vides. On se contente de MARQUER `belowThreshold`
// (confiance faible) pour l'UI ; le tri/affichage garde quand même le produit.
// La seconde main, elle, reste filtrée par seuil (on ne propose pas un reconditionné médiocre).
function flagOrFilterByThreshold(matches: ProductMatch[], weights: MatchingWeights): ProductMatch[] {
  const out: ProductMatch[] = [];
  for (const m of matches) {
    const below = m.similarity < minScoreForSource(weights, m.source_type);
    if (m.source_type === "secondhand" && below) continue; // seconde main médiocre → écartée
    m.belowThreshold = below;
    out.push(m);
  }
  return out;
}

async function embedCrops(crops: (Buffer | null | undefined)[]): Promise<Map<number, number[]>> {
  const present = crops.map((c, i) => ({ i, c })).filter((x): x is { i: number; c: Buffer } => !!x.c);
  const out = new Map<number, number[]>();
  if (present.length === 0) return out;
  try {
    const embs = await withTracking("embedding", () => computeBatchImageEmbeddingsFromBytes(present.map((p) => p.c)), {
      count: present.length,
      type: "crop",
    });
    present.forEach((p, k) => { if (embs[k]) out.set(p.i, embs[k]); });
  } catch (e) {
    // crop down → on tombe proprement sur texte seul (pas d'échec dur).
    console.warn("[partnerMatch] embedding crops échoué, texte seul:", e instanceof Error ? e.message : e);
  }
  return out;
}

/**
 * Batch blend : embedde toutes les descriptions (1 appel) + tous les crops présents
 * (1 appel), puis blend par produit candidat (filtré par catégorie), poids par
 * catégorie × source. crop absent pour un item → texte seul (w effectif 0).
 */
export async function matchPartnerProductsBlendBatch(
  items: { category: string; description: string; crop?: Buffer | null; colorHex?: string | null; attrs?: Record<string, unknown> | null }[],
  topN = 4,
): Promise<ProductMatch[][]> {
  const cats = items.map((it) => catalogCategory(it.category));
  const textTargets = items
    .map((it, i) => ({ i, text: it.description?.trim() ?? "" }))
    .filter((x) => cats[x.i] && x.text);
  if (textTargets.length === 0) return items.map(() => []);

  let descEmbs: number[][];
  try {
    descEmbs = await withTracking("embedding", () => computeBatchTextEmbeddings(textTargets.map((x) => x.text)), {
      count: textTargets.length,
      type: "text",
    });
  } catch (e) {
    console.warn("[partnerMatch] batch desc embedding échoué:", e instanceof Error ? e.message : e);
    return items.map(() => []);
  }
  const descByIdx = new Map<number, number[]>();
  textTargets.forEach((x, k) => descByIdx.set(x.i, descEmbs[k]));

  // Crops : seulement pour les items shoppables (catégorie résolue).
  const cropByIdx = await embedCrops(items.map((it, i) => (cats[i] ? it.crop : null)));

  // Poids résolus une fois par catégorie distincte.
  const weightsByCat = new Map<string, MatchingWeights>();
  await Promise.all(
    [...new Set(cats.filter((c): c is string => !!c))].map(async (c) =>
      weightsByCat.set(c, await getMatchingWeights(c)),
    ),
  );

  return Promise.all(
    items.map(async (_it, i) => {
      const cat = cats[i];
      const desc = descByIdx.get(i);
      if (!cat || !desc) return [];
      const weights = weightsByCat.get(cat) ?? DEFAULT_WEIGHTS;
      // pool large pour laisser le re-score structuré + la couleur repêcher un bon produit
      // hors top-N blend. On NE filtre PLUS par seuil ici (le neuf doit toujours sortir).
      const matches = await rpcBlend(cropByIdx.get(i) ?? null, desc, cat, Math.max(topN, 30), weights);
      // Score RÉFERENTIEL d'abord (final = image·w_eff + structuré·(1−w_eff)) sur TOUT le pool,
      // puis on MARQUE (sans éliminer) le neuf sous le seuil → le top-N neuf sort toujours.
      const scored = await applyReferentialScore(matches, cat, items[i].attrs);
      const flagged = flagOrFilterByThreshold(scored, weights);
      return flagged.slice(0, topN);
    }),
  );
}

/**
 * SOL en blend : pool large par score, filtré par FAMILLE de matériau (un parquet bois
 * ne doit pas matcher un carrelage effet bois). Poids 'floor' (w baissé) → le motif
 * chevron/essence se joue dans la description, où l'image discrimine mal.
 */
export async function matchFloorProductsBlend(
  description: string,
  crop?: Buffer | null,
  topN = 4,
  attrs?: Record<string, unknown> | null,
): Promise<ProductMatch[]> {
  if (!description?.trim()) return [];
  const weights = await getMatchingWeights("floor");
  let descEmb: number[];
  try {
    descEmb = (await withTracking("embedding", () => computeBatchTextEmbeddings([description]), { count: 1, type: "text" }))[0];
  } catch (e) {
    console.warn("[partnerMatch] floor desc embedding échoué:", e instanceof Error ? e.message : e);
    return [];
  }
  const cropEmb = (await embedCrops([crop])).get(0) ?? null;
  // Pool BRUT (sans seuil) → on filtre d'ABORD par matériau, PUIS on applique le seuil :
  // un stratifié/parquet correct mais à 0.6 doit l'emporter sur un carrelage effet bois
  // mieux noté visuellement mais hors-matériau.
  const pool = await rpcBlend(cropEmb, descEmb, "floor", 24, weights);
  if (pool.length === 0) return [];
  const mat = FLOOR_MATERIALS.find((m) => m.render.test(description));
  const filtered = mat ? pool.filter((p) => mat.product.test(p.name)) : pool;
  // Le neuf sort toujours : on MARQUE le sous-seuil (sans éliminer). Puis SCORE STRUCTURÉ
  // (comme les autres catégories) : le sol a des attrs (type/couleur/motif/finition) → on
  // calcule structScore + le final référentiel image·w + struct·(1−w). La couleur est déjà
  // l'attribut 'color' (poids 30) du schéma floor_material → plus besoin du color-rerank séparé
  // (qui double-comptait la couleur). Le filtre MATÉRIAU dur reste appliqué AVANT.
  const flagged = flagOrFilterByThreshold(filtered.length > 0 ? filtered : pool, weights);
  const scored = await applyReferentialScore(flagged, "floor", attrs);
  return scored.slice(0, topN);
}

/** Batch : UN seul appel Jina (toutes les descriptions shoppables), puis RPC en parallèle. */
export async function matchPartnerProductsBatch(
  items: { category: string; description: string }[],
  topN = 4,
): Promise<ProductMatch[][]> {
  const cats = items.map((it) => catalogCategory(it.category));
  const toEmbed = items
    .map((it, i) => ({ i, text: it.description?.trim() ?? "" }))
    .filter((x) => cats[x.i] && x.text);

  if (toEmbed.length === 0) return items.map(() => []);

  let embs: number[][];
  try {
    embs = await computeBatchTextEmbeddings(toEmbed.map((x) => x.text));
  } catch (e) {
    console.warn("[partnerMatch] batch embedding échoué:", e instanceof Error ? e.message : e);
    return items.map(() => []);
  }
  const embByIdx = new Map<number, number[]>();
  toEmbed.forEach((x, k) => embByIdx.set(x.i, embs[k]));

  return Promise.all(
    items.map(async (_it, i) => {
      const cat = cats[i];
      const emb = embByIdx.get(i);
      return cat && emb ? rpcMatch(emb, cat, topN) : [];
    }),
  );
}
