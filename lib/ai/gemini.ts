import fs from "fs/promises";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ARCHITECTURE_DETECTION_PROMPT } from "./prompts";
import type { ArchitectureContext } from "./prompts";
import type { DetectedFurniture } from "@/lib/types";

let client: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  client ??= new GoogleGenerativeAI(apiKey);
  return client;
}

export type DetectionResult = {
  architecture: ArchitectureContext;
  furniture: Omit<DetectedFurniture, "id" | "decision">[];
  roomStyle: string;
  qualityWarnings: string[];
};

async function readPublicImage(publicImagePath: string) {
  const buffer = await fs.readFile(
    path.join(process.cwd(), "public", publicImagePath),
  );
  return {
    buffer,
    inline: {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType: "image/jpeg",
      },
    },
  };
}

/**
 * Analyse une photo de pièce avec Gemini Vision.
 * Retourne l'architecture + le mobilier détecté + le style existant.
 */
export async function detectArchitectureAndFurniture(
  publicImagePath: string,
): Promise<DetectionResult> {
  const model = getGeminiClient().getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" },
  });

  const { buffer, inline } = await readPublicImage(publicImagePath);
  console.log(
    `[detect] image: ${publicImagePath}, ${(buffer.length / 1024).toFixed(0)}KB`,
  );

  const startedAt = Date.now();
  const result = await model.generateContent([
    ARCHITECTURE_DETECTION_PROMPT,
    inline,
  ]);
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  const text = result.response.text();
  console.log(`[detect] response time: ${elapsed}s`);

  let parsed: DetectionResult;
  try {
    parsed = JSON.parse(text) as DetectionResult;
  } catch (err) {
    console.error("[detect] failed to parse JSON response:", text);
    throw err;
  }

  console.log(
    `[detect] detected ${parsed.furniture?.length ?? 0} furniture pieces`,
  );
  if (parsed.qualityWarnings?.length) {
    console.log("[detect] quality warnings:", parsed.qualityWarnings);
  }

  return parsed;
}
