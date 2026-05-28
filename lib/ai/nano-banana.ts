import fs from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import { getGeminiClient } from "./gemini";
import { buildWowPrompt } from "./prompts";
import type { ArchitectureContext } from "./prompts";
import type { RoomType, Style, DetectedFurniture } from "@/lib/types";

export type GenerateWowParams = {
  sourceImagePath: string;
  architecture: ArchitectureContext;
  furniture: DetectedFurniture[];
  style: Style;
  roomType: RoomType;
};

export type GenerateWowResult = {
  renderUrl: string;
  promptUsed: string;
};

/**
 * Génère un rendu WOW avec Nano Banana (image-to-image).
 * Préserve l'architecture et le mobilier marqué "keep".
 */
export async function generateWowRender(
  params: GenerateWowParams,
): Promise<GenerateWowResult> {
  const model = getGeminiClient().getGenerativeModel({
    model: "gemini-2.5-flash-image",
  });

  const furnitureToKeep = params.furniture.filter((f) => f.decision === "keep");
  const furnitureToCustomize = params.furniture.filter(
    (f) => f.decision === "customize",
  );
  const furnitureToReplace = params.furniture.filter(
    (f) => f.decision === "replace",
  );

  const prompt = buildWowPrompt({
    architecture: params.architecture,
    furnitureToKeep,
    furnitureToCustomize,
    furnitureToReplace,
    style: params.style,
    roomType: params.roomType,
  });

  console.log("[generate] prompt:\n" + prompt);

  const buffer = await fs.readFile(
    path.join(process.cwd(), "public", params.sourceImagePath),
  );
  console.log(
    `[generate] image: ${params.sourceImagePath}, ${(buffer.length / 1024).toFixed(0)}KB`,
  );
  const imageInline = {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType: "image/jpeg",
    },
  };

  const startedAt = Date.now();
  const result = await model.generateContent([prompt, imageInline]);
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[generate] response time: ${elapsed}s`);

  const parts = result.response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) =>
    p.inlineData?.mimeType?.startsWith("image/"),
  );

  if (!imagePart?.inlineData?.data) {
    const textPart = parts.find((p) => p.text)?.text;
    throw new Error(
      "Nano Banana did not return an image." +
        (textPart ? ` Model said: ${textPart}` : ` Parts: ${JSON.stringify(parts)}`),
    );
  }

  const outBuffer = Buffer.from(imagePart.inlineData.data, "base64");
  const renderId = nanoid();
  const renderPath = `/uploads/${renderId}-render.jpg`;
  await fs.writeFile(
    path.join(process.cwd(), "public", renderPath),
    outBuffer,
  );
  console.log(
    `[generate] saved render to ${renderPath} (${(outBuffer.length / 1024).toFixed(0)}KB)`,
  );

  return { renderUrl: renderPath, promptUsed: prompt };
}
