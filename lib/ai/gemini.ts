import { GoogleGenerativeAI } from "@google/generative-ai";

let client: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  client ??= new GoogleGenerativeAI(apiKey);
  return client;
}

// Wrapper around Gemini Vision used to detect furniture and room architecture.
// Real implementation lands in a later phase.
export async function detectRoom(): Promise<never> {
  throw new Error("detectRoom not implemented yet");
}
