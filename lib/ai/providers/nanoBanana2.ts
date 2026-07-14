/**
 * NANO BANANA 2 — Gemini 3 Pro Image, appelé EN DIRECT chez Google.
 *
 * Le rendu et les 3 dispositions tournent sur `gemini-2.5-flash-image` (NB1). C'est lui qui
 * déforme les canapés conservés, invente des portes et des balcons, efface les rosaces :
 * on empile des règles de prompt depuis des jours contre les limites d'un modèle, alors que
 * le swap expert — qui, lui, tourne déjà sur NB2 — ne fait aucune de ces fautes. Le Gemini
 * grand public que tout le monde connaît, c'est NB2 aussi : d'où le « je n'ai JAMAIS eu ce
 * souci sur le web » d'Alexis (2026-07-14).
 *
 * On passe par l'API Google, pas par fal : la clé NANO_BANANA_API_KEY y donne accès (vérifié
 * le 2026-07-13 — 2 images en entrée acceptées, aspect_ratio respecté), ce qui évite un
 * intermédiaire payant et une clé de plus.
 *
 * RATIO FORCÉ : sans lui, NB2 rend dans SON ratio par défaut et INVENTE du plafond ou du sol
 * pour remplir. On lui donne donc le ratio de la photo source, arrondi au plus proche des
 * ratios qu'il accepte.
 */
import sharp from "sharp";
import { getGenAIClient } from "../gemini";
import { resolveBytes } from "../imageInput";
import { withRetry } from "../retry";
import type { ImageProvider, ImageInput, GenerationResult } from "../types";

const MODEL = "gemini-3-pro-image-preview";

const RATIOS: [string, number][] = [
  ["21:9", 21 / 9], ["16:9", 16 / 9], ["3:2", 3 / 2], ["4:3", 4 / 3], ["5:4", 5 / 4],
  ["1:1", 1], ["4:5", 4 / 5], ["3:4", 3 / 4], ["2:3", 2 / 3], ["9:16", 9 / 16],
];

function ratioLePlusProche(width: number, height: number): string {
  const r = width / height;
  return RATIOS.reduce((best, cur) => (Math.abs(cur[1] - r) < Math.abs(best[1] - r) ? cur : best))[0];
}

export class NanoBanana2Provider implements ImageProvider {
  readonly name = "nano_banana_2";

  async generateFromText(
    prompt: string,
    sourceImage?: ImageInput,
    refImages?: ImageInput[],
  ): Promise<GenerationResult> {
    const start = Date.now();

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: prompt },
    ];

    let aspectRatio: string | undefined;
    for (const [i, img] of [sourceImage, ...(refImages ?? [])].filter(Boolean).entries()) {
      const { buffer: buf } = await resolveBytes(img as ImageInput);
      if (i === 0) {
        const m = await sharp(buf).metadata();
        if (m.width && m.height) aspectRatio = ratioLePlusProche(m.width, m.height);
      }
      parts.push({
        inlineData: { mimeType: "image/jpeg", data: (await sharp(buf).jpeg({ quality: 92 }).toBuffer()).toString("base64") },
      });
    }

    const ai = getGenAIClient();
    const res = await withRetry(
      () =>
        ai.models.generateContent({
          model: MODEL,
          contents: [{ role: "user", parts }],
          config: (aspectRatio ? { imageConfig: { aspectRatio } } : {}) as never,
        }),
      { label: `image ${MODEL}` },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sorties = ((res as any).candidates?.[0]?.content?.parts ?? []) as any[];
    const image = sorties.find((p) => p?.inlineData?.data);
    if (!image) {
      const texte = sorties.find((p) => p?.text)?.text;
      throw new Error(
        `Nano Banana 2 n'a pas renvoyé d'image.${texte ? ` Le modèle dit : ${texte}` : ""}`,
      );
    }

    const imageBuffer = Buffer.from(image.inlineData.data, "base64");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usage = (res as any).usageMetadata as { promptTokenCount?: number } | undefined;

    return {
      imageBuffer,
      mimeType: image.inlineData.mimeType ?? "image/png",
      rawResponse: res,
      providerUsed: this.name,
      modelUsed: MODEL,
      durationMs: Date.now() - start,
      usage: {
        inputTokens: usage?.promptTokenCount,
        imagesIn: (sourceImage ? 1 : 0) + (refImages?.length ?? 0),
        imagesOut: 1,
      },
    };
  }

  /** Une édition n'est qu'une génération dont l'image source EST la cible. */
  async editImage(prompt: string, image: ImageInput): Promise<GenerationResult> {
    return this.generateFromText(prompt, image);
  }
}
