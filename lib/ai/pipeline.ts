import fs from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import { resolvePrompt } from "@/lib/prompts/engine";
import { loadStyleContext, loadRoomDefaults, formatUserInstructions } from "@/lib/prompts/helpers";
import { getImageProvider, getVisionProvider } from "./provider";
import { saveRender } from "./saveRender";
import { logPipelineEvent } from "./logger";
import { withTracking } from "./track";
import { getProject, updateProject } from "@/lib/storage/projects";
import type { DetectedFurniture, UserConstraints } from "@/lib/types";
import { matchAlterationsToCatalog, computeScoreFoyer, type Alteration } from "@/lib/shopping/matcher";
import { reconcilePlan } from "@/lib/shopping/reconcile";
import { buildShoppingList, builtToLegacyShoppingList } from "@/lib/shopping/build";
import type { ApplicationAuditResult, AuditElementResult, ReconciledPlan, BuiltShoppingList } from "@/lib/shopping/types";
import type { ImageInput } from "./types";
import { getAllDiyActions, getCandidateActions } from "@/lib/diy/rules";
import { evalQtyFormula, getStandardDims } from "@/lib/diy/quantities";
import type { ElementProfile, ElementDecision, DiyAction } from "@/lib/diy/types";

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


type VerdictInput = {
  element_id: string;
  mismatch_type: "none" | "surface" | "structural";
  action_slug: string | null;
  action_label: string | null;
};

async function resolveElementDecision(
  verdict: VerdictInput,
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

  // 1. Fetch actions + style context in parallel (no Gemini)
  const styleId = project.selectedStyleId;
  const [allActions, { styleName, styleMood }] = await Promise.all([
    getAllDiyActions(),
    loadStyleContext(styleId),
  ]);
  const actionMap = new Map(allActions.map((a) => [a.slug, a]));

  // ── 2. APPEL 1 — DÉTECTION (profils par élément, aucun verdict) ────────────
  const tDet = Date.now();
  const detPrompt = await resolvePrompt("vision_detect_extended", {}, { strict: false });
  const detResult = await withTracking(
    {
      step: "vision_detection",
      projectId,
      provider: detPrompt.prompt.provider,
      requestPayload: { promptName: "vision_detect_extended" },
    },
    () => getVisionProvider(detPrompt.prompt.provider).analyze(detPrompt.resolvedTemplate, [sourceImage]),
  );
  console.log(`[pipeline:analyze] detection: ${Date.now() - tDet}ms`);
  await logPipelineEvent({
    project_id: projectId,
    event: "detection",
    step: "detection",
    provider: detPrompt.prompt.provider,
    duration_ms: Date.now() - tDet,
  });

  type RawProfile = Partial<ElementProfile> & { element_id?: string };
  const detParsed = detResult.parsed;
  const rawProfiles: RawProfile[] = Array.isArray(detParsed)
    ? (detParsed as RawProfile[])
    : ((detParsed as { elementProfiles?: RawProfile[] } | null)?.elementProfiles ?? []);

  const profiles: ElementProfile[] = rawProfiles
    .filter((p) => typeof p.element_id === "string")
    .map((p) => ({
      element_id: p.element_id!,
      element: p.element ?? "",
      category: p.category ?? "other",
      description: p.description ?? "",
      material_family: p.material_family ?? "unknown",
      surface_features: p.surface_features ?? [],
      condition: p.condition ?? "good",
      movable: p.movable ?? true,
      dims: p.dims ?? {},
    }));

  if (profiles.length === 0) {
    await updateProject(projectId, { element_decisions: [] });
    return;
  }

  // ── 3. FILTRE DÉTERMINISTE — actions candidates par élément ────────────────
  // getCandidateActions garantit que le verdict ne pourra choisir qu'une action
  // réellement applicable (catégorie + requires/excludes + affinité style).
  const candidatesByElement = new Map<string, DiyAction[]>();
  await Promise.all(
    profiles.map(async (p) => {
      candidatesByElement.set(p.element_id, await getCandidateActions(p, styleId));
    }),
  );

  const elementsJson = JSON.stringify(
    profiles.map((p) => ({
      element_id: p.element_id,
      element: p.element,
      category: p.category,
      description: p.description,
      material_family: p.material_family,
      surface_features: p.surface_features,
      condition: p.condition,
    })),
    null,
    2,
  );
  const candidateActionsJson = JSON.stringify(
    profiles.map((p) => ({
      element_id: p.element_id,
      candidates: (candidatesByElement.get(p.element_id) ?? []).map((a) => ({
        slug: a.slug,
        label: a.label,
      })),
    })),
    null,
    2,
  );

  // ── 4. APPEL 2 — VERDICT (keep/customize/replace, parmi les candidates) ────
  const tVerdict = Date.now();
  const verdictPrompt = await resolvePrompt(
    "verdict_elements",
    { styleName, styleMood, elementsJson, candidateActionsJson },
    { strict: false },
  );
  const verdictResult = await withTracking(
    {
      step: "verdict",
      projectId,
      provider: verdictPrompt.prompt.provider,
      requestPayload: { promptName: "verdict_elements", prompt: verdictPrompt.resolvedTemplate.slice(0, 5000) },
    },
    () => getVisionProvider(verdictPrompt.prompt.provider).analyze(verdictPrompt.resolvedTemplate, [sourceImage]),
  );
  console.log(`[pipeline:analyze] verdict: ${Date.now() - tVerdict}ms`);
  await logPipelineEvent({
    project_id: projectId,
    event: "detection",
    step: "verdict",
    provider: verdictPrompt.prompt.provider,
    duration_ms: Date.now() - tVerdict,
  });

  type VerdictDecision = {
    element_id: string;
    mismatch_type: "none" | "surface" | "structural";
    action_slug: string | null;
    action_label: string | null;
  };
  const vParsed = verdictResult.parsed;
  const rawDecisions: VerdictDecision[] = Array.isArray(vParsed)
    ? (vParsed as VerdictDecision[])
    : ((vParsed as { decisions?: VerdictDecision[] } | null)?.decisions ?? []);
  const verdictByElement = new Map(
    rawDecisions.filter((d) => typeof d?.element_id === "string").map((d) => [d.element_id, d]),
  );

  // ── 5. Join profil + verdict → décision, en VALIDANT l'action vs candidates ─
  const decisions: ElementDecision[] = await Promise.all(
    profiles.map((profile) => {
      const v = verdictByElement.get(profile.element_id);
      let mismatch: VerdictDecision["mismatch_type"] = v?.mismatch_type ?? "none";
      let actionSlug = v?.action_slug ?? null;
      let actionLabel = v?.action_label ?? null;

      // Garde-fou déterministe. Une "personnalisation" (surface) n'a de sens que
      // s'il existe une action DIY applicable :
      //  - slug valide (dans les candidates) → on garde le choix du modèle ;
      //  - slug invalide MAIS des candidates existent → fallback sur la meilleure
      //    candidate déterministe (le modèle voulait customiser, une action existe) ;
      //  - AUCUNE candidate → l'élément n'est pas customisable (lampe, plante,
      //    tapis…) : ce n'est pas "surface" mais un remplacement → structural.
      if (mismatch === "surface") {
        const cands = candidatesByElement.get(profile.element_id) ?? [];
        const candSlugs = new Set(cands.map((a) => a.slug));
        const hasValidAction = actionSlug != null && candSlugs.has(actionSlug);
        if (!hasValidAction) {
          if (cands.length === 0) {
            console.warn(
              `[pipeline:analyze] surface sans action DIY → structural: ${profile.element_id} (${profile.category})`,
            );
            actionSlug = null;
            mismatch = "structural"; // action_label conservé = description du remplacement
          } else {
            console.warn(
              `[pipeline:analyze] slug verdict invalide '${actionSlug ?? "∅"}' → fallback candidate '${cands[0].slug}': ${profile.element_id}`,
            );
            actionSlug = cands[0].slug;
            actionLabel = actionLabel ?? cands[0].label;
          }
        }
      }

      return resolveElementDecision(
        { element_id: profile.element_id, mismatch_type: mismatch, action_slug: actionSlug, action_label: actionLabel },
        profile,
        actionMap,
      );
    }),
  );

  await updateProject(projectId, { element_decisions: decisions });
  console.log(`[pipeline:analyze] saved ${decisions.length} decisions (2 calls: detection + verdict)`);
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
  const visionResult = await withTracking(
    { step: "vision_detection", projectId, provider: visionPrompt.prompt.provider,
      requestPayload: { promptName: "vision_detect", prompt: visionPrompt.resolvedTemplate.slice(0, 5000) } },
    () => getVisionProvider(visionPrompt.prompt.provider).analyze(visionPrompt.resolvedTemplate, [sourceImage]),
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
  const genResult = await withTracking(
    { step: "generation", projectId, provider: genPrompt.prompt.provider,
      requestPayload: { promptName: "gen_wow_generic", prompt: genPrompt.resolvedTemplate.slice(0, 5000) } },
    () => getImageProvider(genPrompt.prompt.provider).generateFromText(genPrompt.resolvedTemplate, sourceImage),
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
  const result = await withTracking(
    { step: "iteration", projectId, provider: iterPrompt.prompt.provider,
      requestPayload: { promptName: "iterate_generic", userRequest, prompt: iterPrompt.resolvedTemplate.slice(0, 5000) } },
    () => getImageProvider(iterPrompt.prompt.provider).editImage(iterPrompt.resolvedTemplate, parentImage),
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
  const result = await withTracking(
    { step: "other", projectId, provider: altPrompt.prompt.provider,
      requestPayload: { promptName: "extract_alterations", prompt: altPrompt.resolvedTemplate.slice(0, 5000) } },
    () => getVisionProvider(altPrompt.prompt.provider).analyze(altPrompt.resolvedTemplate, [sourceImage, finalImage]),
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

export async function runApplicationAudit(
  projectId: string,
): Promise<ApplicationAuditResult | null> {
  const project = await getProject(projectId);
  if (!project?.basePhotoUrl || !project?.generatedRenderUrl) return null;

  const auditDecisions = (project.element_decisions ?? []).filter(
    (d) => d.mismatch_type === "none" || d.mismatch_type === "surface",
  );
  if (auditDecisions.length === 0) return { elements: [] };

  const [sourceImage, renderImage] = await Promise.all([
    loadImage(project.basePhotoUrl),
    loadImage(project.generatedRenderUrl),
  ]);

  const decisionsJson = JSON.stringify(
    auditDecisions.map(({ element_id, description, category, mismatch_type, action_slug, action_label }) => ({
      element_id, description, category, mismatch_type, action_slug, action_label,
    })),
    null,
    2,
  );

  const t0 = Date.now();
  const prompt = await resolvePrompt("audit_application", { decisionsJson }, { strict: false });
  const result = await withTracking(
    { step: "audit", projectId, provider: prompt.prompt.provider,
      requestPayload: { promptName: "audit_application", decisionsCount: auditDecisions.length, prompt: prompt.resolvedTemplate.slice(0, 5000) } },
    () => getVisionProvider(prompt.prompt.provider).analyze(prompt.resolvedTemplate, [sourceImage, renderImage]),
  );

  await logPipelineEvent({
    project_id: projectId,
    event: "audit",
    step: "application",
    provider: prompt.prompt.provider,
    duration_ms: Date.now() - t0,
  });

  const parsed = result.parsed as { elements?: AuditElementResult[] } | null;
  const auditResult: ApplicationAuditResult = {
    elements: (parsed?.elements ?? []).filter((e) => typeof e.element_id === "string"),
  };

  await updateProject(projectId, { applicationAudit: auditResult });
  console.log(`[pipeline:audit] application: ${Date.now() - t0}ms, ${auditResult.elements.length} elements`);

  return auditResult;
}

export async function runFullFinalizePipeline(projectId: string): Promise<void> {
  let project = await getProject(projectId);
  if (!project?.generatedRenderUrl) return;

  const allDecisions = (project.element_decisions ?? []) as ElementDecision[];

  // Step 1: Application audit (idempotent)
  type ProjectExtended = typeof project & {
    applicationAudit?: ApplicationAuditResult;
    reconciledPlan?: ReconciledPlan;
    builtShoppingList?: BuiltShoppingList;
    repairApplied?: boolean;
  };
  let appAudit = (project as ProjectExtended).applicationAudit ?? null;
  if (!appAudit && allDecisions.length > 0) {
    appAudit = await runApplicationAudit(projectId);
    project = await getProject(projectId);
  }

  // Step 2: Reconcile
  const repairAlreadyUsed = (project as ProjectExtended).repairApplied ?? false;
  const plan = reconcilePlan(
    allDecisions,
    appAudit ?? { elements: [] },
    { repairAlreadyUsed },
  );

  // Step 3: Repair pass (FLUX Kontext — not yet implemented)
  if (plan.repairQueue.length > 0 && !repairAlreadyUsed) {
    console.log(
      `[pipeline:finalize] ${plan.repairQueue.length} items need repair — FLUX Kontext pending, demoting to dropList`,
    );
    for (const item of plan.repairQueue) {
      plan.dropList.push({
        element_id: item.element_id,
        description: item.description,
        action_slug: item.action_slug,
        action_label: null,
        reason: "not_applied",
      });
    }
    plan.repairQueue.length = 0;
  }

  // Step 4: Build shopping list
  const built = buildShoppingList(plan, project!.selectedStyleId);
  const legacyList = builtToLegacyShoppingList(built);

  await updateProject(projectId, {
    reconciledPlan: plan,
    builtShoppingList: built,
    shoppingList: legacyList,
    scoreFoyer: built.score,
  });

  console.log(
    `[pipeline:finalize] done — diy=${built.diy.length} sh=${built.secondhand.length} new=${built.ecoNew.length} dropped=${built.dropped.length}`,
  );
}

export async function ensureFinalAssets(projectId: string): Promise<void> {
  let project = await getProject(projectId);
  if (!project?.generatedRenderUrl) return;

  // New pipeline: use element_decisions when available.
  // Also re-run if shoppingList was generated by the old matcher path
  // (builtShoppingList absent = stale data from before α-14).
  if (project.element_decisions?.length) {
    const needsRegen = !project.shoppingList || !(project as { builtShoppingList?: unknown }).builtShoppingList;
    if (needsRegen) {
      await runFullFinalizePipeline(projectId);
    }
    return;
  }

  // Legacy fallback for projects without decisions
  if (!project.alterations) {
    await extractAlterations(projectId);
    project = await getProject(projectId);
  }

  if (!project?.shoppingList && project?.alterations) {
    await matchAndSaveShoppingList(projectId);
  }
}
