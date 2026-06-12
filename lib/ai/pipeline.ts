import fs from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import { resolvePrompt } from "@/lib/prompts/engine";
import { loadStyleContext, loadRoomDefaults, formatUserInstructions } from "@/lib/prompts/helpers";
import { getImageProvider, getVisionProvider } from "./provider";
import { saveRender } from "./saveRender";
import { logPipelineEvent } from "./logger";
import { getProject, updateProject } from "@/lib/storage/projects";
import type { DetectedFurniture, UserConstraints } from "@/lib/types";
import {
  matchAlterationsToCatalog,
  matchAlterationsHybrid,
  computeScoreFoyer,
  type Alteration,
} from "@/lib/shopping/matcher";
import type { ImageInput } from "./types";

async function loadImage(url: string): Promise<ImageInput> {
  if (url.startsWith("/")) {
    const buffer = await fs.readFile(path.join(process.cwd(), "public", url));
    return buffer as unknown as ImageInput;
  }
  return { storageUrl: url };
}

function mapVisionToFurniture(visionOutput: unknown): DetectedFurniture[] {
  const v = visionOutput as {
    detectedElements?: Array<{
      element?: string;
      type?: string;
      description?: string;
      movable?: boolean;
    }>;
  } | null;
  if (!v?.detectedElements) return [];
  return v.detectedElements
    .filter((e) => e.type === "furniture" || e.movable === true)
    .map((e) => ({
      id: nanoid(),
      type: e.element ?? "objet",
      description: e.description ?? "",
      bbox: { x: 0.05, y: 0.05, w: 0.9, h: 0.9 },
      decision: "keep" as const,
    }));
}

function constraintsToChoices(c: UserConstraints) {
  const result: Record<string, unknown> = {};

  if (c.floor.change) {
    result.floor = {
      action: "change",
      preset: c.floor.preset ?? undefined,
      custom: c.floor.note || undefined,
    };
  }

  const walls: Record<string, unknown> = {};
  if (c.walls.moldings) {
    const map: Record<string, string> = {
      discret: "discreet",
      classique: "classic",
      marque: "bold",
    };
    walls.mouldings = map[c.walls.moldingStyle] ?? "classic";
  }
  if (c.walls.frames) walls.frames = true;
  if (Object.keys(walls).length > 0) result.walls = walls;

  if (Object.keys(c.furniture ?? {}).length > 0) {
    result.furniture = c.furniture;
  }

  return result;
}

export async function runGenerationPipeline(projectId: string): Promise<void> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (!project.basePhotoUrl || !project.selectedStyleId || !project.roomType) {
    throw new Error("Project incomplete: missing basePhotoUrl, selectedStyleId or roomType");
  }

  const sourceImage = await loadImage(project.basePhotoUrl);

  // 1. Vision
  const t0 = Date.now();
  const visionPrompt = await resolvePrompt("vision_detect", {}, { strict: false });
  const visionResult = await getVisionProvider(visionPrompt.prompt.provider).analyze(
    visionPrompt.resolvedTemplate,
    [sourceImage],
  );
  const visionDuration = Date.now() - t0;
  console.log(`[pipeline:generate] vision: ${visionDuration}ms`);
  await logPipelineEvent({
    project_id: projectId,
    event: "detection",
    step: "vision",
    provider: visionPrompt.prompt.provider,
    duration_ms: visionDuration,
  });

  const visionOutput = visionResult.parsed;
  const warnings = (visionOutput as { qualityWarnings?: string[] })?.qualityWarnings ?? [];
  if (warnings.length > 0) {
    console.warn("[pipeline:generate] quality warnings:", warnings);
  }

  const furniture = mapVisionToFurniture(visionOutput);
  await updateProject(projectId, { visionOutput, detectedFurniture: furniture });

  // 2. Style context
  const { styleName, styleMood } = await loadStyleContext(project.selectedStyleId);
  const furnitureDefaults = await loadRoomDefaults(project.roomType);
  const choices = project.userConstraints ? constraintsToChoices(project.userConstraints) : {};
  const userInstructions = await formatUserInstructions(choices);

  // 3. Generation
  const genCtx = {
    styleName,
    styleMood,
    roomType: project.roomType,
    furnitureDefaults,
    visionJson: JSON.stringify(visionOutput, null, 2),
    userInstructions,
  };

  const t1 = Date.now();
  const genPrompt = await resolvePrompt("gen_wow_generic", genCtx, { strict: false });
  const genResult = await getImageProvider(genPrompt.prompt.provider).generateFromText(
    genPrompt.resolvedTemplate,
    sourceImage,
  );
  console.log(`[pipeline:generate] generation: ${Date.now() - t1}ms, ${Math.round(genResult.imageBuffer.length / 1024)}KB`);

  // NOTE: audit_quality prompt exists but is intentionally not called here.
  // Audit belongs in a future "finalize" step triggered explicitly by the user,
  // not at generation time where it costs a Gemini Vision call with no action taken.

  const renderUrl = await saveRender(genResult.imageBuffer, project.storageFolder, genResult.mimeType, "first-render");
  const firstRender = project.firstRenderUrl ?? renderUrl;
  await updateProject(projectId, {
    generatedRenderUrl: renderUrl,
    firstRenderUrl: firstRender,
    iterationCount: 0,
  });
  console.log(`[pipeline:generate] done, render: ${renderUrl}`);

  await logPipelineEvent({
    project_id: projectId,
    event: "generate",
    step: "first-render",
    provider: genResult.providerUsed,
    duration_ms: genResult.durationMs,
    render_url: renderUrl,
  });
}

export async function runIterationPipeline(
  projectId: string,
  userRequest: string,
): Promise<void> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (!project.generatedRenderUrl) throw new Error("No render to iterate on");

  const iterCount = project.iterationCount ?? 0;
  const shouldRebase = iterCount >= 2 && iterCount % 2 === 0;
  const parentUrl =
    shouldRebase && project.firstRenderUrl
      ? project.firstRenderUrl
      : project.generatedRenderUrl;

  console.log(
    `[pipeline:iterate] iter=${iterCount}, rebase=${shouldRebase}, parent=${parentUrl}`,
  );

  const parentImage = await loadImage(parentUrl);

  const t1 = Date.now();
  const iterPrompt = await resolvePrompt(
    "iterate_generic",
    { userRequest },
    { strict: false },
  );
  const result = await getImageProvider(iterPrompt.prompt.provider).editImage(
    iterPrompt.resolvedTemplate,
    parentImage,
  );
  console.log(`[pipeline:iterate] generation: ${Date.now() - t1}ms, ${Math.round(result.imageBuffer.length / 1024)}KB`);

  const step = `iterate_${iterCount + 1}`;
  const resultUrl = await saveRender(result.imageBuffer, project.storageFolder, result.mimeType, step);
  await updateProject(projectId, {
    generatedRenderUrl: resultUrl,
    iterationCount: iterCount + 1,
  });
  console.log(`[pipeline:iterate] success, render: ${resultUrl}`);

  await logPipelineEvent({
    project_id: projectId,
    event: "iterate",
    step,
    provider: result.providerUsed,
    duration_ms: result.durationMs,
    render_url: resultUrl,
    metadata: { userRequest },
  });
}

export async function extractAlterations(projectId: string): Promise<void> {
  const project = await getProject(projectId);
  if (!project?.generatedRenderUrl || !project.basePhotoUrl) return;
  if (project.alterations) return;

  const sourceImage = await loadImage(project.basePhotoUrl);
  const finalImage = await loadImage(project.generatedRenderUrl);

  const t1 = Date.now();
  const altPrompt = await resolvePrompt("extract_alterations", {}, { strict: false });
  const result = await getVisionProvider(altPrompt.prompt.provider).analyze(
    altPrompt.resolvedTemplate,
    [sourceImage, finalImage],
  );
  console.log(`[pipeline:alterations] extraction: ${Date.now() - t1}ms`);

  await updateProject(projectId, { alterations: result.parsed });
}

export async function matchAndSaveShoppingList(projectId: string): Promise<void> {
  const project = await getProject(projectId);
  if (!project?.alterations) return;
  if (project.shoppingList) return;

  const raw = project.alterations as { alterations?: unknown[] } | null;
  const alterations = (raw?.alterations ?? []) as Alteration[];

  const t1 = Date.now();
  const useHybrid = process.env.USE_HYBRID_MATCHING !== "false";
  const shoppingList = useHybrid
    ? await matchAlterationsHybrid(alterations, project.selectedStyleId, project.generatedRenderUrl ?? undefined)
    : matchAlterationsToCatalog(alterations, project.selectedStyleId);
  const scoreFoyer = computeScoreFoyer(alterations, shoppingList);
  console.log(
    `[pipeline:shopping] ${useHybrid ? "hybrid" : "mock"} match: ${Date.now() - t1}ms, ${shoppingList.length} items`,
  );

  await updateProject(projectId, { shoppingList, scoreFoyer });
}

export async function ensureFinalAssets(projectId: string): Promise<void> {
  let project = await getProject(projectId);
  if (!project?.generatedRenderUrl) return;

  if (!project.alterations) {
    await extractAlterations(projectId);
    project = await getProject(projectId);
  }

  if (!project?.shoppingList && project?.alterations) {
    await matchAndSaveShoppingList(projectId);
  }
}
