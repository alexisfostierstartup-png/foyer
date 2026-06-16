import { getGeminiClient } from "../gemini";
import { toInlineData } from "../imageInput";
import { withRetry } from "../retry";
import type { ImageProvider, ImageInput, GenerationResult } from "../types";

const MODEL = "gemini-2.5-flash-image";

export class NanoBananaProvider implements ImageProvider {
  readonly name = "nano_banana";

  async generateFromText(
    prompt: string,
    sourceImage?: ImageInput,
  ): Promise<GenerationResult> {
    const start = Date.now();
    const model = getGeminiClient().getGenerativeModel({
      model: MODEL,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [prompt];
    if (sourceImage) parts.push(await toInlineData(sourceImage));

    const result = await withRetry(() => model.generateContent(parts), { label: `image ${MODEL}` });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candidates = (result.response.candidates as any[]) ?? [];
    const imagePart = candidates[0]?.content?.parts?.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (p: any) => p.inlineData?.mimeType?.startsWith("image/"),
    );

    if (!imagePart?.inlineData?.data) {
      const textPart = candidates[0]?.content?.parts?.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => p.text,
      )?.text;
      throw new Error(
        "Nano Banana did not return an image." +
          (textPart
            ? ` Model said: ${textPart}`
            : ` Raw: ${JSON.stringify(result.response).slice(0, 500)}`),
      );
    }

    const mimeType: string = imagePart.inlineData.mimeType;
    const imageBuffer = Buffer.from(imagePart.inlineData.data, "base64");

    const meta = result.response.usageMetadata as
      | { promptTokenCount?: number }
      | undefined;

    return {
      imageBuffer,
      mimeType,
      rawResponse: result.response,
      providerUsed: this.name,
      modelUsed: MODEL,
      durationMs: Date.now() - start,
      usage: {
        inputTokens: meta?.promptTokenCount,
        imagesIn: sourceImage ? 1 : 0,
        imagesOut: 1,
      },
    };
  }

  async editImage(
    prompt: string,
    sourceImage: ImageInput,
  ): Promise<GenerationResult> {
    return this.generateFromText(prompt, sourceImage);
  }
}
