/**
 * Math couleur pour le matching PEINTURE : on compare la couleur du mur (rendu) à
 * celle des produits via une distance perceptuelle (ΔE en CIELAB), pas par image.
 */

export type Lab = [number, number, number];

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return null;
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}

function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

// sRGB → XYZ (D65) → CIELAB.
export function hexToLab(hex: string | null | undefined): Lab | null {
  if (!hex) return null;
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(srgbToLinear);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) * 100;
  const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) * 100;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) * 100;
  // Blanc de référence D65.
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x / 95.047);
  const fy = f(y / 100);
  const fz = f(z / 108.883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

// ΔE (CIE76) — suffisant pour CLASSER des peintures par proximité de teinte.
// Repère : <2 imperceptible · ~5 proche · >12 nettement différent.
export function deltaE(a: Lab, b: Lab): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

// Familles de couleur (pour filtrage/vérif, pas le matching fin qui reste en ΔE).
export const COLOR_FAMILIES = [
  "blanc", "beige", "gris", "noir", "marron", "rouge", "orange", "jaune", "vert", "bleu", "violet", "rose",
] as const;

/** Classe un point HSL en famille de couleur (blanc/gris/bleu/…) via teinte + saturation + clarté. */
function classifyHsl(h: number, s: number, l: number): string {
  if (l >= 0.9 && s < 0.18) return "blanc";
  if (l <= 0.12) return "noir";
  if (s < 0.12) return "gris";
  // Beige / marron = orange désaturé (h ~20-50) : par clarté.
  if (h >= 20 && h < 50) {
    if (s < 0.55 && l > 0.6) return "beige";
    if (l < 0.45) return "marron";
    return "orange";
  }
  if (h < 20 || h >= 345) return "rouge";
  if (h < 45) return "orange";
  if (h < 66) return "jaune";
  if (h < 170) return "vert";
  if (h < 255) return "bleu"; // inclut cyan/canard
  if (h < 290) return "violet";
  return "rose";
}

/** Classe un hex en famille de couleur (blanc/gris/bleu/…) via teinte + saturation + clarté. */
export function colorFamily(hex: string | null | undefined): string | null {
  const rgb = hex ? hexToRgb(hex) : null;
  if (!rgb) return null;
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  return classifyHsl(h, s, l);
}

// Marges de frontière : un hex tout près d'un seuil HSL est ambigu (canard = vert|bleu,
// bleu désaturé ≈ gris…). On échantillonne le classifieur autour du point et on renvoie la
// famille primaire + AU PLUS une alternative → tolérant aux frontières SANS sur-élargir le
// filtre (cap à 2). Pur calcul, recalculable à volonté (aucun appel API).
const HUE_MARGIN = 12;   // ° de part et d'autre d'une borne de teinte
const SAT_MARGIN = 0.06; // proximité de la ligne gris/chromatique
const LUM_MARGIN = 0.06; // proximité des bornes blanc/noir
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Renvoie 1-2 familles de couleur pour un hex (primaire + alternative si proche d'une frontière). */
export function colorFamilies(hex: string | null | undefined): string[] {
  const rgb = hex ? hexToRgb(hex) : null;
  if (!rgb) return [];
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  const primary = classifyHsl(h, s, l);
  const perturb: Array<[number, number, number]> = [
    [HUE_MARGIN, 0, 0], [-HUE_MARGIN, 0, 0],
    [0, SAT_MARGIN, 0], [0, -SAT_MARGIN, 0],
    [0, 0, LUM_MARGIN], [0, 0, -LUM_MARGIN],
  ];
  for (const [dh, ds, dl] of perturb) {
    const alt = classifyHsl((h + dh + 360) % 360, clamp01(s + ds), clamp01(l + dl));
    if (alt !== primary) return [primary, alt]; // primaire + 1ʳᵉ alternative trouvée
  }
  return [primary];
}

// Cluster NEUTRE : blanc/beige/gris/noir + marron (bois) coexistent en déco → ils se
// recoupent mutuellement. Sinon un rendu lu blanc pur (#ffffff) n'élit AUCUN produit crème
// (beige) ou bois (marron) → catégorie vidée (vu sur les lits). Les CHROMATIQUES restent
// stricts (un rendu bleu n'accepte pas un produit vert).
export const NEUTRAL_FAMILIES = ["blanc", "beige", "gris", "noir", "marron"] as const;

/**
 * Familles à passer au pré-filtre côté REQUÊTE (couleur du rendu). Si le rendu est neutre,
 * on étend à tout le cluster neutre (tolérant : garde crème/bois/gris, exclut le chromatique).
 * Si le rendu est chromatique, on garde ses 1-2 familles (strict). Asymétrique exprès : on
 * n'étend QUE la requête, pas les produits (un rendu bleu doit toujours exclure le beige).
 */
export function colorFamiliesQuery(hex: string | null | undefined): string[] {
  const fams = colorFamilies(hex);
  if (fams.length === 0) return [];
  if (fams.some((f) => (NEUTRAL_FAMILIES as readonly string[]).includes(f))) {
    return [...new Set([...fams, ...NEUTRAL_FAMILIES])];
  }
  return fams;
}
