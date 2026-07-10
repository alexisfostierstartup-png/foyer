import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenAI } from "@google/genai";

// NANO_BANANA_API_KEY (nouveau projet Google, clé "AQ.…") prioritaire sur
// GEMINI_API_KEY (ancien projet).
function resolveApiKey(): string {
  const apiKey = process.env.NANO_BANANA_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("NANO_BANANA_API_KEY / GEMINI_API_KEY is not set");
  }
  return apiKey;
}

// Les nouveaux projets Google n'ont plus accès aux modèles TEXTE 2.5 en
// generateContent (404 "no longer available to new users") — seuls les alias
// -latest et Gemini 3 passent. gemini-2.5-flash-image (Nano Banana) reste OK.
const NEW_PROJECT_MODEL_REMAP: Record<string, string> = {
  "gemini-2.5-flash-lite": "gemini-flash-lite-latest",
  "gemini-2.5-flash": "gemini-flash-latest",
};

export function resolveGeminiModel(model: string): string {
  if (!process.env.NANO_BANANA_API_KEY) return model;
  return NEW_PROJECT_MODEL_REMAP[model] ?? model;
}

let client: GoogleGenerativeAI | null = null;

// SDK historique (@google/generative-ai) — utilisé par la génération d'image.
export function getGeminiClient(): GoogleGenerativeAI {
  client ??= new GoogleGenerativeAI(resolveApiKey());
  return client;
}

let genaiClient: GoogleGenAI | null = null;

// Nouveau SDK officiel (@google/genai) — utilisé par la VISION (analyse), car il
// expose mediaResolution (HIGH) pour une analyse en haute résolution.
export function getGenAIClient(): GoogleGenAI {
  genaiClient ??= new GoogleGenAI({ apiKey: resolveApiKey() });
  return genaiClient;
}
