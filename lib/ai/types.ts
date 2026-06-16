import type { Buffer } from "node:buffer";

export type ImageInput =
  | Buffer
  | { storageUrl: string }
  | { base64: string; mimeType: string };

export type UsageMetadata = {
  inputTokens?: number;
  outputTokens?: number;
  // Thinking/reasoning tokens (usageMetadata.thoughtsTokenCount). Facturés au
  // tarif OUTPUT chez Google. Nul sur flash-lite sans thinkingConfig, mais
  // capté pour ne pas sous-compter si un modèle/réglage les active.
  thinkingTokens?: number;
  imagesIn?: number;
  imagesOut?: number;
};

export type GenerationResult = {
  imageBuffer: Buffer;
  mimeType: string;
  rawResponse: unknown;
  providerUsed: string;
  modelUsed?: string;
  durationMs: number;
  usage?: UsageMetadata;
};

export type VisionResult = {
  text: string;
  parsed: unknown;
  rawResponse: unknown;
  providerUsed: string;
  modelUsed?: string;
  durationMs: number;
  usage?: UsageMetadata;
  responsePayload?: unknown;
};

export interface ImageProvider {
  readonly name: string;
  generateFromText(
    prompt: string,
    sourceImage?: ImageInput,
  ): Promise<GenerationResult>;
  editImage(prompt: string, sourceImage: ImageInput): Promise<GenerationResult>;
}

export interface VisionProvider {
  readonly name: string;
  analyze(prompt: string, images: ImageInput[]): Promise<VisionResult>;
}
