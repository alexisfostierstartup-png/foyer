import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { nanoid } from "nanoid";
import { resolvePrompt } from "@/lib/prompts/engine";
import { loadStyleContext, loadRoomDefaults, formatUserInstructions, formatDesignPlan } from "@/lib/prompts/helpers";
import { getElementCategoryEnum, getElementCategories, getAllowedActionsByCategory } from "@/lib/db/assets";
import type { DecisionAction } from "@/lib/db/assets";
import { mergeShoppingItems } from "@/lib/shopping/categories";
import { getImageProvider, getVisionProvider } from "./provider";
import { saveRender } from "./saveRender";
import { logPipelineEvent } from "./logger";
import { withTracking } from "./track";
import { getProject, updateProject } from "@/lib/storage/projects";
import type { DetectedFurniture, UserConstraints, Project, ShoppingItem, ScoreFoyer } from "@/lib/types";
import { matchAlterationsToCatalog, computeScoreFoyer, type Alteration } from "@/lib/shopping/matcher";
import { reconcilePlan } from "@/lib/shopping/reconcile";
import { buildShoppingList, builtToLegacyShoppingList } from "@/lib/shopping/build";
import type { ApplicationAuditResult, AuditElementResult, ReconciledPlan, BuiltShoppingList } from "@/lib/shopping/types";
import type { ImageInput } from "./types";
import { getAllDiyActions, getCandidateActions } from "@/lib/diy/rules";
import { evalQtyFormula, getStandardDims } from "@/lib/diy/quantities";
import type { ElementProfile, ElementDecision, DiyAction } from "@/lib/diy/types";

// Artefacts dérivés de l'audit/finalize (shopping list & co). À invalider dès
// que le rendu ou les décisions changent, pour que la liste soit recalculée sur
// l'état courant (sinon elle reste figée : ex. matériel DIY sur une table déjà
// remplacée, ou liste basée sur un rendu antérieur à l'itération).
const CLEAR_FINALIZE: Partial<Project> = {
  applicationAudit: undefined,
  reconciledPlan: undefined,
  builtShoppingList: undefined,
  shoppingList: undefined,
  scoreFoyer: undefined,
  alterations: undefined,
};

async function fetchImageBytes(url: string): Promise<Buffer> {
  if (url.startsWith("/")) {
    return fs.readFile(path.join(process.cwd(), "public", url));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Colle AVANT (gauche) et APRÈS (droite) dans UNE seule image. Envoyée en une
 * seule image, l'analyse vision peut appliquer mediaResolution HIGH (ignoré sur
 * un appel multi-images) → le modèle compare les deux moitiés en haute
 * résolution et capte les détails subtils (plafonniers, cadres, blanc→beige).
 */
async function buildBeforeAfterComposite(beforeUrl: string, afterUrl: string): Promise<Buffer> {
  const [beforeRaw, afterRaw] = await Promise.all([
    fetchImageBytes(beforeUrl),
    fetchImageBytes(afterUrl),
  ]);
  const H = 1024;
  const gap = 24;
  const [before, after] = await Promise.all([
    sharp(beforeRaw).resize({ height: H }).toBuffer(),
    sharp(afterRaw).resize({ height: H }).toBuffer(),
  ]);
  const [mb, ma] = await Promise.all([sharp(before).metadata(), sharp(after).metadata()]);
  const wb = mb.width ?? H;
  const wa = ma.width ?? H;
  return sharp({
    create: { width: wb + gap + wa, height: H, channels: 3, background: "#ffffff" },
  })
    .composite([
      { input: before, left: 0, top: 0 },
      { input: after, left: wb + gap, top: 0 },
    ])
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function loadImage(url: string): Promise<ImageInput> {
  if (url.startsWith("/")) {
    const buffer = await fs.readFile(path.join(process.cwd(), "public", url));
    return buffer as unknown as ImageInput;
  }
  return { storageUrl: url };
}

function profilesToFurniture(profiles: ElementProfile[]): DetectedFurniture[] {
  return profiles
    .filter((p) => p.movable !== false)
    .map((p) => ({
      id: nanoid(),
      type: p.element || p.category || "objet",
      description: p.description ?? "",
      bbox: { x: 0.05, y: 0.05, w: 0.9, h: 0.9 },
      decision: "keep" as const,
    }));
}

type RawProfile = Partial<ElementProfile> & { element_id?: string };

/**
 * APPEL VISION DÉTECTION (vision_detect_extended) → profils par élément normalisés.
 * Partagé par l'analyse (review) ET la génération (fallback) : la détection n'est
 * lancée qu'UNE fois par projet et réutilisée (cf. runGenerationPipeline qui
 * réutilise les profils persistés par l'analyse au lieu de re-détecter).
 */
async function detectElementProfiles(
  projectId: string,
  sourceImage: ImageInput,
  label: string,
  roomType?: string,
): Promise<ElementProfile[]> {
  const tDet = Date.now();
  // Taxonomie DB-driven : la liste des catégories autorisées est injectée depuis
  // la table assets (element_category), filtrée par type de pièce.
  const categories = await getElementCategoryEnum(roomType);
  const detPrompt = await resolvePrompt("vision_detect_extended", { categories }, { strict: false });
  const detResult = await withTracking(
    {
      step: "vision_detection",
      projectId,
      provider: detPrompt.prompt.provider,
      requestPayload: { promptName: "vision_detect_extended", source: label },
    },
    () => getVisionProvider(detPrompt.prompt.provider).analyze(detPrompt.resolvedTemplate, [sourceImage]),
  );
  console.log(`[pipeline:${label}] detection: ${Date.now() - tDet}ms`);
  await logPipelineEvent({
    project_id: projectId,
    event: "detection",
    step: "detection",
    provider: detPrompt.prompt.provider,
    duration_ms: Date.now() - tDet,
  });

  const detParsed = detResult.parsed;
  const rawProfiles: RawProfile[] = Array.isArray(detParsed)
    ? (detParsed as RawProfile[])
    : ((detParsed as { elementProfiles?: RawProfile[] } | null)?.elementProfiles ?? []);

  return rawProfiles
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

// Fournitures DIY conservées dans la shopping list pour l'instant : seulement les
// matériaux cœur (peinture, moulures, tasseaux). Le reste est filtré (cf. plus bas).
const KEPT_SUPPLY_RE = /peinture|moulure|tasseau/i;

async function resolveElementDecision(
  verdict: VerdictInput,
  profile: ElementProfile,
  actionMap: Map<string, DiyAction>,
): Promise<ElementDecision> {
  const action = verdict.action_slug ? actionMap.get(verdict.action_slug) : null;

  let qty: number | null = null;
  let supply_items: ElementDecision["supply_items"] = null;

  if (action) {
    // Toujours partir des dimensions standard de la catégorie, puis écraser avec
    // les mesures RÉELLES estimées par la détection (on ignore null/0). Garantit
    // un estimatif d'emblée ; l'utilisateur pourra préciser les mesures ensuite.
    const std = (await getStandardDims(profile.category)) ?? {};
    const real = Object.fromEntries(
      Object.entries(profile.dims).filter(
        ([, v]) => typeof v === "number" && Number.isFinite(v) && v > 0,
      ),
    );
    const dims: ElementProfile["dims"] = { ...std, ...real };

    if (action.qty_formula) {
      try {
        qty = evalQtyFormula(action.qty_formula, dims);
      } catch {
        qty = null;
      }
    }

    if (action.supplies_template && action.supplies_template.length > 0) {
      // Temporaire : on ne garde que les matériaux cœur (peinture, moulures,
      // tasseaux) ; les consommables (rouleau, apprêt, papier de verre, colle,
      // vis…) sont retirés pour réduire le bruit le temps des tests. À étendre.
      supply_items = action.supplies_template
        .filter((s) => KEPT_SUPPLY_RE.test(s.name))
        .map((s) => {
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
  // Persistée dans visionOutput → réutilisée telle quelle par la génération
  // (plus de 2e appel Vision sur generate).
  const profiles = await detectElementProfiles(projectId, sourceImage, "analyze", project.roomType);

  if (profiles.length === 0) {
    await updateProject(projectId, { element_decisions: [], visionOutput: profiles, ...CLEAR_FINALIZE });
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

  // ── 6. CLAMP par allowed_actions de la taxo ────────────────────────────────
  // Une catégorie n'accepte que certaines actions (ex. assise = garder/remplacer,
  // jamais "customize"/retapisser ; sol = garder/remplacer ; mur = garder/repeindre ;
  // fenêtre/porte = garder). Si le verdict propose une action non autorisée, on la
  // ramène à l'action de CHANGEMENT autorisée la plus forte (replace > customize),
  // sinon "keep" — et on purge l'action liée (label/slug devenus caducs).
  const allowedByCat = await getAllowedActionsByCategory();
  const ACTION_OF: Record<ElementDecision["mismatch_type"], DecisionAction> = {
    none: "keep", surface: "customize", structural: "replace",
  };
  const clampedDecisions = decisions.map((d) => {
    const allowed = allowedByCat.get(d.category) ?? ["keep", "customize", "replace"];
    const requested = ACTION_OF[d.mismatch_type];
    if (allowed.includes(requested)) return d;
    const target: DecisionAction =
      requested === "keep" ? "keep"
      : allowed.includes("replace") ? "replace"
      : allowed.includes("customize") ? "customize"
      : "keep";
    const mt = target === "keep" ? "none" : target === "customize" ? "surface" : "structural";
    return { ...d, mismatch_type: mt as ElementDecision["mismatch_type"], action_slug: null, action_label: null, supply_items: null, qty: null };
  });

  await updateProject(projectId, { element_decisions: clampedDecisions, visionOutput: profiles, ...CLEAR_FINALIZE });
  console.log(`[pipeline:analyze] saved ${clampedDecisions.length} decisions (2 calls: detection + verdict)`);
}

export async function runGenerationPipeline(projectId: string): Promise<void> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (!project.basePhotoUrl || !project.selectedStyleId || !project.roomType) {
    throw new Error("Project incomplete: missing basePhotoUrl, selectedStyleId or roomType");
  }

  const sourceImage = await loadImage(project.basePhotoUrl);

  // 1. Détection — RÉUTILISE les profils produits par l'analyse (review). La
  // détection n'est plus relancée ici (1 appel Vision en moins par génération).
  // Fallback : si la génération est déclenchée sans analyse préalable, on détecte
  // une fois et on persiste.
  let profiles = Array.isArray(project.visionOutput)
    ? (project.visionOutput as ElementProfile[])
    : [];
  if (profiles.length === 0) {
    profiles = await detectElementProfiles(projectId, sourceImage, "generate", project.roomType);
    await updateProject(projectId, { visionOutput: profiles });
  } else {
    console.log(`[pipeline:generate] réutilise ${profiles.length} profils de l'analyse (pas de 2e appel Vision)`);
  }
  await updateProject(projectId, { detectedFurniture: profilesToFurniture(profiles) });

  // 2. Style context
  const { styleName, styleMood } = await loadStyleContext(project.selectedStyleId);
  const furnitureDefaults = await loadRoomDefaults(project.roomType);
  const choices = project.userConstraints ? constraintsToChoices(project.userConstraints) : {};
  const userInstructions = await formatUserInstructions(choices);

  // 3. Generation
  // Plan de design issu des décisions par élément (après review) → injecté dans
  // le prompt pour que l'image reflète réellement keep/customize/replace.
  const designPlan = formatDesignPlan(project.element_decisions);

  const genCtx = {
    styleName,
    styleMood,
    roomType: project.roomType,
    furnitureDefaults,
    visionJson: JSON.stringify(profiles, null, 2),
    userInstructions,
    designPlan: designPlan || "None — restyle freely to fit the style.",
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
    ...CLEAR_FINALIZE,
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

  // Plan de design (review) à PRÉSERVER pendant l'édition : iterate ne doit pas
  // défaire les choix keep/customize/replace déjà appliqués au rendu.
  const designPlan = formatDesignPlan(project.element_decisions);

  const t1 = Date.now();
  const iterPrompt = await resolvePrompt(
    "iterate_generic",
    { userRequest, designPlan: designPlan || "None." },
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
    // mémorise la demande d'édition → sert au diff pour distinguer un vrai
    // changement voulu d'un faux positif sur un élément gardé.
    editRequests: [...(project.editRequests ?? []), userRequest],
    ...CLEAR_FINALIZE,
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

// Résumé de l'intention (décisions de review + demandes d'édition) injecté dans
// le prompt de diff pour discriminer vrais changements vs faux positifs.
function buildIntentContext(project: Project): string {
  const decisions = (project.element_decisions ?? []) as ElementDecision[];
  const kept = decisions
    .filter((d) => d.mismatch_type === "none")
    .map((d) => `- ${d.description?.trim() || d.category}`);
  const changed = decisions
    .filter((d) => d.mismatch_type !== "none")
    .map((d) => {
      const what = d.mismatch_type === "structural" ? "à remplacer" : "à personnaliser";
      return `- ${d.description?.trim() || d.category} (${what}${d.action_label ? ` : ${d.action_label}` : ""})`;
    });
  const edits = (project.editRequests ?? []).map((r) => `- "${r}"`);

  const blocks: string[] = [];
  if (kept.length)
    blocks.push(
      `KEPT on purpose — must NOT appear as changed unless undeniably different:\n${kept.join("\n")}`,
    );
  if (changed.length) blocks.push(`Intended to change:\n${changed.join("\n")}`);
  blocks.push(
    edits.length
      ? `User live-edit requests (the only freeform changes after generation):\n${edits.join("\n")}`
      : `User live-edit requests: none.`,
  );
  return blocks.join("\n\n") || "No recorded intent.";
}

export async function extractAlterations(projectId: string): Promise<unknown> {
  const project = await getProject(projectId);
  if (!project?.generatedRenderUrl || !project.basePhotoUrl) return undefined;
  if (project.alterations) return project.alterations;

  // AVANT|APRÈS collés en une seule image → l'analyse passe en HIGH res (cf.
  // buildBeforeAfterComposite) et compare les deux moitiés en haute définition.
  const composite = (await buildBeforeAfterComposite(
    project.basePhotoUrl,
    project.generatedRenderUrl,
  )) as unknown as ImageInput;

  // Intention de design connue → aide le diff à éviter les faux positifs : un
  // élément GARDÉ (decision "none") et jamais visé par une demande d'édition ne
  // doit pas être listé comme changé (le rendu le redessine légèrement, ce n'est
  // pas un achat).
  const intent = buildIntentContext(project);

  const t1 = Date.now();
  const altPrompt = await resolvePrompt("extract_alterations", { intent }, { strict: false });
  const result = await withTracking(
    { step: "other", projectId, provider: altPrompt.prompt.provider,
      requestPayload: { promptName: "extract_alterations", prompt: altPrompt.resolvedTemplate.slice(0, 5000) } },
    () => getVisionProvider(altPrompt.prompt.provider).analyze(altPrompt.resolvedTemplate, [composite]),
  );
  console.log(`[pipeline:alterations] extraction: ${Date.now() - t1}ms`);

  await updateProject(projectId, { alterations: result.parsed });
  return result.parsed; // renvoyé pour chaîner le matching sans re-lecture DB (évite le lag read-after-write)
}

export type ShoppingAssets = { shoppingList: ShoppingItem[]; scoreFoyer: ScoreFoyer };

export async function matchAndSaveShoppingList(
  projectId: string,
  altOverride?: unknown,
): Promise<ShoppingAssets | null> {
  const project = await getProject(projectId);
  if (!project) return null;
  if (project.shoppingList) {
    return { shoppingList: project.shoppingList, scoreFoyer: project.scoreFoyer as ScoreFoyer };
  }

  // altOverride (passé par ensureFinalAssets juste après extraction) évite le
  // lag read-after-write : on n'attend pas que la DB renvoie les alterations.
  const source = altOverride ?? project.alterations;
  if (!source) return null;

  const raw = source as { alterations?: unknown[] } | null;
  const alterations = (raw?.alterations ?? []) as Alteration[];

  const t1 = Date.now();
  const shoppingList = matchAlterationsToCatalog(alterations, project.selectedStyleId);
  const scoreFoyer = computeScoreFoyer(alterations, shoppingList);
  console.log(`[pipeline:shopping] catalog match: ${Date.now() - t1}ms, ${shoppingList.length} items`);

  await updateProject(projectId, { shoppingList, scoreFoyer });
  // On RENVOIE la liste calculée → la page finale l'utilise directement, sans
  // re-lire la DB (qui peut renvoyer une réplique en retard → liste vide).
  return { shoppingList, scoreFoyer };
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

/**
 * Confirme visuellement, PARMI les candidats (décisions customize/replace),
 * lesquels ont réellement été appliqués au rendu. Renvoie l'ensemble des
 * element_id confirmés. Les éléments "keep" ne sont JAMAIS candidats → jamais
 * dans la liste (élimine les faux positifs). L'analyse est ciblée sur les seuls
 * candidats → pas de diff libre qui hallucine.
 */
async function confirmChanges(
  projectId: string,
  candidates: ElementDecision[],
  composite: ImageInput,
): Promise<{ appliedIds: Set<string>; additions: Alteration[] }> {
  const candidatesJson = JSON.stringify(
    candidates.map((d) => ({
      element_id: d.element_id,
      element: d.description,
      category: d.category,
      intended_action:
        d.action_label ||
        (d.mismatch_type === "structural" ? "remplacer cet élément" : "personnaliser cet élément"),
    })),
    null,
    2,
  );
  const prompt = await resolvePrompt("confirm_changes", { candidatesJson }, { strict: false });
  const result = await withTracking(
    {
      step: "audit",
      projectId,
      provider: prompt.prompt.provider,
      requestPayload: { promptName: "confirm_changes", candidates: candidates.length },
    },
    // Confirmation EXIGEANTE → modèle plus fort (flash discrimine bien mieux que
    // flash-lite : il rejette les éléments finalement conservés). ~1 appel.
    () =>
      getVisionProvider(prompt.prompt.provider).analyze(prompt.resolvedTemplate, [composite], {
        model: "gemini-2.5-flash",
      }),
  );
  const parsed = result.parsed as {
    results?: Array<{ element_id?: string; applied?: boolean }>;
    additions?: Array<{ element?: string; category?: string; detail?: string }>;
  } | null;

  const appliedIds = new Set<string>();
  for (const r of parsed?.results ?? []) {
    if (r.applied && typeof r.element_id === "string") appliedIds.add(r.element_id);
  }
  // Ajouts nets (présents dans APRÈS, absents dans AVANT) → à acheter.
  const additions: Alteration[] = (parsed?.additions ?? [])
    .filter((a) => a && typeof a.category === "string")
    .map((a) => ({
      element: a.element ?? (a.category as string),
      action: "added",
      category: a.category as string,
      detail: a.detail,
      shoppingImpact: "to_buy_secondhand",
    }));

  return { appliedIds, additions };
}

export async function ensureFinalAssets(projectId: string): Promise<ShoppingAssets | null> {
  const project = await getProject(projectId);
  if (!project?.generatedRenderUrl) return null;
  if (project.shoppingList) {
    return { shoppingList: project.shoppingList, scoreFoyer: project.scoreFoyer as ScoreFoyer };
  }

  // Liste = INTENTION (décisions review) GATÉE par confirmation visuelle.
  //  - "keep" (none) : jamais listé (filtre dur → zéro faux positif).
  //  - "customize"/"replace" : candidats → on vérifie sur le rendu s'ils ont
  //    VRAIMENT été appliqués (ou conservés tels quels malgré le plan).
  const decisions = (project.element_decisions ?? []) as ElementDecision[];
  const candidates = decisions.filter(
    (d) => d.mismatch_type === "surface" || d.mismatch_type === "structural",
  );

  // Une seule passe vision (composite AVANT|APRÈS) qui fait DEUX choses :
  //  - confirme quels candidats (customize/replace) ont vraiment été appliqués ;
  //  - détecte les AJOUTS nets de la génération (ex: TV, meuble TV) absents de
  //    l'original donc d'aucune décision.
  let appliedIds = new Set<string>();
  let additions: Alteration[] = [];
  if (project.basePhotoUrl) {
    const composite = (await buildBeforeAfterComposite(
      project.basePhotoUrl,
      project.generatedRenderUrl,
    )) as unknown as ImageInput;
    const r = await confirmChanges(projectId, candidates, composite);
    appliedIds = r.appliedIds;
    additions = r.additions;
  }

  // Candidat non confirmé = finalement conservé → traité comme "keep".
  const effective: ElementDecision[] = decisions.map((d) => {
    const isCandidate = d.mismatch_type === "surface" || d.mismatch_type === "structural";
    if (isCandidate && !appliedIds.has(d.element_id)) {
      return { ...d, mismatch_type: "none", action_slug: null, supply_items: null, qty: null };
    }
    return d;
  });

  // Taxonomie DB → résolution catégorie unique (build + matcher), + non-matchés visibles.
  const elementCategories = await getElementCategories().catch(() => []);
  const taxonomy = new Map(elementCategories.map((c) => [c.slug, c.catalog_category]));

  const plan = reconcilePlan(effective, { elements: [] }, { repairAlreadyUsed: false });
  const built = buildShoppingList(plan, project.selectedStyleId, taxonomy);
  const fromDecisions = builtToLegacyShoppingList(built);
  const fromAdditions = matchAlterationsToCatalog(additions, project.selectedStyleId, taxonomy);

  // Fusion décisions + ajouts, identiques regroupés en quantité (×N).
  const shoppingList = mergeShoppingItems([...fromDecisions, ...fromAdditions]);

  // Score recalculé sur la liste finale, en UNITÉS (quantité incluse).
  const unitsWhere = (pred: (i: ShoppingItem) => boolean) =>
    shoppingList.filter(pred).reduce((s, i) => s + (i.quantity ?? 1), 0);
  const shUnits = unitsWhere((i) => i.source === "secondhand");
  const ecoNewUnits = unitsWhere((i) => i.source !== "secondhand" && i.merchants.length > 0);
  const scoreFoyer: ScoreFoyer = {
    kept: built.score.kept,
    secondhand: shUnits,
    ecoNew: ecoNewUnits,
    co2SavedKg: built.score.kept * 30 + shUnits * 20 + ecoNewUnits * 5,
    totalEstimated: shoppingList.reduce(
      (s, i) => s + ((i.priceMin + i.priceMax) / 2) * (i.quantity ?? 1),
      0,
    ),
  };

  await updateProject(projectId, { shoppingList, scoreFoyer, builtShoppingList: built });
  console.log(
    `[pipeline:final] ${candidates.length} candidats → ${appliedIds.size} confirmés + ${additions.length} ajouts → ${shoppingList.length} items`,
  );
  return { shoppingList, scoreFoyer };
}
