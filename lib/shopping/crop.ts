/**
 * Extraction du CROP VISUEL d'un élément dans le RENDU (image↔image au matching).
 *
 * La cible du matching devient le crop de l'élément dans le rendu final plutôt que
 * sa seule description : un embedding IMAGE du crop comparé aux embeddings IMAGE des
 * produits est bien plus discriminant (teinte, texture, forme) que texte→image.
 *
 * bbox = { x, y, w, h } NORMALISÉ 0-1 sur le RENDU (déjà ramené au panneau APRÈS en amont).
 *
 * CROP SERRÉ (validé sur cas réel) : on INSET légèrement la bbox (padding NÉGATIF) au lieu
 * d'AJOUTER du fond. Le décor autour (mur/sol/cadre) noie l'objet dans une « scène beige »
 * que CLIP matche pareil pour deux canapés différents → discrimination quasi nulle (écart
 * cosine ~0.01). En serrant sur l'objet, le bon produit MONTE et le mauvais DESCEND (écart
 * ~0.11, ×10). CLIP encode l'image ENTIÈRE → moins de décor = match plus discriminant.
 * ⚠️ NB : la suppression de fond (segmentation) a été testée et ÉCARTÉE — elle efface l'objet
 * sur les crops de rendu (scènes, pas objets isolés) et fait CHUTER les cosines.
 * bbox absente / dégénérée → null (le matching bascule proprement sur texte seul).
 */
import sharp from "sharp";

export type Bbox = { x: number; y: number; w: number; h: number };

/**
 * box_2d Gemini = [ymin, xmin, ymax, xmax] en 0-1000 — la SEULE convention que le
 * modèle émet de façon fiable. Demander [x, y, w, h] 0-1 donne un mélange des deux
 * conventions selon les éléments : les boîtes 0-1000 lues comme des 0-1 sortaient de
 * l'image et le pin atterrissait n'importe où (lampadaires sur le tapis, bibliothèque
 * au sol — QA Alexis 2026-07-11). On demande box_2d et on convertit ici.
 * Tolère le 0-1 (échelle détectée) pour ne pas casser un modèle qui normalise déjà.
 */
export function parseBox2d(raw: unknown): Bbox | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const [ymin, xmin, ymax, xmax] = raw.map(Number);
  if ([ymin, xmin, ymax, xmax].some((v) => !Number.isFinite(v))) return null;
  const s = Math.max(ymin, xmin, ymax, xmax) > 1.5 ? 1000 : 1;
  const b = { x: xmin / s, y: ymin / s, w: (xmax - xmin) / s, h: (ymax - ymin) / s };
  return b.w > 0 && b.h > 0 ? b : null;
}

// Inset de 5 % de chaque côté (padding NÉGATIF) → crop serré sur l'objet, sans décor.
const PADDING = -0.05;

// bbox inexploitable : absente, NaN, ou surface VISIBLE trop petite / quasi pleine image.
// Un DÉBORDEMENT hors-image n'est PAS rejeté (Gemini sur-estime souvent la hauteur d'un tapis
// qui touche le bas) : on CLAMPE à la partie visible (extractCrop borne déjà à [0,1]) et on
// juge celle-ci → le tapis obtient son crop au lieu de tomber en texte seul.
export function isDegenerateBbox(b?: Bbox | null): boolean {
  if (!b) return true;
  const vals = [b.x, b.y, b.w, b.h];
  if (vals.some((v) => typeof v !== "number" || !Number.isFinite(v))) return true;
  if (b.w <= 0.02 || b.h <= 0.02) return true;
  // Surface VISIBLE (bbox ∩ image) après clamp.
  const vw = Math.min(1, b.x + b.w) - Math.max(0, b.x);
  const vh = Math.min(1, b.y + b.h) - Math.max(0, b.y);
  if (vw < 0.05 || vh < 0.05) return true; // démarre hors-image / ne chevauche presque rien
  if (vw >= 0.98 && vh >= 0.98) return true; // quasi pleine image → aucune discrimination
  return false;
}

// Fragment TRONQUÉ par le cadre : petit objet coupé dans un coin de l'image (ex. fauteuil
// du premier plan « visible partiellement »). Son crop est du bruit (moitié sol/mur, objet
// coupé) et fait dériver le matching image vers n'importe quoi (cas réel : fauteuil crème
// tronqué → propositions similcuir noir). ≥2 bords touchés ET petite surface → on rejette
// le crop, le matching bascule proprement sur texte+attrs. Le seuil de surface épargne les
// catégories qui touchent naturellement plusieurs bords en grand (sol, tapis, grand canapé).
export function isFrameTruncatedFragment(b?: Bbox | null): boolean {
  if (!b) return false;
  const edges = [b.x <= 0.01, b.y <= 0.01, b.x + b.w >= 0.99, b.y + b.h >= 0.99].filter(Boolean).length;
  const vw = Math.min(1, b.x + b.w) - Math.max(0, b.x);
  const vh = Math.min(1, b.y + b.h) - Math.max(0, b.y);
  return edges >= 2 && vw * vh < 0.15;
}

// Couleur MOYENNE d'un crop (hex) — cible du matching peinture ΔE quand un
// meuble repeint (DIY) n'a pas de hex d'audit. Moyenne 8×8 = mi-ton robuste
// aux reflets ; un crop très hétérogène reste acceptable (la peinture visée
// domine la surface de l'objet repeint).
export async function dominantHexFromImage(img: Buffer): Promise<string | null> {
  try {
    const { data } = await sharp(img).resize(8, 8, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let r = 0, g = 0, b = 0;
    const n = data.length / 3;
    for (let i = 0; i + 2 < data.length; i += 3) { r += data[i]; g += data[i + 1]; b += data[i + 2]; }
    const hx = (v: number) => Math.round(v / n).toString(16).padStart(2, "0");
    return `#${hx(r)}${hx(g)}${hx(b)}`;
  } catch {
    return null;
  }
}

export async function extractCrop(renderImage: Buffer, bbox?: Bbox | null): Promise<Buffer | null> {
  if (isDegenerateBbox(bbox) || isFrameTruncatedFragment(bbox)) return null;
  const b = bbox!;
  try {
    const meta = await sharp(renderImage).metadata();
    const W = meta.width ?? 0;
    const H = meta.height ?? 0;
    if (!W || !H) return null;

    // Bornes paddées en fraction, clampées à [0, 1].
    const fx0 = Math.max(0, b.x - PADDING * b.w);
    const fy0 = Math.max(0, b.y - PADDING * b.h);
    const fx1 = Math.min(1, b.x + b.w + PADDING * b.w);
    const fy1 = Math.min(1, b.y + b.h + PADDING * b.h);

    const left = Math.round(fx0 * W);
    const top = Math.round(fy0 * H);
    const width = Math.min(Math.max(1, Math.round((fx1 - fx0) * W)), W - left);
    const height = Math.min(Math.max(1, Math.round((fy1 - fy0) * H)), H - top);
    if (width < 8 || height < 8) return null;

    return await sharp(renderImage)
      .extract({ left, top, width, height })
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch (e) {
    console.warn("[crop] extraction échouée:", e instanceof Error ? e.message : e);
    return null;
  }
}
