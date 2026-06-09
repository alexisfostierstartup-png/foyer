import { getGeminiClient } from "../gemini";
import { toInlineData } from "../imageInput";
import type { VisionProvider, ImageInput, VisionResult } from "../types";

export class GeminiVisionProvider implements VisionProvider {
  readonly name = "gemini_vision";

  async analyze(prompt: string, images: ImageInput[]): Promise<VisionResult> {
    const start = Date.now();
    const model = getGeminiClient().getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [prompt];
    for (const img of images) {
      parts.push(await toInlineData(img));
    }

    const result = await model.generateContent(parts);
    const text = result.response.text();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }

    return {
      text,
      parsed,
      rawResponse: result.response,
      providerUsed: this.name,
      durationMs: Date.now() - start,
    };
  }
}
