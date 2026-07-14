import type { ImageProvider, VisionProvider } from "./types";
import { NanoBananaProvider } from "./providers/nanoBanana";
import { NanoBanana2Provider } from "./providers/nanoBanana2";
import { FluxKontextProvider } from "./providers/fluxKontext";
import { GeminiVisionProvider } from "./providers/geminiVision";

// Bascule de modèle image SANS redéploiement ni migration de prompts : IMAGE_PROVIDER=nano_banana_2
// fait passer TOUTE la génération sur Gemini 3 Pro Image. Sert à comparer NB1 et NB2 sur les
// mêmes prompts — c'est le modèle, pas le prompt, qui invente portes, balcons et rosaces
// effacées (hypothèse Alexis 2026-07-14 : « sur le web, je n'ai JAMAIS ce souci »).
export function getImageProvider(name: string): ImageProvider {
  switch (process.env.IMAGE_PROVIDER || name) {
    case "nano_banana":
      return new NanoBananaProvider();
    case "nano_banana_2":
      return new NanoBanana2Provider();
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
