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

/** Classe un hex en famille de couleur (blanc/gris/bleu/…) via teinte + saturation + clarté. */
export function colorFamily(hex: string | null | undefined): string | null {
  const rgb = hex ? hexToRgb(hex) : null;
  if (!rgb) return null;
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
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
