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
import { matchAlterationsToCatalog, computeScoreFoyer, type Alteration } from "@/lib/shopping/matcher";
import type { ImageInput } from "./types";
import { getCandidateActions } from "@/lib/diy/rules";
import { evalQtyFormula, getStandardDims } from "@/lib/diy/quantities";
import type { ElementProfile, ElementDecision, DiyAction, VerdictsResult } from "@/lib/diy/types";

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

function parseElementProfiles(visionOutput: unknown): ElementProfile[] {
  const v = visionOutput as { elementProfiles?: unknown[] } | null;
  if (!v?.elementProfiles) return [];
  return (v.elementProfiles as Array<Record<string, unknown>>)
    .filter((e) => typeof e.element_id === "string")
    .map((e) => ({
      element_id: String(e.element_id),
      element: String(e.element ?? "objet"),
      category: String(e.category ?? "other"),
      description: String(e.description ?? ""),
      material_family: (e.material_family as ElementProfile["material_family"]) ?? "unknown",
      surface_features: Array.isArray(e.surface_features) ? (e.surface_features as string[]) : [],
      condition: (e.condition as ElementProfile["condition"]) ?? "good",
      movable: Boolean(e.movable ?? true),
      dims: (e.dims as ElementProfile["dims"]) ?? {},
    }));
}

async function resolveElementDecision(
  verdict: VerdictsResult["decisions"][number],
  profile: ElementProfile,
  actionMap: Map<string, DiyAction>,
): Promise<ElementDecision> {
  const action = verdict.action_slug ? actionMap.get(verdict.action_slug) : null;

  let qty: number | null = null;
  let supply_items: ElementDecision["supply_items"] = null;

  if (action) {
    const dims: ElementProfile["dims"] = Object.keys(profile.dims).length > 0
      ? profile.dims
      : (await getStandardDims(profile.category)) ?? {};

    if (action.qty_formula) {
      try {
        qty = evalQtyFormula(action.qty_formula, dims);
      } catch {
        qty = null;
      }
    }

    if (action.supplies_template && action.supplies_template.length > 0) {
      supply_items = action.supplies_template.map((s) => {
        let resolvedQty = 0;
        try {
          resolvedQty = evalQtyFormula(s.qty_formula, dims);
        } catch {
          resolvedQty = 0;
        }
        return { name: s.name, qty: resolvedQty, unit: s.unit };
      });
    }
  }

  return {
    element_id: verdict.element_id,
    description: profile.description,
    category: profile.category,
    mismatch_type: verdict.mismatch_type,
    action_slug: verdict.action_slug,
    action_label: verdict.action_label,
    qty,
    qty_unit: action?.qty_unit ?? null,
    supply_items,
    override: false,
  };
}

export async function runAnalysisPipeline(projectId: string): Promise<void> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (!project.basePhotoUrl || !project.selectedStyleId) {
    throw new Error("Project incomplete: missing basePhotoUrl or selectedStyleId");
  }

  const sourceImage = await loadImage(project.basePhotoUrl);

  // 1. Extended vision detection
  const t0 = Date.now();
  const visionPrompt = await resolvePrompt("vision_detect_extended", {}, { strict: false });
  const visionResult = await getVisionProvider(visionPrompt.prompt.provider).analyze(
    visionPrompt.resolvedTemplate,
    [sourceImage],
  );
  console.log(`[pipeline:analyze] vision_extended: ${Date.now() - t0}ms`);
  await logPipelineEvent({
    project_id: projectId,
    event: "detection",
    step: "vision_extended",
    provider: visionPrompt.prompt.provider,
    duration_ms: Date.now() - t0,
  });

  const profiles = parseElementProfiles(visionResult.parsed);
  if (profiles.length === 0) {
    await updateProject(projectId, { element_decisions: [] });
    return;
  }

  // 2. Candidate actions per element
  const candidateMap: Record<string, DiyAction[]> = {};
  const actionMap = new Map<string, DiyAction>();
  await Promise.all(
    profiles.map(async (p) => {
      const actions = await getCandidateActions(p, project.selectedStyleId!);
      candidateMap[p.element_id] = actions;
      actions.forEach((a) => actionMap.set(a.slug, a));
    }),
  );

  // 3. Grouped verdict call
  const { styleName, styleMood } = await loadStyleContext(project.selectedStyleId);
  const elementsJson = JSON.stringify(
    profiles.map(({ element_id, category, description, material_family, surface_features, condition }) => ({
      element_id, category, description, material_family, surface_features, condition,
    })),
    null, 2,
  );
  const candidateActionsJson = JSON.stringify(
    Object.fromEntries(
      Object.entries(candidateMap).map(([id, actions]) => [
        id,
        actions.map(({ slug, label, qty_formula, qty_unit }) => ({ slug, label, qty_formula, qty_unit })),
      ]),
    ),
    null, 2,
  );

  const t1 = Date.now();
  const verdictPrompt = await resolvePrompt(
    "verdict_elements",
    { styleName, styleMood, elementsJson, candidateActionsJson },
    { strict: false },
  );
  const verdictResult = await getVisionProvider(verdictPrompt.prompt.provider).analyze(
    verdictPrompt.resolvedTemplate,
    [sourceImage],
  );
  console.log(`[pipeline:analyze] verdict: ${Date.now() - t1}ms`);
  await logPipelineEvent({
    project_id: projectId,
    event: "detection",
    step: "verdict",
    provider: verdictPrompt.prompt.provider,
    duration_ms: Date.now() - t1,
  });

  const verdictsRaw = verdictResult.parsed as VerdictsResult | null;
  const verdicts = verdictsRaw?.decisions ?? [];

  // 4. Resolve decisions (qty + supplies)
  const profileMap = new Map(profiles.map((p) => [p.element_id, p]));
  const decisions: ElementDecision[] = await Promise.all(
    verdicts.map(async (v) => {
      const profile = profileMap.get(v.element_id);
      if (!profile) {
        return {
          element_id: v.element_id,
          description: "",
          category: "other",
          mismatch_type: v.mismatch_type,
          action_slug: v.action_slug,
          action_label: v.action_label,
          qty: null,
          qty_unit: null,
          supply_items: null,
          override: false,
        } satisfies ElementDecision;
      }
      return resolveElementDecision(v, profile, actionMap);
    }),
  );

  await updateProject(projectId, { element_decisions: decisions });
  console.log(`[pipeline:analyze] saved ${decisions.length} decisions`);
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
  const decisionsJson = project.element_decisions?.length
    ? JSON.stringify(project.element_decisions, null, 2)
    : undefined;

  const genCtx = {
    styleName,
    styleMood,
    roomType: project.roomType,
    furnitureDefaults,
    visionJson: JSON.stringify(visionOutput, null, 2),
    userInstructions,
    ...(decisionsJson ? { decisionsJson } : {}),
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
  const shoppingList = matchAlterationsToCatalog(alterations, project.selectedStyleId);
  const scoreFoyer = computeScoreFoyer(alterations, shoppingList);
  console.log(`[pipeline:shopping] catalog match: ${Date.now() - t1}ms, ${shoppingList.length} items`);

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
