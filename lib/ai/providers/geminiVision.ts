import { getGeminiClient } from "../gemini";
import { toInlineData } from "../imageInput";
import { withRetry } from "../retry";
import type { VisionProvider, ImageInput, VisionResult } from "../types";

const MODEL = "gemini-2.5-flash-lite";

// Côté long max des images d'ENTRÉE vision. Défaut 0 = pas de redimensionnement
// (comportement historique). N'affecte que les appels vision, jamais la génération.
const INPUT_MAX_DIM = Number.parseInt(process.env.INPUT_MAX_DIM ?? "0", 10) || 0;

export class GeminiVisionProvider implements VisionProvider {
  readonly name = "gemini_vision";

  async analyze(prompt: string, images: ImageInput[]): Promise<VisionResult> {
    const start = Date.now();
    const model = getGeminiClient().getGenerativeModel({
      model: MODEL,
      generationConfig: { responseMimeType: "application/json" },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [prompt];
    for (const img of images) {
      parts.push(await toInlineData(img, { maxDim: INPUT_MAX_DIM }));
    }

    const result = await withRetry(() => model.generateContent(parts), { label: `vision ${MODEL}` });
    const text = result.response.text();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }

    const meta = result.response.usageMetadata as
      | {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          thoughtsTokenCount?: number;
        }
      | undefined;

    return {
      text,
      parsed,
      rawResponse: result.response,
      providerUsed: this.name,
      modelUsed: MODEL,
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
