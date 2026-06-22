/**
 * Extraction du CROP VISUEL d'un élément dans le RENDU (image↔image au matching).
 *
 * La cible du matching devient le crop de l'élément dans le rendu final plutôt que
 * sa seule description : un embedding IMAGE du crop comparé aux embeddings IMAGE des
 * produits est bien plus discriminant (teinte, texture, forme) que texte→image.
 *
 * bbox = { x, y, w, h } NORMALISÉ 0-1 sur le RENDU (déjà ramené au panneau APRÈS en
 * amont). Padding ~10% clampé aux bords pour absorber l'imprécision des bbox Gemini.
 * bbox absente / dégénérée → null (le matching bascule proprement sur texte seul).
 */
import sharp from "sharp";

export type Bbox = { x: number; y: number; w: number; h: number };

const PADDING = 0.1; // 10 % de chaque côté.

// bbox inexploitable : absente, hors-bornes, surface quasi nulle (crop vide) ou quasi
// pleine image (le crop n'apporte alors aucune discrimination → autant rester en texte).
export function isDegenerateBbox(b?: Bbox | null): boolean {
  if (!b) return true;
  const vals = [b.x, b.y, b.w, b.h];
  if (vals.some((v) => typeof v !== "number" || !Number.isFinite(v))) return true;
  if (b.w <= 0.02 || b.h <= 0.02) return true;
  if (b.x < -0.01 || b.y < -0.01 || b.x + b.w > 1.01 || b.y + b.h > 1.01) return true;
  if (b.w >= 0.98 && b.h >= 0.98) return true;
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
