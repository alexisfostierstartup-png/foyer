import { resolvePrompt } from "@/lib/prompts/engine";
import { loadStyleContext, loadRoomDefaults } from "@/lib/prompts/helpers";
import { getImageProvider, getVisionProvider } from "./provider";
import { saveRender } from "./saveRender";
import { nanoid } from "nanoid";
import type { ImageInput } from "./types";

async function loadImageFromUrl(url: string): Promise<ImageInput> {
  if (url.startsWith("/")) {
    const fs = await import("fs/promises");
    const path = await import("path");
    const buffer = await fs.readFile(path.join(process.cwd(), "public", url));
    return buffer as unknown as ImageInput;
  }
  return { storageUrl: url };
}

export interface ProRenderInput {
  renderId: string;
  sourcePhotoUrl: string;
  ambianceSlug: string;
  roomType: string;
  globalConstraints?: string | null;
}

export interface ProRenderResult {
  renderUrl: string;
  alterations: unknown;
}

export async function runProRenderPipeline(
  input: ProRenderInput,
): Promise<ProRenderResult> {
  const { renderId, sourcePhotoUrl, ambianceSlug, roomType, globalConstraints } = input;

  const sourceImage = await loadImageFromUrl(sourcePhotoUrl);

  // 1. Vision
  const visionPrompt = await resolvePrompt("vision_detect", {}, { strict: false });
  const visionResult = await getVisionProvider(visionPrompt.prompt.provider).analyze(
    visionPrompt.resolvedTemplate,
    [sourceImage],
  );
  const visionOutput = visionResult.parsed;

  // 2. Style context
  const { styleName, styleMood } = await loadStyleContext(ambianceSlug);
  const furnitureDefaults = await loadRoomDefaults(roomType).catch(() => "");

  const userInstructions = globalConstraints
    ? `PRO GLOBAL CONSTRAINTS:\n${globalConstraints}`
    : "None — use your judgment within the guidance.";

  // 3. Generation
  const genCtx = {
    styleName,
    styleMood,
    roomType,
    furnitureDefaults,
    visionJson: JSON.stringify(visionOutput, null, 2),
    userInstructions,
  };

  const genPrompt = await resolvePrompt("gen_wow_generic", genCtx, { strict: false });
  const genResult = await getImageProvider(genPrompt.prompt.provider).generateFromText(
    genPrompt.resolvedTemplate,
    sourceImage,
  );

  // 4. Save render to Supabase Storage
  const storageFolder = `pro/${renderId}`;
  const renderUrl = await saveRender(
    genResult.imageBuffer,
    storageFolder,
    genResult.mimeType,
    "first-render",
  );

  // 5. Extract alterations (best-effort, don't fail the whole render)
  let alterations: unknown = null;
  try {
    const finalImage = await loadImageFromUrl(renderUrl);
    const altPrompt = await resolvePrompt("extract_alterations", {}, { strict: false });
    const altResult = await getVisionProvider(altPrompt.prompt.provider).analyze(
      altPrompt.resolvedTemplate,
      [sourceImage, finalImage],
    );
    alterations = altResult.parsed;
  } catch {
    // Non-blocking — alteration extraction is optional
  }

  return { renderUrl, alterations };
}
