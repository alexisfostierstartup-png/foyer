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

// Poids par attribut (sur 100 par catégorie, renorm coverage-aware) — miroir du
// référentiel Notion. Ajustable. Clé = nom de SCHÉMA V3 (pas la catégorie catalogue).
export const ATTR_WEIGHTS: Record<string, Record<string, number>> = {
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
  sideboard: { shape: 30, color: 20, material: 20, front: 20, legs: 10 },
  dining_table: { shape: 30, top_material: 20, top_color: 15, legs_type: 20, legs_material: 15 },
  mouldings: { shape: 70 }, // width (number, 30) omis : non extractible du rendu
  batten: { shape: 30 }, // width (number, 70) omis : non extractible du rendu
  default: { color: 45, material: 30, shape: 25 },
};

const isBad = (v: unknown): boolean => v == null || v === "unknown" || v === "n/a" || v === "";

/**
 * Score structuré ∈ [0,1] + couverture (somme des poids des attributs réellement
 * comparés). Un attribut est ignoré (renorm) si l'un des deux côtés est unknown/n/a/absent.
 * Couleur (clé contenant "color") → similarité ΔE ; sinon égalité stricte du vocab.
 */
export function structuredScore(
  schemaName: string,
  renderAttrs: Record<string, unknown> | null | undefined,
  productAttrs: Record<string, unknown> | null | undefined,
): { score: number; coverage: number } {
  if (!renderAttrs || !productAttrs) return { score: 0, coverage: 0 };
  const w = ATTR_WEIGHTS[schemaName] ?? ATTR_WEIGHTS.default;
  let num = 0;
  let den = 0;
  for (const [k, wt] of Object.entries(w)) {
    const va = renderAttrs[k];
    const vb = productAttrs[k];
    if (isBad(va) || isBad(vb)) continue;
    let sim: number;
    if (k.toLowerCase().includes("color")) {
      const la = hexToLab(String(va));
      const lb = hexToLab(String(vb));
      sim = la && lb ? Math.max(0, 1 - deltaE(la, lb) / COLOR_THRESHOLD) : 0;
    } else {
      sim = String(va) === String(vb) ? 1 : 0;
    }
    num += wt * sim;
    den += wt;
  }
  return { score: den ? num / den : 0, coverage: den };
}

/** Score structuré pour une catégorie CATALOGUE (mappe vers le schéma V3). */
export function structuredScoreForCategory(
  category: string,
  renderAttrs: Record<string, unknown> | null | undefined,
  productAttrs: Record<string, unknown> | null | undefined,
): { score: number; coverage: number } {
  return structuredScore(schemaForCategory(category), renderAttrs, productAttrs);
}

// Poids image `w` (base) et `w_max` (quand le texte/structuré est vide) PAR CATÉGORIE —
// table Notion « ⚖️ Poids image vs description ». Clé = nom de schéma V3.
export const CATEGORY_W: Record<string, { w: number; wMax: number }> = {
  sofa: { w: 0.45, wMax: 0.8 }, armchair: { w: 0.55, wMax: 0.85 }, chair: { w: 0.55, wMax: 0.85 },
  coffee_table: { w: 0.5, wMax: 0.8 }, side_table: { w: 0.55, wMax: 0.85 }, dining_table: { w: 0.45, wMax: 0.8 },
  rug: { w: 0.6, wMax: 0.9 }, tv_stand: { w: 0.45, wMax: 0.8 }, bookshelf: { w: 0.45, wMax: 0.8 },
  sideboard: { w: 0.5, wMax: 0.8 }, dresser: { w: 0.45, wMax: 0.8 }, floor_material: { w: 0.55, wMax: 0.85 },
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

const fmtAttr = (a: AttrV3): string =>
  a.type === "hex" ? `${a.key}:"#rrggbb"` : `${a.key}:[${a.vocab!.join("|")}]`;

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
