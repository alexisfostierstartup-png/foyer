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

export async function extractCrop(renderImage: Buffer, bbox?: Bbox | null): Promise<Buffer | null> {
  if (isDegenerateBbox(bbox)) return null;
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
