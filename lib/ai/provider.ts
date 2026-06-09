import type { ImageProvider, VisionProvider } from "./types";
import { NanoBananaProvider } from "./providers/nanoBanana";
import { FluxKontextProvider } from "./providers/fluxKontext";
import { GeminiVisionProvider } from "./providers/geminiVision";

export function getImageProvider(name: string): ImageProvider {
  switch (name) {
    case "nano_banana":
      return new NanoBananaProvider();
    case "flux_kontext":
      return new FluxKontextProvider();
    default:
      throw new Error(`Unknown image provider: ${name}`);
  }
}

export function getVisionProvider(name: string): VisionProvider {
  switch (name) {
    case "gemini_vision":
      return new GeminiVisionProvider();
    default:
      throw new Error(`Unknown vision provider: ${name}`);
  }
}
