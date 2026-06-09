import type { ImageProvider, GenerationResult } from "../types";

export class FluxKontextProvider implements ImageProvider {
  readonly name = "flux_kontext";

  async generateFromText(): Promise<GenerationResult> {
    throw new Error(
      "FLUX Kontext not implemented yet. Set up fal.ai client and FAL_KEY env var.",
    );
  }

  async editImage(): Promise<GenerationResult> {
    throw new Error(
      "FLUX Kontext not implemented yet. Set up fal.ai client and FAL_KEY env var.",
    );
  }
}
