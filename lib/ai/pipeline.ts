import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { nanoid } from "nanoid";
import { resolvePrompt } from "@/lib/prompts/engine";
import { loadStyleContext, loadRoomDefaults, loadRoomRemoveCategories, formatUserInstructions, formatDesignPlan } from "@/lib/prompts/helpers";
import { getElementCategoryEnum, getElementCategories, getAllowedActionsByCategory } from "@/lib/db/assets";
import type { DecisionAction } from "@/lib/db/assets";
import { mergeShoppingItems } from "@/lib/shopping/categories";
import { getImageProvider, getVisionProvider } from "./provider";
import { saveRender } from "./saveRender";
import { logPipelineEvent } from "./logger";
import { withTracking } from "./track";
import { getProject, updateProject } from "@/lib/storage/projects";
import type { DetectedFurniture, UserConstraints, Project, ShoppingItem, ScoreFoyer } from "@/lib/types";
import { matchAlterationsToCatalog, type Alteration } from "@/lib/shopping/matcher";
import { reconcilePlan } from "@/lib/shopping/reconcile";
import { buildShoppingList, builtToLegacyShoppingList } from "@/lib/shopping/build";
import { matchPartnerProductsBlendBatch, matchFloorProductsBlend } from "@/lib/shopping/partnerMatch";
import { extractCrop, type Bbox } from "@/lib/shopping/crop";
import { matchPaintByColor, getChangedWallColors } from "@/lib/shopping/paintMatch";
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

export async function fetchImageBytes(url: string): Promise<Buffer> {
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
// Géométrie du panneau APRÈS dans le composite (fractions 0-1 sur la largeur totale) →
// permet de reprojeter une bbox donnée sur le composite vers le RENDU seul (crop).
type Composite = { buffer: Buffer; afterLeftFrac: number; afterWidthFrac: number };

export async function buildBeforeAfterComposite(beforeUrl: string, afterUrl: string): Promise<Composite> {
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
  const total = wb + gap + wa;
  const buffer = await sharp({
    create: { width: total, height: H, channels: 3, background: "#ffffff" },
  })
    .composite([
      { input: before, left: 0, top: 0 },
      { input: after, left: wb + gap, top: 0 },
    ])
    .jpeg({ quality: 90 })
    .toBuffer();
  return { buffer, afterLeftFrac: (wb + gap) / total, afterWidthFrac: wa / total };
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

// Récapitule l'architecture FIXE détectée (ouvertures + fixtures notables) en une
// ligne chiffrée injectée dans la génération → cible claire qui limite l'invention
// ou le déplacement de fenêtres/portes/escalier sur les angles serrés.
function buildFixedFeaturesSummary(profiles: ElementProfile[]): string {
  const count = (cat: string) => profiles.filter((p) => p.category === cat).length;
  const parts: string[] = [];
  const w = count("window"); if (w) parts.push(`${w} fenêtre(s)`);
  const fd = count("french_door"); if (fd) parts.push(`${fd} porte(s)-fenêtre(s)`);
  const d = count("door"); if (d) parts.push(`${d} porte(s)`);
  const wo = count("wall_opening"); if (wo) parts.push(`${wo} ouverture(s)/passage(s) vers une autre pièce`);
  const KW = /escalier|staircase|stair|chemin|fireplace|radiat|poutre|beam|colonne|column|pilier|pillar/i;
  const fixtures = profiles
    .filter((p) => !["window", "french_door", "door", "wall_opening"].includes(p.category) && KW.test(`${p.element} ${p.description}`))
    .map((p) => (p.element || p.category).trim().toLowerCase());
  parts.push(...new Set(fixtures));
  return parts.length ? parts.join(", ") : "—";
}

// Liste des éléments DÉTECTÉS à retirer = intersection des catégories parasites de
// la pièce (statique, depuis l'asset room_defaults.removeCategories) et de ce qui
// est réellement sur la photo. Générique : aucune logique room-type en dur ici.
function buildRemoveList(profiles: ElementProfile[], categories: string[]): string {
  if (!categories.length) return "(none)";
  const set = new Set(categories);
  const items = profiles
    .filter((p) => set.has(p.category))
    .map((p) => (p.description?.trim() || p.element || p.category));
  return items.length ? items.join("; ") : "(none)";
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
      color: p.color ?? "",
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
  const removeCategories = await loadRoomRemoveCategories(project.roomType);

  const genCtx = {
    styleName,
    styleMood,
    roomType: project.roomType,
    furnitureDefaults,
    visionJson: JSON.stringify(profiles, null, 2),
    fixedFeatures: buildFixedFeaturesSummary(profiles),
    // Éléments détectés à retirer pour ce type de pièce (asset ∩ détection).
    removeList: buildRemoveList(profiles, removeCategories),
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

// 3 briefs de layout → 3 rendus distincts (la diversité vient des briefs).
// Volontairement formulés en AGENCEMENT DE MOBILIER PUR (pas de repère
// architectural type "mur", "coin", "fenêtre") : citer l'archi poussait le modèle
// à déplacer l'escalier / inventer une fenêtre. La coquille reste verrouillée par
// les règles + le compte exact du prompt.
const DISPOSITION_BRIEFS = [
  "Layout 1 — convivial : group the seating closely around the coffee table, sofa and armchair facing each other for an intimate conversation area.",
  "Layout 2 — ouvert : orient the main sofa toward the brightest part of the room and float the seating slightly away from the walls to open up the central circulation.",
  "Layout 3 — aéré : spread the furniture out for an open, airy feel — generous spacing and circulation, seating loosely arranged across the room.",
];

/**
 * Variations d'agencement (feature experts) : 3 appels image, un par brief de
 * layout → 3 rendus PLEIN FORMAT distincts. Réutilise profils/style/design plan.
 * Ne touche pas generatedRenderUrl (le user en choisira un ensuite).
 */
export async function runDispositionsPipeline(projectId: string): Promise<string[]> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (!project.basePhotoUrl || !project.selectedStyleId || !project.roomType) {
    throw new Error("Project incomplete: missing basePhotoUrl, selectedStyleId or roomType");
  }

  const sourceImage = await loadImage(project.basePhotoUrl);

  let profiles = Array.isArray(project.visionOutput) ? (project.visionOutput as ElementProfile[]) : [];
  if (profiles.length === 0) {
    profiles = await detectElementProfiles(projectId, sourceImage, "dispositions", project.roomType);
    await updateProject(projectId, { visionOutput: profiles });
  }

  const { styleName, styleMood } = await loadStyleContext(project.selectedStyleId);
  const furnitureDefaults = await loadRoomDefaults(project.roomType);
  const choices = project.userConstraints ? constraintsToChoices(project.userConstraints) : {};
  const userInstructions = await formatUserInstructions(choices);
  const designPlan = formatDesignPlan(project.element_decisions);

  const removeCategories = await loadRoomRemoveCategories(project.roomType);

  const baseCtx = {
    styleName,
    styleMood,
    roomType: project.roomType,
    furnitureDefaults,
    visionJson: JSON.stringify(profiles, null, 2),
    fixedFeatures: buildFixedFeaturesSummary(profiles),
    removeList: buildRemoveList(profiles, removeCategories),
    userInstructions,
    designPlan: designPlan || "None — restyle freely to fit the style.",
  };

  // 3 générations en parallèle (1 par brief).
  const urls = await Promise.all(
    DISPOSITION_BRIEFS.map(async (dispositionBrief, i) => {
      const t1 = Date.now();
      const genPrompt = await resolvePrompt(
        "gen_wow_3_dispositions",
        { ...baseCtx, dispositionBrief },
        { strict: false },
      );
      const result = await withTracking(
        { step: "generation", projectId, provider: genPrompt.prompt.provider,
          requestPayload: { promptName: "gen_wow_3_dispositions", disposition: i + 1, prompt: genPrompt.resolvedTemplate.slice(0, 5000) } },
        () => getImageProvider(genPrompt.prompt.provider).generateFromText(genPrompt.resolvedTemplate, sourceImage),
      );
      console.log(`[pipeline:dispositions] #${i + 1} ${Date.now() - t1}ms`);
      const url = await saveRender(result.imageBuffer, project.storageFolder, result.mimeType, `disposition_${i + 1}`);
      await logPipelineEvent({
        project_id: projectId, event: "generate", step: `disposition_${i + 1}`,
        provider: result.providerUsed, duration_ms: result.durationMs, render_url: url,
      });
      return url;
    }),
  );

  await updateProject(projectId, { dispositionsRenderUrls: urls });
  return urls;
}

export async function runIterationPipeline(
  projectId: string,
  userRequest: string,
): Promise<void> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (!project.generatedRenderUrl) throw new Error("No render to iterate on");

  const iterCount = project.iterationCount ?? 0;
  // On édite TOUJOURS le rendu courant (plus de "rebase" vers le 1er rendu, qui
  // faisait perdre les itérations précédentes). Chaque édition part de l'image à
  // jour → les changements déjà appliqués sont préservés.
  const parentUrl = project.generatedRenderUrl;
  console.log(`[pipeline:iterate] iter=${iterCount}, parent=${parentUrl}`);

  const parentImage = await loadImage(parentUrl);

  const t1 = Date.now();
  // PAS de design plan ici : l'image rendue EST l'état établi. Le ré-injecter
  // pousserait le modèle à RE-exécuter les REPLACE (il re-dessine le canapé
  // d'origine, change des lampes non demandées). On préserve l'image telle quelle
  // et on n'applique QUE userRequest.
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
export type ShoppingAssets = { shoppingList: ShoppingItem[]; scoreFoyer: ScoreFoyer };

/**
 * Confirme visuellement, PARMI les candidats (décisions customize/replace),
 * lesquels ont réellement été appliqués au rendu. Renvoie l'ensemble des
 * element_id confirmés. Les éléments "keep" ne sont JAMAIS candidats → jamais
 * dans la liste (élimine les faux positifs). L'analyse est ciblée sur les seuls
 * candidats → pas de diff libre qui hallucine.
 */
// Reprojette une bbox donnée sur le COMPOSITE (normalisée 0-1 sur la largeur totale)
// vers le RENDU seul (panneau APRÈS). Retourne null si la box tombe dans le panneau
// AVANT (gauche) — le modèle s'est trompé de moitié → on préfère pas de crop.
function mapCompositeBoxToRender(
  box: Bbox,
  afterLeftFrac: number,
  afterWidthFrac: number,
): Bbox | null {
  if (afterWidthFrac <= 0) return null;
  const centerX = box.x + box.w / 2;
  if (centerX < afterLeftFrac - 0.02) return null; // centre côté AVANT → rejet
  const rx = (box.x - afterLeftFrac) / afterWidthFrac;
  const rw = box.w / afterWidthFrac;
  const x = Math.max(0, Math.min(1, rx));
  const y = Math.max(0, Math.min(1, box.y));
  return { x, y, w: Math.min(1 - x, rw), h: Math.min(1 - y, box.h) };
}

// bbox tolérante : array [x,y,w,h] OU objet {x,y,w,h}, valeurs 0-1.
function parseBbox(raw: unknown): Bbox | null {
  let x, y, w, h;
  if (Array.isArray(raw) && raw.length === 4) [x, y, w, h] = raw;
  else if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    [x, y, w, h] = [o.x, o.y, o.w, o.h];
  } else return null;
  if ([x, y, w, h].some((v) => typeof v !== "number" || !Number.isFinite(v))) return null;
  return { x: x as number, y: y as number, w: w as number, h: h as number };
}

export async function confirmChanges(
  projectId: string,
  candidates: ElementDecision[],
  composite: ImageInput,
  afterLeftFrac: number,
  afterWidthFrac: number,
): Promise<{ appliedIds: Set<string>; judgedIds: Set<string>; additions: Alteration[]; afterById: Map<string, string>; bboxById: Map<string, Bbox> }> {
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
    results?: Array<{ element_id?: string; changed?: boolean; after?: string; bbox?: unknown }>;
    additions?: Array<{ element?: string; category?: string; detail?: string }>;
  } | null;

  const appliedIds = new Set<string>();
  const judgedIds = new Set<string>(); // éléments explicitement jugés par l'audit
  // Description de l'APRÈS par élément → la liste de courses reflète ce que
  // l'élément est DEVENU dans le rendu (ex. tapis bleu/jaune), pas l'original.
  const afterById = new Map<string, string>();
  // bbox de l'élément dans le RENDU (APRÈS) → crop pour le matching image↔image.
  const bboxById = new Map<string, Bbox>();
  for (const r of parsed?.results ?? []) {
    if (typeof r.element_id !== "string") continue;
    judgedIds.add(r.element_id);
    if (r.changed) appliedIds.add(r.element_id); // appliedIds = éléments que le rendu a CHANGÉS
    if (r.after && r.after.trim()) afterById.set(r.element_id, r.after.trim());
    const compBox = parseBbox(r.bbox);
    if (compBox) {
      const renderBox = mapCompositeBoxToRender(compBox, afterLeftFrac, afterWidthFrac);
      if (renderBox) bboxById.set(r.element_id, renderBox);
    }
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

  return { appliedIds, judgedIds, additions, afterById, bboxById };
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
  // On vérifie sur le RENDU tous les éléments shoppables (pas seulement les changements
  // planifiés) : le générateur modifie parfois des éléments décidés "keep" — ex. un tapis
  // changé lors d'une itération. On exclut juste l'architecture pure (jamais "achetée").
  const NON_DETECTABLE = new Set(["ceiling", "door", "french_door", "window", "wall_opening"]);
  const candidates = decisions.filter((d) => !NON_DETECTABLE.has(d.category));

  // Une seule passe vision (composite AVANT|APRÈS) qui fait DEUX choses :
  //  - confirme quels candidats (customize/replace) ont vraiment été appliqués ;
  //  - détecte les AJOUTS nets de la génération (ex: TV, meuble TV) absents de
  //    l'original donc d'aucune décision.
  let appliedIds = new Set<string>();
  let judgedIds = new Set<string>();
  let additions: Alteration[] = [];
  let afterById = new Map<string, string>();
  let bboxById = new Map<string, Bbox>();
  if (project.basePhotoUrl) {
    const comp = await buildBeforeAfterComposite(project.basePhotoUrl, project.generatedRenderUrl);
    const r = await confirmChanges(
      projectId,
      candidates,
      comp.buffer as unknown as ImageInput,
      comp.afterLeftFrac,
      comp.afterWidthFrac,
    );
    appliedIds = r.appliedIds;
    judgedIds = r.judgedIds;
    additions = r.additions;
    afterById = r.afterById;
    bboxById = r.bboxById;
  }

  // La LISTE reflète le RENDU, pas seulement les décisions initiales :
  //  - élément jugé CHANGÉ par l'audit → listé (achat). S'il était "keep" (ex. tapis
  //    modifié à l'itération) → promu en remplacement structurel.
  //  - élément jugé inchangé → keep (même si un changement était planifié mais pas fait).
  //  - non jugé (architecture exclue / audit incomplet) → on préserve, candidats présumés OK.
  const effective: ElementDecision[] = decisions.map((d) => {
    const wasCandidate = d.mismatch_type === "surface" || d.mismatch_type === "structural";
    const judged = judgedIds.has(d.element_id);
    const changed = appliedIds.has(d.element_id); // appliedIds = éléments que le rendu a changés
    const after = afterById.get(d.element_id);

    if (judged && changed) {
      let base: ElementDecision = wasCandidate
        ? d
        : { ...d, mismatch_type: "structural", action_slug: null, supply_items: null, qty: null };
      if (after) base = { ...base, description: after };
      // Mur changé sans fourniture configurée (ex. action fresco_wall → supply_items []) :
      // on injecte une fourniture "Peinture" pour qu'il apparaisse ET soit matché par couleur.
      if (base.category === "wall" && base.mismatch_type === "surface" && (base.supply_items?.length ?? 0) === 0) {
        base = { ...base, supply_items: [{ name: "Peinture", qty: 1, unit: "pot" }] };
      }
      return base;
    }
    if (judged && !changed) {
      return wasCandidate
        ? { ...d, mismatch_type: "none", action_slug: null, supply_items: null, qty: null }
        : d;
    }
    if (wasCandidate) return after ? { ...d, description: after } : d;
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

  // CROP du rendu par item : on découpe la zone de l'élément (bbox de l'audit) dans le
  // RENDU → embedding IMAGE (cible image↔image, bien plus discriminant que texte→image).
  // bbox absente (ajout net, audit incomplet) → crop null → blend en texte seul.
  const renderBytes = await fetchImageBytes(project.generatedRenderUrl).catch((e) => {
    console.warn("[crop] rendu illisible, texte seul:", e instanceof Error ? e.message : e);
    return null;
  });
  const crops = await Promise.all(
    shoppingList.map(async (it) => {
      if (!renderBytes || !it.elementId) return null;
      const box = bboxById.get(it.elementId);
      return box ? extractCrop(renderBytes, box) : null;
    }),
  );

  // Matching NEUF en BLEND (crop image + description texte), pondéré par catégorie ×
  // source — EN PLUS du raw audit. UN appel Jina texte + UN appel Jina crops (batch).
  const matchResults = await matchPartnerProductsBlendBatch(
    shoppingList.map((it, i) => ({
      category: it.category,
      description: `${it.name} ${it.detail ?? ""}`.trim(),
      crop: crops[i],
    })),
  );
  shoppingList.forEach((it, i) => { it.matches = matchResults[i]; });

  // SOL : blend FILTRÉ par matériau (un parquet bois ne doit pas matcher un carrelage
  // effet bois). Poids 'floor' : w image baissé → le motif joue dans la description.
  for (let i = 0; i < shoppingList.length; i++) {
    const it = shoppingList[i];
    if (it.category !== "floor") continue;
    it.matches = await matchFloorProductsBlend(`${it.name} ${it.detail ?? ""}`.trim(), crops[i]);
  }

  // CALIBRATION (ÉTAPE 4) : par item blend matché, on trace catégorie, présence de crop,
  // source du top-1, score blend ET les 2 cosines décomposés (image + texte). Permet de
  // régler w/seuils sur données réelles et de vérifier que le texte rattrape les cosines
  // image basses (ex. le canapé vu de dos : sim_image faible, sim_text qui sauve le match).
  for (let i = 0; i < shoppingList.length; i++) {
    const top = shoppingList[i].matches?.[0];
    if (!top || (top.simImage === undefined && top.simText === undefined)) continue;
    console.log(
      `[match:calib] ${shoppingList[i].category} "${shoppingList[i].name.slice(0, 36)}" ` +
        `crop=${crops[i] ? "oui" : "non"} → ${top.source_type} ` +
        `score=${top.similarity.toFixed(3)} img=${top.simImage ?? "—"} txt=${top.simText ?? "—"} (${top.merchant})`,
    );
  }

  // PEINTURE : matching par COULEUR (le cosine image ne sert à rien). On compare AVANT|APRÈS
  // pour ne lister QUE les murs REPEINTS (les murs inchangés ne sont pas dans la liste),
  // 1 item par mur, classé par proximité de teinte (ΔE).
  const paintItems = shoppingList.filter((it) => it.source === "diy" && /peinture|peindre/i.test(it.name));
  if (paintItems.length > 0 && project.generatedRenderUrl && project.basePhotoUrl) {
    try {
      const composite = (await buildBeforeAfterComposite(
        project.basePhotoUrl,
        project.generatedRenderUrl,
      )).buffer as unknown as ImageInput;
      const wallColors = await getChangedWallColors(composite); // murs repeints uniquement
      const template = paintItems[0];
      // Retire les items peinture génériques, ajoute 1 item par mur REPEINT (0 si aucun).
      for (const p of paintItems) {
        const i = shoppingList.indexOf(p);
        if (i >= 0) shoppingList.splice(i, 1);
      }
      for (const w of wallColors) {
        shoppingList.push({
          ...template,
          id: `paint-${w.hex.replace("#", "")}`,
          name: wallColors.length > 1 ? `Peinture — ${w.label}` : "Peinture",
          targetHex: w.hex,
          matches: await matchPaintByColor(w.hex),
        });
      }
    } catch (e) {
      console.warn("[paint] matching couleur échoué:", e instanceof Error ? e.message : e);
    }
  }

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
