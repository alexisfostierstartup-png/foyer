import sharp from "sharp";
import type { ImageInput } from "./types";

type InlineData = { inlineData: { data: string; mimeType: string } };

export type InlineOptions = {
  /**
   * Côté long max (px). L'image est redimensionnée (ratio préservé, fit inside)
   * et ré-encodée en JPEG q85 si elle dépasse cette dimension. 0/undefined =
   * pas de redimensionnement (comportement historique).
   *
   * NB (mesuré juin 2026) : gemini-2.5-flash-lite facture toute image à 258
   * tokens à plat, quelle que soit la résolution (512px → 3072px). Le
   * redimensionnement ne réduit donc PAS le coût en tokens — c'est uniquement
   * un levier de payload/bande passante + un garde-fou si le mediaResolution
   * par défaut de Google changeait. Réservé aux images d'ENTRÉE vision ;
   * ne jamais l'appliquer aux images envoyées au modèle de génération.
   */
  maxDim?: number;
};

async function resolveBytes(
  input: ImageInput,
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (Buffer.isBuffer(input)) {
    return { buffer: input, mimeType: "image/jpeg" };
  }

  if ("storageUrl" in input) {
    const res = await fetch(input.storageUrl);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch image from storage (${res.status}): ${input.storageUrl}`,
      );
    }
    const arrayBuffer = await res.arrayBuffer();
    const mimeType = (res.headers.get("content-type") ?? "image/jpeg")
      .split(";")[0]
      .trim();
    return { buffer: Buffer.from(arrayBuffer), mimeType };
  }

  return { buffer: Buffer.from(input.base64, "base64"), mimeType: input.mimeType };
}

export async function toInlineData(
  input: ImageInput,
  opts: InlineOptions = {},
): Promise<InlineData> {
  const maxDim = opts.maxDim ?? 0;

  // Fast path : pas de redimensionnement demandé → on évite tout décodage.
  if (!maxDim || maxDim <= 0) {
    if (Buffer.isBuffer(input)) {
      return { inlineData: { data: input.toString("base64"), mimeType: "image/jpeg" } };
    }
    if (!("storageUrl" in input)) {
      return { inlineData: { data: input.base64, mimeType: input.mimeType } };
    }
  }

  const { buffer, mimeType } = await resolveBytes(input);

  if (maxDim > 0) {
    const meta = await sharp(buffer).metadata();
    const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
    if (longest > maxDim) {
      const resized = await sharp(buffer)
        .rotate()
        .resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      return { inlineData: { data: resized.toString("base64"), mimeType: "image/jpeg" } };
    }
  }

  return { inlineData: { data: buffer.toString("base64"), mimeType } };
}
