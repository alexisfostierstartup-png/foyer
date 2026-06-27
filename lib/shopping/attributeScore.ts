/**
 * Étape 2 — SCORE STRUCTURÉ (coverage-aware) entre les attributs V3 de l'élément du
 * RENDU et ceux d'un PRODUIT (metadata.attrs, déjà extraits au catalogue). Plus deux
 * helpers : poids par attribut (miroir Notion) et construction de l'instruction d'attrs
 * à injecter dans un prompt (confirm_changes / render_inventory).
 *
 * Validé au diag (diag-struct) : sur le canapé, promeut le 5-places d'angle (struct 0.82)
 * vs le 7-places visuellement proche (struct 0.16) que l'image seule classait 1er.
 */
import { hexToLab, deltaE } from "@/lib/color";
import { SCHEMA_V3, schemaForCategory, type AttrV3 } from "./attributeSchemaV3";

// ΔE au-delà duquel un attribut couleur ne rapporte plus rien (latitude perceptuelle).
const COLOR_THRESHOLD = 28;

// Score couleur GATÉ par TEINTE : on garde le dégradé ΔE (clair vs foncé) UNIQUEMENT dans un
// spectre de teinte proche ; une teinte franchement différente → 0 (pas de demi-points).
//  - 2 quasi-neutres (blanc/gris/noir, chroma faible) → compatibles → dégradé ΔE sur la clarté
//    (blanc clair plus proche d'un rendu blanc clair = plus de points qu'un blanc foncé/gris).
//  - 1 neutre + 1 coloré (rendu blanc vs produit vert) → 0.
//  - 2 colorés → compatibles si l'angle de teinte est PROCHE (un vert accepte vert d'eau / bleu-
//    vert, mais pas le bleu pur ni le rouge) → dégradé ΔE ; sinon 0.
const NEUTRAL_CHROMA = 10; // chroma (a*,b*) en-dessous = quasi-neutre (pas de teinte franche)
const HUE_TOL = 60;        // écart de teinte (°) toléré : vert ↔ vert d'eau/bleu-vert OK, vert ↔ bleu = 0
export function colorAttrSim(hexA: string, hexB: string): number {
  const la = hexToLab(hexA), lb = hexToLab(hexB);
  if (!la || !lb) return 0;
  const aN = Math.hypot(la[1], la[2]) < NEUTRAL_CHROMA;
  const bN = Math.hypot(lb[1], lb[2]) < NEUTRAL_CHROMA;
  let compatible: boolean;
  if (aN && bN) compatible = true;        // 2 neutres
  else if (aN !== bN) compatible = false; // neutre vs coloré → 0
  else {
    const hueA = (Math.atan2(la[2], la[1]) * 180 / Math.PI + 360) % 360;
    const hueB = (Math.atan2(lb[2], lb[1]) * 180 / Math.PI + 360) % 360;
    const dHue = Math.min(Math.abs(hueA - hueB), 360 - Math.abs(hueA - hueB));
    compatible = dHue <= HUE_TOL;
  }
  return compatible ? Math.max(0, 1 - deltaE(la, lb) / COLOR_THRESHOLD) : 0;
}

// Poids par attribut (sur 100 par catégorie, renorm coverage-aware) — miroir du
// référentiel Notion. Ajustable. Clé = nom de SCHÉMA V3 (pas la catégorie catalogue).
export const ATTR_WEIGHTS: Record<string, Record<string, number>> = {
  // Canapé : la COULEUR et la silhouette (places/config) sont les signaux FIABLES → poids fort.
  // Les PIEDS sont souvent CACHÉS sous l'assise (rendu ET photo catalogue) → attribut bruité,
  // poids minoré pour qu'une mauvaise lecture des pieds ne renverse plus une bonne couleur.
  sofa: { color: 30, seats: 22, configuration: 20, upholstery: 16, legs_type: 7, legs_material: 5 },
  // Fauteuil : pieds éclatés (legs_base config + legs_shape forme) + frame_material (matière
  // structure/accoudoirs, ex. bois apparent) → discrimine les fauteuils à structure visible.
  armchair: { shape: 25, color: 22, upholstery: 15, frame_material: 14, legs_base: 7, legs_shape: 7, armrests: 10 },
  chair: { shape: 35, color: 25, material: 20, legs_type: 10, armrests: 10 },
  coffee_table: { shape: 30, top_material: 20, top_color: 15, legs_material: 15, legs_type: 15, storage: 5 },
  side_table: { shape: 30, top_material: 25, top_color: 25, legs_type: 20 },
  // Tapis : le MOTIF est le signal #1 (un tapis se reconnaît à son motif), la COULEUR #2.
  // La TEXTURE (tissage : tufted/shaggy/flatweave) est secondaire et ne doit pas couler un
  // tapis au bon motif + bonne couleur (cf. Heal géométrique crème battu par un tufted off-color).
  rug: { pattern: 40, color: 35, weave: 10, shape: 15 },
  tv_stand: { shape: 25, color: 25, material: 20, storage: 15, legs: 15 },
  bookshelf: { shape: 35, color: 20, material: 20, structure: 15, mount: 10 },
  dresser: { shape: 20, color: 25, material: 20, drawers: 20, legs: 15 },
  // Sol : la COULEUR/teinte est le critère #1 (un parquet blanc ≠ parquet marron clair, même
  // type/motif). On la rend DOMINANTE (45) et on minore la finition (5) qui ne doit jamais
  // l'emporter sur une couleur juste. Le type reste fort (parquet vs carrelage) mais le filtre
  // matériau dur le gère déjà en amont.
  floor_material: { color: 45, type: 35, pattern: 15, finish: 5 },
  floor_lamp: { structure: 25, shade_type: 25, base_shape: 15, base_finish: 20, color: 15 },
  pendant_lamp: { shape: 35, shade_material: 25, color: 25, finish: 15 },
  sideboard: { shape: 30, color: 20, material: 20, front: 20, legs: 10 },
  dining_table: { shape: 30, top_material: 20, top_color: 15, legs_type: 20, legs_material: 15 },
  mouldings: { shape: 70 }, // width (number, 30) omis : non extractible du rendu
  batten: { shape: 30 }, // width (number, 70) omis : non extractible du rendu
  default: { color: 45, material: 30, shape: 25 },
};

const isBad = (v: unknown): boolean => v == null || v === "unknown" || v === "n/a" || v === "";

// Détail par attribut (debug scoring /final) — miroir du type lib/types AttrScoreDetail.
export type AttrScoreLine = {
  key: string;
  render: string | null;
  product: string | null;
  weight: number;
  sim: number;
  compared: boolean;
};

/**
 * Score structuré ∈ [0,1] + couverture (somme des poids des attributs réellement
 * comparés). Un attribut est ignoré (renorm) si l'un des deux côtés est unknown/n/a/absent.
 * Couleur (clé contenant "color") → similarité ΔE ; sinon égalité stricte du vocab.
 * `details` : ligne par attribut (valeurs, poids, sim, comparé ou non) pour le debug /final.
 */
export function structuredScore(
  schemaName: string,
  renderAttrs: Record<string, unknown> | null | undefined,
  productAttrs: Record<string, unknown> | null | undefined,
): { score: number; coverage: number; details: AttrScoreLine[] } {
  const w = ATTR_WEIGHTS[schemaName] ?? ATTR_WEIGHTS.default;
  const details: AttrScoreLine[] = [];
  if (!renderAttrs || !productAttrs) return { score: 0, coverage: 0, details };
  let num = 0;
  let den = 0;
  for (const [k, wt] of Object.entries(w)) {
    const va = renderAttrs[k];
    const vb = productAttrs[k];
    const str = (v: unknown): string | null => (v == null ? null : String(v));
    if (isBad(va) || isBad(vb)) {
      details.push({ key: k, render: str(va), product: str(vb), weight: wt, sim: 0, compared: false });
      continue;
    }
    let sim: number;
    if (k.toLowerCase().includes("color")) {
      sim = colorAttrSim(String(va), String(vb)); // gate teinte + dégradé ΔE
    } else {
      sim = String(va) === String(vb) ? 1 : 0;
    }
    num += wt * sim;
    den += wt;
    details.push({ key: k, render: str(va), product: str(vb), weight: wt, sim: Math.round(sim * 100) / 100, compared: true });
  }
  return { score: den ? num / den : 0, coverage: den, details };
}

/** Score structuré pour une catégorie CATALOGUE (mappe vers le schéma V3). */
export function structuredScoreForCategory(
  category: string,
  renderAttrs: Record<string, unknown> | null | undefined,
  productAttrs: Record<string, unknown> | null | undefined,
): { score: number; coverage: number; details: AttrScoreLine[] } {
  return structuredScore(schemaForCategory(category), renderAttrs, productAttrs);
}

// Poids image `w` (base) et `w_max` (quand le texte/structuré est vide) PAR CATÉGORIE —
// table Notion « ⚖️ Poids image vs description ». Clé = nom de schéma V3.
export const CATEGORY_W: Record<string, { w: number; wMax: number }> = {
  // Canapé : forme/silhouette très discriminante visuellement → image dominante (0.70).
  // Le structuré reste un terme secondaire (départage), il ne doit plus RENVERSER un
  // match image+texte clairement meilleur (cf. banquette qui battait le vrai canapé).
  sofa: { w: 0.70, wMax: 0.85 }, armchair: { w: 0.55, wMax: 0.85 }, chair: { w: 0.55, wMax: 0.85 },
  coffee_table: { w: 0.5, wMax: 0.8 }, side_table: { w: 0.55, wMax: 0.85 }, dining_table: { w: 0.45, wMax: 0.8 },
  rug: { w: 0.6, wMax: 0.9 }, tv_stand: { w: 0.45, wMax: 0.8 }, bookshelf: { w: 0.45, wMax: 0.8 },
  sideboard: { w: 0.5, wMax: 0.8 }, dresser: { w: 0.45, wMax: 0.8 },
  // Sol : image CLIP peu fiable sur les teintes de bois (perspective/lumière) → poids image
  // baissé pour laisser la COULEUR/type (attrs) décider.
  floor_material: { w: 0.40, wMax: 0.7 },
  floor_lamp: { w: 0.55, wMax: 0.85 }, pendant_lamp: { w: 0.6, wMax: 0.9 },
  mouldings: { w: 0.5, wMax: 0.8 }, batten: { w: 0.4, wMax: 0.7 }, default: { w: 0.55, wMax: 0.85 },
};

/**
 * `w_eff` coverage-aware (référentiel §2) : on part du `w` de base et on remonte vers `w_max`
 * à mesure que la couverture d'attributs baisse (moins d'attrs comparables → moins de confiance
 * dans le texte structuré → plus de poids à l'image). coverage = Σ poids comparables (sur 100).
 */
export function wEffForCoverage(category: string, coverage: number): number {
  const { w, wMax } = CATEGORY_W[schemaForCategory(category)] ?? CATEGORY_W.default;
  const cov = Math.max(0, Math.min(1, coverage / 100));
  return w + (1 - cov) * (wMax - w);
}

const fmtAttr = (a: AttrV3): string => {
  const base = a.type === "hex" ? `${a.key}:"#rrggbb"` : `${a.key}:[${a.vocab!.join("|")}]`;
  return a.hint ? `${base} — ${a.hint}` : base;
};

/**
 * Instruction à AJOUTER à un prompt vision (confirm_changes / render_inventory) pour qu'il
 * émette, par élément, un objet `attrs` avec les attributs V3 de SA catégorie. On n'injecte
 * que les catégories utiles (celles présentes) pour garder le prompt lean.
 */
export function buildAttrsInstruction(categories?: string[], opts?: { replacedOnly?: boolean }): string {
  const schemas = categories && categories.length
    ? [...new Set(categories.map(schemaForCategory))]
    : Object.keys(SCHEMA_V3).filter((c) => c !== "default");
  const lines = schemas
    .filter((s) => SCHEMA_V3[s])
    .map((s) => `- ${s}: { ${SCHEMA_V3[s].map(fmtAttr).join(", ")} }`);
  // confirm_changes : seuls les éléments REMPLACÉS (nouvel objet) ont besoin des attrs.
  // Un simple re-finish/repeint = même objet, même forme → la couleur suffit, on n'alourdit pas.
  const scope = opts?.replacedOnly
    ? `UNIQUEMENT pour les éléments REMPLACÉS par un objet DIFFÉRENT dans l'APRÈS (un nouveau meuble). ` +
      `Pour un élément simplement re-fini / repeint / re-tapissé (MÊME objet), N'ÉMETS PAS "attrs". `
    : `à CHAQUE élément `;
  return (
    `\n\nEN PLUS, ajoute ${scope}un objet "attrs" = les attributs structurés ` +
    `correspondant à SA catégorie ci-dessous. Valeur EXACTE du vocab ; "unknown" si ` +
    `indéterminable depuis l'image ; "n/a" si l'attribut ne s'applique pas. Pour les matières, ` +
    `juge l'APPARENCE visuelle (placage/mélaminé effet bois = bois).\n${lines.join("\n")}`
  );
}
