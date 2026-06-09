import type { Buffer } from "node:buffer";

export type ImageInput =
  | Buffer
  | { storageUrl: string }
  | { base64: string; mimeType: string };

export type GenerationResult = {
  imageBuffer: Buffer;
  mimeType: string;
  rawResponse: unknown;
  providerUsed: string;
  durationMs: number;
};

export type VisionResult = {
  text: string;
  parsed: unknown;
  rawResponse: unknown;
  providerUsed: string;
  durationMs: number;
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
