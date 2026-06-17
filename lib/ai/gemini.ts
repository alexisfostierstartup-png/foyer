import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenAI } from "@google/genai";

let client: GoogleGenerativeAI | null = null;

// SDK historique (@google/generative-ai) — utilisé par la génération d'image.
export function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  client ??= new GoogleGenerativeAI(apiKey);
  return client;
}

let genaiClient: GoogleGenAI | null = null;

// Nouveau SDK officiel (@google/genai) — utilisé par la VISION (analyse), car il
// expose mediaResolution (HIGH) pour une analyse en haute résolution.
export function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  genaiClient ??= new GoogleGenAI({ apiKey });
  return genaiClient;
}
