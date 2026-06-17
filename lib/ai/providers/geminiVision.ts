import type { MediaResolution } from "@google/genai";
import { getGenAIClient } from "../gemini";
import { toInlineData } from "../imageInput";
import { withRetry } from "../retry";
import type { VisionProvider, ImageInput, VisionResult, VisionOptions } from "../types";

const MODEL = "gemini-2.5-flash-lite";

// Côté long max des images d'ENTRÉE vision. Défaut 0 = pas de redimensionnement.
// On garde la pleine résolution pour profiter de l'analyse HIGH.
const INPUT_MAX_DIM = Number.parseInt(process.env.INPUT_MAX_DIM ?? "0", 10) || 0;

type VisionPart = { text: string } | { inlineData: { data: string; mimeType: string } };

export class GeminiVisionProvider implements VisionProvider {
  readonly name = "gemini_vision";

  async analyze(prompt: string, images: ImageInput[], opts?: VisionOptions): Promise<VisionResult> {
    const start = Date.now();
    const ai = getGenAIClient();
    const model = opts?.model ?? MODEL;

    const parts: VisionPart[] = [{ text: prompt }];
    for (const img of images) {
      parts.push(await toInlineData(img, { maxDim: INPUT_MAX_DIM }));
    }

    const result = await withRetry(
      () =>
        ai.models.generateContent({
          model,
          contents: parts,
          config: {
            responseMimeType: "application/json",
            // temperature 0 : la vision est analytique, pas créative → résultats
            // consistants. mediaResolution HIGH : analyse en haute résolution
            // (détecte les petits éléments — plafonniers, cadres — et les
            // nuances de couleur subtiles comme blanc→beige).
            temperature: 0,
            // chaîne littérale (et non l'enum) pour éviter tout souci de
            // résolution de l'enum dans le bundle Next/Turbopack.
            mediaResolution: "MEDIA_RESOLUTION_HIGH" as MediaResolution,
          },
        }),
      { label: `vision ${model}` },
    );

    const text = result.text ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }

    const meta = result.usageMetadata;

    return {
      text,
      parsed,
      rawResponse: result,
      providerUsed: this.name,
      modelUsed: model,
      durationMs: Date.now() - start,
      usage: {
        inputTokens: meta?.promptTokenCount,
        outputTokens: meta?.candidatesTokenCount,
        thinkingTokens: meta?.thoughtsTokenCount,
        imagesIn: images.length,
      },
      responsePayload: parsed,
    };
  }
}
