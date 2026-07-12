import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { nanoid } from "nanoid";
import { resolvePrompt } from "@/lib/prompts/engine";
import { loadStyleContext, loadRoomDefaults, loadRoomRemoveCategories, formatUserInstructions, formatDesignPlan, ARCH_SURFACE_CATEGORIES, type UserChoicesInput } from "@/lib/prompts/helpers";
import { getElementCategoryEnum, getElementCategories, getAllowedActionsByCategory, getCategoryKeywordRemap, getFloorPresets } from "@/lib/db/assets";
import type { DecisionAction, ElementCategory } from "@/lib/db/assets";
import { mergeShoppingItems, resolveCatalogCategory } from "@/lib/shopping/categories";
import { getImageProvider, getVisionProvider } from "./provider";
import { saveRender } from "./saveRender";
import { logPipelineEvent } from "./logger";
import { withTracking } from "./track";
import { isTransientAiError } from "./retry";
import { computeTextEmbedding } from "@/lib/embeddings/jina";
import { getProject, updateProject } from "@/lib/storage/projects";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { DetectedFurniture, UserConstraints, Project, ShoppingItem, ScoreFoyer, RenderAnalysis } from "@/lib/types";
import { matchAlterationsToCatalog, type Alteration } from "@/lib/shopping/matcher";
import { enforceExpertIntegratedPieces } from "@/lib/shopping/integratedPieces";
import { SEAT_BLUR_CANARY, LIGHT_CATS, MIRROR_CATS, blurSeatsInSource } from "./seatBlurCanary";
import { mapRequestsToCategories, carryOverLockedMatches } from "@/lib/shopping/listLock";
import { reconcilePlan } from "@/lib/shopping/reconcile";
import { buildShoppingList, builtToLegacyShoppingList } from "@/lib/shopping/build";
import { matchPartnerProductsBlendBatch, matchFloorProductsBlend } from "@/lib/shopping/partnerMatch";
import { buildAttrsInstruction, CATEGORY_W, ATTR_WEIGHTS } from "@/lib/shopping/attributeScore";
import { schemaForCategory, getSchemaV3 } from "@/lib/shopping/attributeSchemaV3";
import { extractCrop, isFrameTruncatedFragment, dominantHexFromImage, parseBox2d, type Bbox } from "@/lib/shopping/crop";
import { matchPaintByColor, getChangedWallColors, type WallColor } from "@/lib/shopping/paintMatch";
import type { ImageInput } from "./types";
import { getAllDiyActions, getCandidateActions, getRenderableActionSlugs } from "@/lib/diy/rules";
import { evalQtyFormula, getStandardDims } from "@/lib/diy/quantities";
import type { ElementProfile, ElementDecision, DiyAction } from "@/lib/diy/types";

// Artefacts dérivés de l'audit/finalize (shopping list & co). À invalider dès
// que le rendu ou les décisions changent, pour que la liste soit recalculée sur
// l'état courant (sinon elle reste figée : ex. matériel DIY sur une table déjà
// remplacée, ou liste basée sur un rendu antérieur à l'itération).
export const CLEAR_FINALIZE: Partial<Project> = {
  applicationAudit: undefined,
  reconciledPlan: undefined,
  builtShoppingList: undefined,
  shoppingList: undefined,
  scoreFoyer: undefined,
  alterations: undefined,
  // Un nouveau rendu invalide les 3 dispositions (elles dérivent du même
  // render/style) : on les efface pour que la page /dispositions les régénère
  // au lieu de réafficher — ou que le verrou d'idempotence ne renvoie — du périmé.
  dispositionsRenderUrls: undefined,
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
// Nombre de points lumineux FIXES (plafonnier/applique) détectés — partagé entre le
// résumé fixedFeatures (prompt) et le contrôle post-génération (enforceLightpointCount).
export async function countLightpoints(profiles: ElementProfile[]): Promise<number> {
  return (await lightpointProfiles(profiles)).length;
}

async function lightpointProfiles(profiles: ElementProfile[]): Promise<ElementProfile[]> {
  const cats = new Set((await getElementCategories()).filter((c) => c.fixed_lightpoint).map((c) => c.slug));
  return profiles.filter((p) => cats.has(p.category));
}

// Ligne LIGHT FIXTURES injectée dans LE PLAN (la section la mieux suivie par le
// modèle image — mesuré sur les REPLACE) : fix « au premier generate » du luminaire
// ajouté au lieu de swappé. Le repère de position (description courte) ancre le
// POINT, le style vient du reste du prompt. Cas 0 explicite (pièce sans plafonnier).
// Taille de pièce → densité d'ameublement (demande Alexis 2026-07-10 : pièces
// parfois trop vides alors que l'espace le permet ; petit vs grand salon ne se
// meublent pas pareil). Détectée par la vision (room_scale), persistée projet.
export function buildRoomScaleLine(roomScale?: "small" | "medium" | "large"): string {
  if (roomScale === "large") {
    return `\n- ROOM SIZE — LARGE: furnish it to its full potential. If generous floor area remains empty, add a complementary style-matching zone or pieces (e.g. a dining corner, a reading nook with armchair + floor lamp, a larger sofa, plants and decor) — the room must feel complete and lived-in, never sparse. Keep circulation clear and respect every rule above.`;
  }
  if (roomScale === "small") {
    return `\n- ROOM SIZE — SMALL: keep to the essentials, correctly scaled (no oversized furniture); prioritize breathing room and circulation over adding pieces.`;
  }
  if (roomScale === "medium") {
    return `\n- ROOM SIZE — MEDIUM: comfortably furnished — the main zone complete (seating, tables, lighting, textiles, wall decor), no large bare stretch of floor or wall; still airy, never crowded.`;
  }
  return "";
}

export async function buildLightingPlanLine(profiles: ElementProfile[], styleName: string): Promise<string> {
  const lights = await lightpointProfiles(profiles);
  if (lights.length === 0) {
    return `- LIGHT FIXTURES: this room has NO ceiling or wall light point — add NONE (a floor/table lamp is allowed only per the lighting rule).`;
  }
  const spots = lights.map((l) => (l.description?.trim() || l.element || l.category).replace(/\s+/g, " ").slice(0, 70)).join(" · ");
  // « pendant over the dining table » : biais récurrent du modèle — il en ajoute
  // une même quand aucun point électrique n'existe là (banc out-lightblur s02).
  return `- LIGHT FIXTURES (exactly ${lights.length}): swap each existing fixture — ${spots} — for a ${styleName} fixture AT ITS EXACT SAME ceiling/wall point. The result contains EXACTLY ${lights.length} fixed fixture(s): not one more, none added elsewhere, none duplicated. A dining table does NOT automatically get a pendant above it — only if one of the existing points is already there.`;
}

// ── AUDIT→RETOUCHE ciblé : points lumineux ──────────────────────────────────
// La règle prompt (« swap in place, never add ») reste violée par le modèle image
// (~1 rendu sur 5 : suspension AJOUTÉE au lieu de remplacer le point existant).
// Après génération : comptage vision des luminaires fixes du rendu (flash-lite,
// ~3 s) ; si excédent vs l'original → UNE passe d'édition qui retire l'excédent.
// DERNIER RECOURS, désactivé par défaut (décision Alexis 2026-07-10 : le premier
// generate doit être bon — le fix principal est la ligne LIGHT FIXTURES du plan).
// Activer avec LIGHTPOINT_AUTOFIX=1 si la ligne de plan ne suffit pas en pratique.
const LIGHTPOINT_AUTOFIX = process.env.LIGHTPOINT_AUTOFIX === "1";

export async function enforceLightpointCount(
  projectId: string,
  gen: { imageBuffer: Buffer; mimeType: string },
  expected: number,
  providerName: string,
): Promise<{ imageBuffer: Buffer; mimeType: string }> {
  if (!LIGHTPOINT_AUTOFIX) return gen;
  try {
    const t0 = Date.now();
    const countRes = await getVisionProvider("gemini_vision").analyze(
      `Compte les luminaires FIXES visibles dans cette photo d'intérieur : suspensions/plafonniers accrochés au plafond + appliques murales. N'inclus PAS les lampadaires ni lampes à poser. Réponds en JSON strict: {"fixtures": <nombre>}`,
      [gen.imageBuffer as unknown as ImageInput],
      { model: "gemini-2.5-flash-lite", mediaResolution: "medium" },
    );
    const parsed = countRes.parsed as { fixtures?: number } | null;
    const found = typeof parsed?.fixtures === "number" ? parsed.fixtures : null;
    if (found == null || found <= expected) return gen;

    console.warn(`[lightfix] ${projectId}: ${found} luminaires fixes au lieu de ${expected} → retouche ciblée`);
    const editPrompt =
      `This interior photo must contain EXACTLY ${expected} fixed light fixture(s) (ceiling pendants/flush mounts + wall sconces combined)` +
      ` — it currently shows ${found}. REMOVE the ${found - expected} extra fixture(s): keep the fixture(s) at the room's original electrical` +
      ` point(s), remove duplicates and added ones, and cleanly restore the ceiling or wall surface behind them. Keep EVERYTHING ELSE strictly` +
      ` identical — furniture, decor, colors, floor/table lamps, lighting mood, camera framing. Photorealistic.`;
    const edited = await withTracking(
      { step: "generation", projectId, provider: providerName, requestPayload: { promptName: "lightpoint_autofix", prompt: editPrompt } },
      () => getImageProvider(providerName).editImage(editPrompt, gen.imageBuffer as unknown as ImageInput),
    );
    await logPipelineEvent({ project_id: projectId, event: "generate", step: "lightpoint-autofix", provider: providerName, duration_ms: Date.now() - t0, metadata: { found, expected } });
    return { imageBuffer: edited.imageBuffer, mimeType: edited.mimeType };
  } catch (e) {
    console.warn(`[lightfix] ${projectId}: contrôle/retouche échoué (non bloquant):`, e instanceof Error ? e.message : e);
    return gen;
  }
}

// ── AUDIT→RETOUCHE ciblé : sièges morphés ───────────────────────────────────
// Le modèle image « remplace » un siège en gardant sa silhouette (retapissage /
// chimère pieds anciens + dossier neuf) malgré TOUTES les couches de prompt
// (sémantique REPLACE, axes silhouette, archétypes, descriptions retirées) —
// plafond du texte atteint (bancs 07-09/07-10). Dernier recours demandé par
// Alexis (« IL FAUT TROUVER UN MOYEN ») : après génération, UN contrôle vision
// compare original/rendu sur les sièges ; si même modèle re-skinné → UNE passe
// d'édition qui NE VOIT PLUS l'original (donc plus d'ancre) remplace le(s)
// siège(s) par un vrai modèle différent. DÉSACTIVÉ PAR DÉFAUT — consigne ferme
// Alexis (2× 2026-07-10) : JAMAIS de double génération automatique ; ce
// mécanisme n'existe qu'en dernier recours explicite via SEAT_AUTOFIX=1.
const SEAT_AUTOFIX = process.env.SEAT_AUTOFIX === "1";
const SEAT_CATS = new Set(["sofa", "armchair", "chair", "dining_chair", "bench"]);

export async function enforceSeatReplacement(
  projectId: string,
  sourceImage: ImageInput,
  gen: { imageBuffer: Buffer; mimeType: string },
  profiles: ElementProfile[],
  styleName: string,
  providerName: string,
): Promise<{ imageBuffer: Buffer; mimeType: string }> {
  if (!SEAT_AUTOFIX) return gen;
  const seats = profiles.filter((p) => SEAT_CATS.has(p.category));
  if (seats.length === 0) return gen;
  try {
    const t0 = Date.now();
    const list = seats.map((s) => `${s.element_id} (${s.category}: ${(s.description ?? "").slice(0, 60)})`).join(" | ");
    const check = await getVisionProvider("gemini_vision").analyze(
      `IMAGE 1 = pièce d'origine. IMAGE 2 = redesign. Sièges d'origine : ${list}.
Pour chaque siège, IMAGE 2 montre-t-elle le MÊME modèle que IMAGE 1 — silhouette/structure identique, seulement retissé, recoloré ou partiellement modifié (hybride) — ou un modèle GENUINEMENT différent ?
JSON strict: {"same_model": [<element_ids des sièges restés le même modèle re-skinné>]}`,
      [sourceImage, gen.imageBuffer as unknown as ImageInput],
      { model: "gemini-2.5-flash", mediaResolution: "medium" },
    );
    const parsed = check.parsed as { same_model?: string[] } | null;
    const bad = (parsed?.same_model ?? []).map((id) => seats.find((s) => s.element_id === id)).filter(Boolean) as ElementProfile[];
    if (bad.length === 0) return gen;

    console.warn(`[seatfix] ${projectId}: ${bad.length} siège(s) re-skinnés au lieu de remplacés → passe d'édition`);
    const targets = bad.map((s) => `the ${s.category.replace(/_/g, " ")}`).join(" and ");
    const editPrompt =
      `Replace ${targets} in this photo with COMPLETELY different ${styleName}-style models: new silhouette, new arms, new back, new legs — ` +
      `a coherent real-world product, in the same position and at a realistic size. Multiple identical seats (e.g. dining chairs) all become the ` +
      `SAME new model, same count, tucked at their table facing it. Keep EVERYTHING else in the image strictly identical — walls, floor, ` +
      `lighting, decor, all other furniture, camera framing and image proportions. Photorealistic.`;
    const edited = await withTracking(
      { step: "generation", projectId, provider: providerName, requestPayload: { promptName: "seat_autofix", prompt: editPrompt } },
      () => getImageProvider(providerName).editImage(editPrompt, gen.imageBuffer as unknown as ImageInput),
    );
    await logPipelineEvent({ project_id: projectId, event: "generate", step: "seat-autofix", provider: providerName, duration_ms: Date.now() - t0, metadata: { seats: bad.map((s) => s.element_id) } });
    return { imageBuffer: edited.imageBuffer, mimeType: edited.mimeType };
  } catch (e) {
    console.warn(`[seatfix] ${projectId}: contrôle/retouche échoué (non bloquant):`, e instanceof Error ? e.message : e);
    return gen;
  }
}

/**
 * bbox du PRODUIT dans sa photo catalogue (box_2d Gemini, convention native 0-1000).
 * Sert à embedder le produit sur son OBJET et non sur toute la scène : une photo
 * « lifestyle » (le meuble noyé dans un canapé + étagères + plantes) donnait un cosinus
 * bien plus bas qu'un packshot, indépendamment du meuble — le score image mesurait le
 * cadrage du photographe autant que le produit (QA Alexis 2026-07-11).
 * Renvoie null si l'objet remplit déjà la photo (packshot : rien à gagner) ou en échec.
 */
export async function detectProductBbox(imageBytes: Buffer): Promise<Bbox | null> {
  try {
    const res = await getVisionProvider("gemini_vision").analyze(
      "Cette image est une photo produit de mobilier ou de décoration, parfois en situation " +
        "(le produit posé dans une pièce meublée). Donne la boîte englobante SERRÉE du PRODUIT " +
        "PRINCIPAL vendu — pas les meubles du décor autour, pas les objets posés dessus. " +
        'JSON STRICT : {"box_2d": [ymin, xmin, ymax, xmax]} en ENTIERS 0-1000 (origine en haut à gauche).',
      [imageBytes as unknown as ImageInput],
      { model: "gemini-flash-lite-latest", mediaResolution: "medium" },
    );
    const box = parseBox2d((res.parsed as { box_2d?: unknown } | null)?.box_2d);
    if (!box) return null;
    // Packshot : l'objet occupe déjà ~toute l'image → cropper n'apporte rien et le
    // léger inset risquerait de rogner le produit.
    if (box.w * box.h > 0.8) return null;
    return box;
  } catch {
    return null;
  }
}

export async function buildFixedFeaturesSummary(profiles: ElementProfile[]): Promise<string> {
  const count = (cat: string) => profiles.filter((p) => p.category === cat).length;
  const parts: string[] = [];
  const w = count("window"); if (w) parts.push(`${w} fenêtre(s)`);
  const fd = count("french_door"); if (fd) parts.push(`${fd} porte(s)-fenêtre(s)`);
  const d = count("door"); if (d) parts.push(`${d} porte(s)`);
  const wo = count("wall_opening"); if (wo) parts.push(`${wo} ouverture(s)/passage(s) vers une autre pièce`);
  // 0 est aussi une information (même leçon que les lightpoints ci-dessous) :
  // sans compte explicite, le modèle invente une fenêtre pour y accrocher les
  // rideaux du style (dispo 3 TvrnYMMyaELuMIc5pMRmL 2026-07-10). Le cas d'une
  // ouverture RATÉE par la détection reste couvert par « THE PHOTO IS THE
  // TRUTH » du SHELL_LOCK (préserver ce qui est visible gagne toujours).
  if (w + fd === 0) parts.push(`NO window or french door visible (0) — NEVER add one, and NO curtains anywhere`);
  // Points lumineux FIXES (plafonnier/applique) — data-driven via le flag
  // fixed_lightpoint de la taxonomie. Le NOMBRE exact injecté verrouille le
  // compte : le swap en place reste permis, l'AJOUT de luminaires (lustre,
  // rail de spots, plafonniers surnuméraires) devient une violation explicite
  // du set à reproduire. 0 est aussi une information ("no ceiling light").
  const lp = await countLightpoints(profiles);
  parts.push(
    lp > 0
      ? `EXACTLY ${lp} fixed ceiling/wall light point(s) — swap fixtures in place, never add one`
      : `NO ceiling or wall light point (0) — never add a ceiling or wall light`,
  );
  // Fixtures FIXES à reproduire à l'identique (jamais déplacer/supprimer/ajouter/recolorer).
  // ⚠️ inclut le CHAUFFE-EAU/ballon (était absent → la génération le supprimait), et le poêle.
  const KW = /escalier|staircase|stair|chemin|fireplace|po[êe]le|radiat|chauffe[- ]?eau|water[- ]?heater|ballon|cumulus|poutre|beam|colonne|column|pilier|pillar/i;
  const fixtures = profiles
    .filter((p) => !["window", "french_door", "door", "wall_opening"].includes(p.category) && KW.test(`${p.element} ${p.description}`))
    .map((p) => (p.element || p.category).trim().toLowerCase());
  // COMPTE par type (ex. "2 radiator") au lieu de dédupliquer → la génération préserve le
  // NOMBRE exact (sinon elle en ajoute/déplace ; ex. radiateur dupliqué + bougé observé).
  const counts = new Map<string, number>();
  for (const f of fixtures) counts.set(f, (counts.get(f) ?? 0) + 1);
  for (const [name, n] of counts) parts.push(n > 1 ? `${n} ${name}` : name);
  return parts.length ? parts.join(", ") : "—";
}

// Liste des éléments DÉTECTÉS à retirer = intersection des catégories parasites de
// la pièce (statique, depuis l'asset room_defaults.removeCategories) et de ce qui
// est réellement sur la photo. Générique : aucune logique room-type en dur ici.
export function buildRemoveList(profiles: ElementProfile[], categories: string[]): string {
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
// Instruction bbox ajoutée EN CODE pour la seule détection d'inventaire du RENDU (pas de
// modif du prompt partagé → la détection de base/review n'est pas touchée).
// box_2d [ymin, xmin, ymax, xmax] 0-1000 : convention NATIVE de Gemini, la seule
// qu'il respecte. L'ancien format [x, y, w, h] 0-1 était rendu tantôt en 0-1,
// tantôt en 0-1000 façon box_2d selon l'élément → pins hors de leur objet
// (lampadaires sur le tapis, bibliothèque au sol — QA Alexis 2026-07-11).
const BBOX_SUFFIX =
  "\n\nEN PLUS de la structure ci-dessus, ajoute à CHAQUE élément de elementProfiles : " +
  '(1) "box_2d": [ymin, xmin, ymax, xmax] — boîte englobante SERRÉE autour de l\'objet dans CETTE image, ' +
  "en ENTIERS de 0 à 1000 (origine en haut à gauche : ymin/ymax = bord haut/bas, xmin/xmax = bord gauche/droit). " +
  "Respecte EXACTEMENT cet ordre et cette échelle 0-1000 ; " +
  '(2) "color_hex": la couleur DOMINANTE de l\'objet (pas du fond/sol) en hexadécimal "#rrggbb".';

// Inventaire du RENDU (matching shopping) : les champs DIY ne servent qu'à l'analyse
// de l'ORIGINE (verdict/actions), pas ici. Les omettre réduit les tokens de sortie —
// la latence d'un appel vision y est proportionnelle (~28 s → objectif ~15 s).
// `movable` reste ÉMIS : reconcileRenderAdditions filtre dessus (le parseur mettrait
// true par défaut, mais on perdrait le filtre des éléments fixes).
const LEAN_INVENTORY_SUFFIX =
  "\n\nSORTIE ALLÉGÉE : pour CET inventaire, OMETS complètement les champs " +
  '"material_family", "surface_features", "condition" et "dims" de chaque élément ' +
  '(ne les émets pas du tout). Conserve bien "movable" et tous les autres champs.';

export // Ajouté EN CODE à TOUTES les détections (photo de base ET inventaire du rendu) :
// un objet vu uniquement dans un miroir/reflet n'existe pas dans la pièce — le
// compter créait des lignes de courses fantômes (feedback démo 2026-07-09).
const NO_REFLECTION_SUFFIX =
  "\n\nIMPORTANT — MIROIRS : n'inventorie JAMAIS un objet visible UNIQUEMENT dans un miroir, " +
  "une vitre ou un reflet. Seuls les objets physiquement présents dans la pièce comptent. " +
  "Le miroir lui-même est un élément (mirror) ; son contenu reflété n'en est pas." +
  "\n\nIMPORTANT — OUVERTURES : inventorie TOUTES les ouvertures, même partiellement visibles ou " +
  "en bord de cadre. Une porte majoritairement VITRÉE (petits carreaux, style atelier/verrière, " +
  "porte-fenêtre) = french_door, même intérieure et même OUVERTE — jamais une simple door, jamais " +
  "ignorée. Rater une ouverture fait construire un mur à sa place en génération (grave).";

export async function detectElementProfiles(
  projectId: string,
  sourceImage: ImageInput,
  label: string,
  roomType?: string,
  opts?: { withBbox?: boolean },
  // Sortie annexe optionnelle (non cassante) : room_scale estimé par la même
  // détection — petit/moyen/grand salon ne se meublent pas pareil.
  out?: { roomScale?: "small" | "medium" | "large" },
): Promise<ElementProfile[]> {
  const tDet = Date.now();
  // Taxonomie DB-driven : la liste des catégories autorisées est injectée depuis
  // la table assets (element_category), filtrée par type de pièce.
  const categories = await getElementCategoryEnum(roomType);
  const detPrompt = await resolvePrompt("vision_detect_extended", { categories }, { strict: false });
  // withBbox = inventaire du rendu : on émet AUSSI les attrs V3 (tous les meubles du rendu
  // sont des achats potentiels) → score structuré pour les AJOUTS (pièces vides), et on
  // OMET les champs DIY (lean) : cet inventaire ne sert qu'au matching.
  const ROOM_SCALE_SUFFIX =
    `\nROOM SCALE: wrap the output as {"room_scale": "small|medium|large", "elementProfiles": [...]} — ` +
    `room_scale = overall floor area of the room judged from the photo (small <15m², medium 15-25m², large >25m²).`;
  const template = opts?.withBbox
    ? detPrompt.resolvedTemplate + NO_REFLECTION_SUFFIX + BBOX_SUFFIX + buildAttrsInstruction() + LEAN_INVENTORY_SUFFIX
    : detPrompt.resolvedTemplate + NO_REFLECTION_SUFFIX + ROOM_SCALE_SUFFIX;
  const detResult = await withTracking(
    {
      step: "vision_detection",
      projectId,
      provider: detPrompt.prompt.provider,
      requestPayload: { promptName: "vision_detect_extended", source: label },
    },
    () => getVisionProvider(detPrompt.prompt.provider).analyze(template, [sourceImage]),
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
  if (out) {
    const rs = (detParsed as { room_scale?: string } | null)?.room_scale;
    if (rs === "small" || rs === "medium" || rs === "large") out.roomScale = rs;
  }

  // Remap déterministe : la détection range souvent les fixtures techniques
  // reconnaissables (radiateur, chauffe-eau, escalier) dans "other" → on les
  // reclasse vers leur vraie catégorie via les mots-clés DB, pour que la review
  // applique les bonnes actions (ex. chauffe-eau = garder seul). Data-driven :
  // ajouter une fixture = ajouter une catégorie + keywords, zéro code ici.
  const remap = await getCategoryKeywordRemap(roomType);
  const remapCategory = (category: string, element: string, description: string): string => {
    const hay = `${element} ${description}`.toLowerCase();
    // Signal FORT : la description COMMENCE par un mot-clé d'une autre catégorie
    // (« Pouf rond en tissu… » classé chair → pouf). Corrige les mauvaises classes
    // de la détection, pas seulement les "other" (bug projet fpvZ : poufs en chair
    // → matching chaises/housses).
    const leading = remap.find((r) => r.slug !== category && r.keywords.some((k) => hay.startsWith(k.toLowerCase())));
    if (leading) return leading.slug;
    if (category !== "other") return category;
    const hit = remap.find((r) => r.keywords.some((k) => hay.includes(k.toLowerCase())));
    return hit?.slug ?? category;
  };

  return rawProfiles
    .filter((p) => typeof p.element_id === "string")
    .map((p) => ({
      element_id: p.element_id!,
      element: p.element ?? "",
      category: remapCategory(p.category ?? "other", p.element ?? "", p.description ?? ""),
      description: p.description ?? "",
      color: p.color ?? "",
      material_family: p.material_family ?? "unknown",
      surface_features: p.surface_features ?? [],
      condition: p.condition ?? "good",
      movable: p.movable ?? true,
      dims: p.dims ?? {},
      // box_2d (convention native) d'abord ; repli sur l'ancien champ bbox.
      bbox: opts?.withBbox
        ? (parseBox2d((p as { box_2d?: unknown }).box_2d) ??
           parseBbox((p as { bbox?: unknown }).bbox) ??
           undefined)
        : undefined,
      color_hex: opts?.withBbox ? parseHex((p as { color_hex?: unknown }).color_hex) : undefined,
      attrs: opts?.withBbox && p.attrs && typeof p.attrs === "object" && !Array.isArray(p.attrs)
        ? (p.attrs as Record<string, unknown>)
        : undefined,
    }));
}

// "#rrggbb" valide (sinon undefined → pas de bonus couleur).
function parseHex(v: unknown): string | undefined {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim().toLowerCase() : undefined;
}

export function constraintsToChoices(c: UserConstraints) {
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
  action_label_en?: string | null;
};

// Fournitures DIY conservées dans la shopping list pour l'instant : seulement les
// matériaux cœur (peinture, moulures, tasseaux). Le reste est filtré (cf. plus bas).
const KEPT_SUPPLY_RE = /peinture|moulure|tasseau/i;

// Exporté : aussi utilisé par la route decisions (override review → attache
// l'action candidate en mode DIY beta, avec fournitures/quantités résolues).
export async function resolveElementDecision(
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
    action_label_en: verdict.action_label_en ?? null,
    qty,
    qty_unit: action?.qty_unit ?? null,
    supply_items,
    override: false,
  };
}

// ── Levier perf B : détection anticipée ─────────────────────────────────────
// La détection (inventaire factuel de la photo) ne dépend PAS du style — seul le
// verdict en dépend. On la précalcule dès l'upload (via after()), pendant que le
// user remplit contraintes + style ; l'analyse la RÉUTILISE si la photo n'a pas
// changé → la review n'attend plus que le verdict. Dédup en mémoire par photo
// (analyse lancée pendant le précalcul → même appel partagé).
const inflightDetection = new Map<string, Promise<ElementProfile[]>>();

async function detectSourceProfilesCached(
  projectId: string,
  project: Project,
  label: string,
): Promise<ElementProfile[]> {
  const photoUrl = project.basePhotoUrl;
  const cached = Array.isArray(project.visionOutput) ? (project.visionOutput as ElementProfile[]) : [];
  if (cached.length > 0 && project.visionDetectionPhotoUrl === photoUrl) {
    console.log(`[pipeline:${label}] réutilise ${cached.length} profils détectés (photo inchangée)`);
    return cached;
  }
  const key = `${projectId}:${photoUrl}`;
  const inflight = inflightDetection.get(key);
  if (inflight) return inflight;
  const run = (async () => {
    const sourceImage = await loadImage(photoUrl);
    const out: { roomScale?: "small" | "medium" | "large" } = {};
    const profiles = await detectElementProfiles(projectId, sourceImage, label, project.roomType, undefined, out);
    if (profiles.length > 0) {
      await updateProject(projectId, { visionOutput: profiles, visionDetectionPhotoUrl: photoUrl, ...(out.roomScale ? { roomScale: out.roomScale } : {}) });
    }
    return profiles;
  })().finally(() => inflightDetection.delete(key));
  inflightDetection.set(key, run);
  return run;
}

/** Fire-and-forget : précalcule la détection dès l'upload (la review n'attendra que le verdict). */
export function precomputeDetection(projectId: string): void {
  getProject(projectId)
    .then((p) => (p?.basePhotoUrl ? detectSourceProfilesCached(projectId, p, "upload-precompute") : []))
    .then((profiles) => console.log(`[pipeline:precompute:upload] ${profiles.length} profils détectés`))
    .catch((e: unknown) =>
      console.warn("[pipeline:precompute:upload] échec (non bloquant):", e instanceof Error ? e.message : e),
    );
}

// Résolution du verdict (2e appel vision). Défaut : env VERDICT_MEDIA_RESOLUTION
// (high|medium), sinon "high". La route /analyze peut la surcharger par requête
// (?vres=medium) pour A/B tester HIGH vs MEDIUM sans redéploiement.
export function defaultVerdictResolution(): "high" | "medium" {
  return process.env.VERDICT_MEDIA_RESOLUTION === "medium" ? "medium" : "high";
}

export async function runAnalysisPipeline(
  projectId: string,
  opts?: { verdictResolution?: "high" | "medium" },
): Promise<void> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (!project.basePhotoUrl || !project.selectedStyleId) {
    throw new Error("Project incomplete: missing basePhotoUrl or selectedStyleId");
  }

  const sourceImage = await loadImage(project.basePhotoUrl);

  // 1. Fetch actions + style context in parallel (no Gemini)
  // Flux DIY beta (?diy=beta à la création) : actions beta + beta_categories +
  // filtre niveau + exclusions dures de style. Sinon comportement historique.
  const diyOpts = project.diyMode === "beta" ? ({ mode: "beta" } as const) : undefined;
  if (diyOpts) console.log(`[pipeline:analyze] mode DIY beta actif (projet ${projectId})`);
  const styleId = project.selectedStyleId;
  const [allActions, { styleName, styleMood }] = await Promise.all([
    getAllDiyActions(diyOpts),
    loadStyleContext(styleId),
  ]);
  const actionMap = new Map(allActions.map((a) => [a.slug, a]));

  // ── 2. APPEL 1 — DÉTECTION (profils par élément, aucun verdict) ────────────
  // Persistée dans visionOutput → réutilisée telle quelle par la génération
  // (plus de 2e appel Vision sur generate). Si le précalcul upload a déjà tourné
  // (levier B), on réutilise ses profils → la review n'attend que le verdict.
  const profiles = await detectSourceProfilesCached(projectId, project, "analyze");

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
      candidatesByElement.set(p.element_id, await getCandidateActions(p, styleId, diyOpts));
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
  // Beta : variante à labels MONO-instruction — les « X ou Y » du verdict
  // produisent des rendus ambigus (plafond « ton sur ton » peint en navy,
  // « verre fumé » interprété en dôme miroir — projet JwnjVV3W).
  const verdictSlug = diyOpts ? "verdict_elements_diy_beta" : "verdict_elements";
  const tVerdict = Date.now();
  const verdictPrompt = await resolvePrompt(
    verdictSlug,
    { styleName, styleMood, elementsJson, candidateActionsJson },
    { strict: false },
  );
  const verdictResult = await withTracking(
    {
      step: "verdict",
      projectId,
      provider: verdictPrompt.prompt.provider,
      requestPayload: { promptName: verdictSlug, prompt: verdictPrompt.resolvedTemplate.slice(0, 5000) },
    },
    () =>
      getVisionProvider(verdictPrompt.prompt.provider).analyze(verdictPrompt.resolvedTemplate, [sourceImage], {
        mediaResolution: opts?.verdictResolution ?? defaultVerdictResolution(),
      }),
  );
  console.log(`[pipeline:analyze] verdict: ${Date.now() - tVerdict}ms (res=${opts?.verdictResolution ?? defaultVerdictResolution()})`);
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
    // Verdict beta uniquement : label anglais pour le prompt image.
    action_label_en?: string | null;
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
        {
          element_id: profile.element_id,
          mismatch_type: mismatch,
          action_slug: actionSlug,
          action_label: actionLabel,
          action_label_en: v?.action_label_en ?? null,
        },
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
    // Mode beta : le filtre déterministe des candidats (catégories ∪ beta_categories
    // + requires + level + exclusions style) fait foi. Si une customisation a
    // survécu avec une action VALIDE, on ne la clampe pas — la taxo statique
    // allowed_actions (ex. assise = jamais customize) reflète l'exemption du flux
    // standard, que le beta teste précisément.
    if (diyOpts && d.mismatch_type === "surface" && d.action_slug) return d;
    const allowed = allowedByCat.get(d.category) ?? ["keep", "customize", "replace"];
    const requested = ACTION_OF[d.mismatch_type];
    if (allowed.includes(requested)) return d;
    const target: DecisionAction =
      requested === "keep" ? "keep"
      : allowed.includes("replace") ? "replace"
      : allowed.includes("customize") ? "customize"
      : "keep";
    const mt = target === "keep" ? "none" : target === "customize" ? "surface" : "structural";
    return { ...d, mismatch_type: mt as ElementDecision["mismatch_type"], action_slug: null, action_label: null, action_label_en: null, supply_items: null, qty: null };
  });

  // ── 7. LIBELLÉ DE CUSTOMISATION ────────────────────────────────────────────
  // action_label n'est affiché QUE sous "Personnaliser" → il doit TOUJOURS décrire
  // le "comment" (peindre, teinter…), jamais "Conserver"/"Remplacer - incompatible".
  // Pour toute catégorie qui autorise "customize", on garantit un libellé d'action
  // DIY réel (verdict surface, sinon meilleure candidate). Sinon le bouton
  // Personnaliser n'existe pas → on laisse action_label tel quel.
  const finalDecisions = clampedDecisions.map((d) => {
    const allowed = allowedByCat.get(d.category) ?? ["keep", "customize", "replace"];
    if (!allowed.includes("customize")) return d;
    if (d.mismatch_type === "surface" && d.action_label) return d; // déjà un vrai "comment"
    const cands = candidatesByElement.get(d.element_id) ?? [];
    if (cands.length === 0) return d; // aucune action DIY → rien à proposer
    return { ...d, action_label: cands[0].label };
  });

  // ── 8. SOL PILOTÉ PAR LE CHOIX USER ────────────────────────────────────────
  // La review ("ce qu'on va faire") doit refléter la directive EXPLICITE du sol,
  // pas seulement le verdict de style. Règle produit : on garde le sol existant
  // SAUF contre-indication user. floor.change=false → Garder ; floor.change=true →
  // Remplacer par le revêtement choisi (preset + note), visible dans la description.
  const floorChoice = project.userConstraints?.floor;
  const decisionsWithFloor = await (async () => {
    if (!floorChoice) return finalDecisions;
    const presetLabel = floorChoice.preset
      ? (await getFloorPresets()).find((p) => p.slug === floorChoice.preset)?.label ?? null
      : null;
    const target = [presetLabel, floorChoice.note?.trim()].filter(Boolean).join(" — ");
    return finalDecisions.map((d) => {
      if (d.category !== "floor") return d;
      if (floorChoice.change) {
        return {
          ...d, mismatch_type: "structural" as const, action_slug: null,
          action_label: null, supply_items: null, qty: null,
          description: target ? `Remplacer par : ${target}` : d.description,
        };
      }
      return { ...d, mismatch_type: "none" as const, action_slug: null, action_label: null, supply_items: null, qty: null };
    });
  })();

  await updateProject(projectId, { element_decisions: decisionsWithFloor, visionOutput: profiles, ...CLEAR_FINALIZE });
  console.log(`[pipeline:analyze] saved ${decisionsWithFloor.length} decisions (2 calls: detection + verdict)`);
}

// Nombre de générations "premier rendu" déjà effectuées pour ce projet
// (pipeline_logs). Sert d'index de rotation des déclinaisons colorées : le
// user qui régénère obtient une histoire de couleur différente à chaque essai
// (déterministe — l'aléatoire pur peut retomber deux fois sur la même).
async function countGenerationRenders(projectId: string): Promise<number> {
  const { count, error } = await createSupabaseAdmin()
    .from("pipeline_logs")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("event", "generate")
    .eq("step", "first-render");
  if (error) {
    console.error("[pipeline] countGenerationRenders failed, colorway par défaut:", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function runGenerationPipeline(projectId: string): Promise<void> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (!project.basePhotoUrl || !project.selectedStyleId || !project.roomType) {
    throw new Error("Project incomplete: missing basePhotoUrl, selectedStyleId or roomType");
  }

  let sourceImage = await loadImage(project.basePhotoUrl);

  // 1. Détection — RÉUTILISE les profils produits par l'analyse (review). La
  // détection n'est plus relancée ici (1 appel Vision en moins par génération).
  // Fallback : si la génération est déclenchée sans analyse préalable, on détecte
  // une fois et on persiste.
  let profiles = Array.isArray(project.visionOutput)
    ? (project.visionOutput as ElementProfile[])
    : [];
  if (profiles.length === 0) {
    profiles = await detectSourceProfilesCached(projectId, project, "generate");
  } else {
    console.log(`[pipeline:generate] réutilise ${profiles.length} profils de l'analyse (pas de 2e appel Vision)`);
  }
  await updateProject(projectId, { detectedFurniture: profilesToFurniture(profiles) });

  // Masquage sièges (flag SEAT_BLUR_CANARY, ACTIF par défaut, =0 pour couper) :
  // pixelise les sièges de l'image d'entrée pour casser l'ancre de silhouette
  // (sinon le modèle re-skinne le même canapé), en UNE seule génération.
  // Gates : uniquement si la pièce contient des sièges (aucun appel sinon), et
  // jamais sur les catégories gardées/customisées (leur forme doit rester
  // visible). Échec = pas de flou = comportement normal.
  // Flux EXPERT : pas de masquage — les sièges du rendu fake sont de toute
  // façon remplacés par de VRAIS produits au swap NB2 (l'ancre de silhouette
  // n'a aucun impact final) → on économise l'appel bbox et les 4-5 s.
  let canaryPlanNote = "";
  const isBlurTarget = (c: string) => SEAT_CATS.has(c) || LIGHT_CATS.includes(c) || MIRROR_CATS.includes(c);
  const hasBlurTargets = profiles.some((p) => isBlurTarget(p.category));
  if (SEAT_BLUR_CANARY && hasBlurTargets && project.mode !== "expert") {
    try {
      const decisions = Array.isArray(project.element_decisions) ? project.element_decisions : [];
      // Un siège garde sa forme visible si KEEP ou customisation RENDABLE
      // (même logique que formatDesignPlan) ; une customisation NON-rendable est
      // dégradée en REPLACE dans le plan image → elle DOIT être pixelisée.
      const renderableSlugs = project.diyMode === "beta" ? await getRenderableActionSlugs() : null;
      const keepsShape = (d: ElementDecision) =>
        d.mismatch_type === "none" || (d.action_slug != null && (renderableSlugs === null || renderableSlugs.has(d.action_slug)));
      const keptSeatCats = [...new Set(
        decisions.filter((d) => isBlurTarget(d.category) && keepsShape(d)).map((d) => d.category),
      )];
      const srcBytes = await fetchImageBytes(project.basePhotoUrl);
      const blurred = await blurSeatsInSource(srcBytes, projectId, keptSeatCats);
      if (blurred.blurredCount > 0) {
        sourceImage = blurred.buffer as unknown as ImageInput;
        canaryPlanNote = blurred.planNote;
        console.log(`[canary:seat-blur] ${projectId}: ${blurred.blurredCount} siège(s) pixelisé(s)${keptSeatCats.length ? ` (exclus: ${keptSeatCats.join(", ")})` : ""}`);
      }
    } catch (e) {
      console.warn(`[canary:seat-blur] ${projectId}: échec (non bloquant):`, e instanceof Error ? e.message : e);
    }
  }

  // 2. Style context — la déclinaison colorée tourne avec le nombre de
  // générations déjà faites (1re génération = déclinaison par défaut).
  const choices: UserChoicesInput = project.userConstraints ? constraintsToChoices(project.userConstraints) : {};
  const colorwayIndex = await countGenerationRenders(projectId);
  const { styleName, styleMood, colorwaySlug } = await loadStyleContext(project.selectedStyleId, {
    colorwayIndex,
    lockWalls: Boolean(choices.walls?.repaint),
  });
  if (colorwaySlug) console.log(`[pipeline:generate] déclinaison couleur: ${colorwaySlug} (gen #${colorwayIndex + 1})`);
  const furnitureDefaults = await loadRoomDefaults(project.roomType);
  const userInstructions = await formatUserInstructions(choices);

  // 3. Generation
  // Plan de design issu des décisions par élément (après review) → injecté dans
  // le prompt pour que l'image reflète réellement keep/customize/replace.
  // Mode DIY beta : les customisations rendables restent des RESTYLE visibles
  // (variante de prompt sélectionnée via ctx.diyMode) ; les non-rendables sont
  // dégradées en REPLACE dans le plan image.
  const designPlan = formatDesignPlan(
    project.element_decisions,
    project.diyMode === "beta" ? { renderableSlugs: await getRenderableActionSlugs() } : undefined,
  );
  const removeCategories = await loadRoomRemoveCategories(project.roomType);

  const genCtx = {
    styleName,
    styleMood,
    roomType: project.roomType,
    furnitureDefaults,
    visionJson: JSON.stringify(profiles, null, 2),
    fixedFeatures: await buildFixedFeaturesSummary(profiles),
    // Éléments détectés à retirer pour ce type de pièce (asset ∩ détection).
    removeList: buildRemoveList(profiles, removeCategories),
    userInstructions,
    designPlan: `${designPlan || "None — restyle freely to fit the style."}\n${await buildLightingPlanLine(profiles, styleName)}${buildRoomScaleLine(project.roomScale)}${canaryPlanNote}`,
  };

  // Flux DIY beta : variante de prompt sous slug dédié (RESTYLE meuble en
  // place). NB : la contrainte uniq_prompts_active (un actif par slug+purpose)
  // empêche la coexistence par `conditions` — d'où le slug séparé.
  const genSlug = project.diyMode === "beta" ? "gen_wow_generic_diy_beta" : "gen_wow_generic";

  // CANARY moodboard (STYLE_REF_IMAGE=1, OFF par défaut) : joint 1 image de
  // référence du style (public/style-refs/<slug>_1.*) — ancre visuelle de
  // l'ambiance, plus forte que le texte (comparaison Gemini web 2026-07-10 :
  // rendus encore timides malgré COMMITMENT/WALLS/STAGING).
  let refImages: ImageInput[] | undefined;
  let refNote = "";
  if (process.env.STYLE_REF_IMAGE === "1") {
    try {
      const { readdir, readFile } = await import("fs/promises");
      const sharp = (await import("sharp")).default;
      const refDir = `${process.cwd()}/public/style-refs`;
      const slug = project.selectedStyleId === "campagne-francaise" ? "campagne-france" : project.selectedStyleId;
      const files = (await readdir(refDir)).filter((f) => f.toLowerCase().startsWith(`${slug}_`)).sort();
      // Choix déterministe par projet mais varié entre projets (hash id) —
      // sinon c'est toujours _1 qui sert (les meilleures refs jamais vues).
      const file = files.length ? files[[...projectId].reduce((a, c) => a + c.charCodeAt(0), 0) % files.length] : undefined;
      if (file) {
        // La ref est REDIMENSIONNÉE au format de la photo source : sans ça le
        // modèle adopte parfois le ratio/l'expo de la ref (rendu carré sombre,
        // banc out-styleref s03) au lieu du cadre de la pièce.
        const srcMeta = await sharp(await fetchImageBytes(project.basePhotoUrl)).metadata();
        const refResized = await sharp(`${refDir}/${file}`)
          .resize(srcMeta.width ?? 1280, srcMeta.height ?? 768, { fit: "cover" })
          .jpeg({ quality: 85 })
          .toBuffer();
        refImages = [refResized as unknown as ImageInput];
        refNote =
          `\n=== STYLE REFERENCE (last attached image) ===\nThe LAST image shows the TARGET AMBIANCE for this redesign — treat it as the standard to MATCH: ` +
          `the same boldness of wall colour, the same staging density (rug, textiles, plants, dressed surfaces), the same richness. ` +
          `A result that feels closer to the original photo's emptiness than to the reference's ambiance is a FAILURE. ` +
          `Copy its SPIRIT only — NEVER its room: architecture, layout, openings, furniture positions and camera framing come from the FIRST image alone, ` +
          `and the output stays a well-exposed daylight photograph with the FIRST image's exact framing and aspect ratio. Every rule above still applies.`;
        console.log(`[canary:style-ref] ${projectId}: référence ${file} jointe (${files.length} dispo)`);
      }
    } catch (e) {
      console.warn(`[canary:style-ref] ${projectId}: échec (non bloquant):`, e instanceof Error ? e.message : e);
    }
  }

  const t1 = Date.now();
  const genPrompt = await resolvePrompt(genSlug, genCtx, { strict: false });
  const genResult = await withTracking(
    { step: "generation", projectId, provider: genPrompt.prompt.provider,
      requestPayload: { promptName: genSlug, prompt: genPrompt.resolvedTemplate.slice(0, 5000) } },
    () => getImageProvider(genPrompt.prompt.provider).generateFromText(genPrompt.resolvedTemplate + refNote, sourceImage, refImages),
  );
  console.log(`[pipeline:generate] generation: ${Date.now() - t1}ms, ${Math.round(genResult.imageBuffer.length / 1024)}KB`);

  // AUDIT→RETOUCHE points lumineux : si le rendu a AJOUTÉ un luminaire fixe au lieu
  // de swapper le point existant, une passe d'édition retire l'excédent.
  const fixedGen = await enforceLightpointCount(
    projectId,
    { imageBuffer: genResult.imageBuffer, mimeType: genResult.mimeType },
    await countLightpoints(profiles),
    genPrompt.prompt.provider,
  );
  // AUDIT→RETOUCHE sièges morphés (dernier recours — le prompt a atteint son
  // plafond sur la silhouette) : même modèle re-skinné → une édition sans ancre.
  const seatFixed = await enforceSeatReplacement(
    projectId, sourceImage, fixedGen, profiles, styleName, genPrompt.prompt.provider,
  );
  genResult.imageBuffer = seatFixed.imageBuffer;
  genResult.mimeType = seatFixed.mimeType;

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
    metadata: colorwaySlug ? { colorway: colorwaySlug } : null,
  });
}

// 3 briefs de layout → 3 rendus distincts (la diversité vient des briefs).
// Volontairement formulés en AGENCEMENT DE MOBILIER PUR (pas de repère
// architectural type "mur", "coin", "fenêtre") : citer l'archi poussait le modèle
// à déplacer l'escalier / inventer une fenêtre. La coquille reste verrouillée par
// les règles + le compte exact du prompt.
// Les briefs décrivent UNIQUEMENT l'agencement, JAMAIS des meubles précis : nommer
// « sofa/coffee table » mettait un salon dans une chambre. Le mobilier vient de
// {{roomType}} + {{furnitureDefaults}} du prompt. On évite aussi « ouvert / open up /
// airy » que le modèle image interprète comme des modifications d'architecture.
// 3 variations GENUINEMENT distinctes : chacune combine un agencement ET une
// direction HORS-mobilier (couleur murale dans la palette + déco), pour éviter les
// jumeaux + la recolorisation forcée du mobilier. Le style et les meubles (identité +
// couleur vraie) restent constants ; c'est le mur/la déco/le layout qui varient.
const DISPOSITION_BRIEFS = [
  "Variation A — centré & signature: gather the movable furniture into a close functional grouping around the room's focal point, clear circulation around it. Walls in the DEEPEST / signature colour of the style palette; restrained, tonal decor.",
  "Variation B — le long des murs, clair & naturel: place the largest piece against the longest solid wall, keep a wide clear central walkway. Paint the walls in a LIGHT airy neutral FROM THE STYLE PALETTE (off-white, greige, sand — different from variation A); layer warm natural textures and a little more decor (a plant, a throw, art).",
  "Variation C — espacé, chaleureux/accent: spread the furniture along the walls leaving the centre free, generous circulation. Give the walls a WARMER mid-tone or a subtle TWO-TONE / single-accent-wall treatment taken from the style palette (distinct from A and B); add one statement decor piece.",
];

/**
 * Variations d'agencement (feature experts) : 3 appels image, un par brief de
 * layout → 3 rendus PLEIN FORMAT distincts. Réutilise profils/style/design plan.
 * Ne touche pas generatedRenderUrl (le user en choisira un ensuite).
 */
// Dédup en vol des dispositions (par process/lambda) : deux requêtes concurrentes
// (ex. re-mount de la page pendant les ~2 min de génération) PARTAGENT le même
// calcul au lieu de lancer 6 renders Gemini. Complète l'idempotence DB ci-dessous.
const inflightDispositions = new Map<string, Promise<string[]>>();

export async function runDispositionsPipeline(projectId: string): Promise<string[]> {
  // Idempotence : dispositions déjà générées (pour ce render/style — CLEAR_FINALIZE
  // les efface à chaque nouveau rendu) → on renvoie SANS relancer. Coupe le double-run
  // observé : la page /dispositions se re-monte / est rafraîchie pendant la 1re passe
  // (~2 min) et, `dispositionsRenderUrls` désormais persistées, le 2e POST court-circuite
  // au lieu de refaire 3 renders qui, concurrents, affamaient le matching (timeout /expert).
  const existing = await getProject(projectId);
  if ((existing?.dispositionsRenderUrls?.length ?? 0) >= 3) {
    return existing!.dispositionsRenderUrls as string[];
  }
  const inflight = inflightDispositions.get(projectId);
  if (inflight) return inflight;
  const run = runDispositionsPipelineInner(projectId).finally(() => inflightDispositions.delete(projectId));
  inflightDispositions.set(projectId, run);
  return run;
}

async function runDispositionsPipelineInner(projectId: string): Promise<string[]> {
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

  // Les 3 dispositions font varier l'AGENCEMENT uniquement : on garde la
  // déclinaison couleur du dernier rendu généré (pas deux variables à la fois
  // dans un même choix).
  const choices: UserChoicesInput = project.userConstraints ? constraintsToChoices(project.userConstraints) : {};
  const { styleName, styleMood } = await loadStyleContext(project.selectedStyleId, {
    colorwayIndex: Math.max(0, (await countGenerationRenders(projectId)) - 1),
    lockWalls: Boolean(choices.walls?.repaint),
  });
  const furnitureDefaults = await loadRoomDefaults(project.roomType);
  const userInstructions = await formatUserInstructions(choices);
  const designPlan = formatDesignPlan(
    project.element_decisions,
    project.diyMode === "beta" ? { renderableSlugs: await getRenderableActionSlugs() } : undefined,
  );

  const removeCategories = await loadRoomRemoveCategories(project.roomType);

  const baseCtx = {
    styleName,
    styleMood,
    roomType: project.roomType,
    furnitureDefaults,
    visionJson: JSON.stringify(profiles, null, 2),
    fixedFeatures: await buildFixedFeaturesSummary(profiles),
    removeList: buildRemoveList(profiles, removeCategories),
    userInstructions,
    designPlan: `${designPlan || "None — restyle freely to fit the style."}\n${await buildLightingPlanLine(profiles, styleName)}`,
  };

  // Flux DIY beta : variante sous slug dédié (cf. runGenerationPipeline).
  const dispoSlug = project.diyMode === "beta" ? "gen_wow_3_dispositions_diy_beta" : "gen_wow_3_dispositions";

  // 3 générations en parallèle (1 par brief).
  const urls = await Promise.all(
    DISPOSITION_BRIEFS.map(async (dispositionBrief, i) => {
      const t1 = Date.now();
      const genPrompt = await resolvePrompt(
        dispoSlug,
        { ...baseCtx, dispositionBrief },
        { strict: false },
      );
      const result = await withTracking(
        { step: "generation", projectId, provider: genPrompt.prompt.provider,
          requestPayload: { promptName: dispoSlug, disposition: i + 1, prompt: genPrompt.resolvedTemplate.slice(0, 5000) } },
        () => getImageProvider(genPrompt.prompt.provider).generateFromText(genPrompt.resolvedTemplate, sourceImage),
      );
      console.log(`[pipeline:dispositions] #${i + 1} ${Date.now() - t1}ms`);
      const fixed = await enforceLightpointCount(
        projectId,
        { imageBuffer: result.imageBuffer, mimeType: result.mimeType },
        await countLightpoints(profiles),
        genPrompt.prompt.provider,
      );
      const seatFixed = await enforceSeatReplacement(
        projectId, sourceImage, fixed, profiles, styleName, genPrompt.prompt.provider,
      );
      const url = await saveRender(seatFixed.imageBuffer, project.storageFolder, seatFixed.mimeType, `disposition_${i + 1}`);
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
  // Tap-to-target : élément désigné au doigt sur le rendu — libération PRÉCISE
  // du verrou de liste (bypass du mapping mots-clés) + cible nommée dans le prompt.
  opts?: { targetElementIds?: string[]; targetLabel?: string },
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
  const effectiveRequest = opts?.targetLabel ? `${opts.targetLabel} : ${userRequest}` : userRequest;
  const iterPrompt = await resolvePrompt(
    "iterate_generic",
    { userRequest: effectiveRequest },
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
    editRequests: [...(project.editRequests ?? []), effectiveRequest],
    // VERROU DE LISTE : snapshot des propositions actuelles + demande à relâcher —
    // le recalcul post-itération ne rejouera QUE les catégories visées par la
    // demande, le reste est repris tel quel (listLock.ts). Cible désignée au
    // doigt → libération par element_id, pas de parsing mots-clés.
    lockedShoppingList: project.shoppingList?.length ? project.shoppingList : project.lockedShoppingList ?? null,
    ...(opts?.targetElementIds?.length
      ? { pendingReleaseElementIds: [...(project.pendingReleaseElementIds ?? []), ...opts.targetElementIds] }
      : { pendingReleaseRequests: [...(project.pendingReleaseRequests ?? []), userRequest] }),
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
/**
 * Point d'ancrage du composite → coordonnées du rendu.
 * Le pin se posait au CENTRE de la bbox. Sur un meuble en L (canapé sectionnel), ce
 * centre n'est PAS sur le meuble : il tombe dans le creux du L, sur l'accoudoir ou
 * dans le vide (QA Alexis 2026-07-12). Le modèle renvoie donc un POINT posé sur le
 * corps de l'objet — l'endroit où il « poserait le doigt ». La bbox reste utilisée
 * pour le crop du matching, où elle est juste : c'est le CENTRE qui mentait, pas la
 * boîte.
 */
function mapCompositePointToRender(
  raw: unknown,
  afterLeftFrac: number,
  afterWidthFrac: number,
): { x: number; y: number } | null {
  if (!Array.isArray(raw) || raw.length !== 2 || afterWidthFrac <= 0) return null;
  const [px, py] = raw.map(Number);
  if (![px, py].every(Number.isFinite)) return null;
  const cx = px / 1000;
  const cy = py / 1000;
  if (cx < afterLeftFrac - 0.02) return null; // point côté AVANT → inexploitable
  const x = (cx - afterLeftFrac) / afterWidthFrac;
  if (x < 0 || x > 1 || cy < 0 || cy > 1) return null;
  return { x, y: cy };
}

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
): Promise<{ appliedIds: Set<string>; judgedIds: Set<string>; replacedIds: Set<string>; additions: Alteration[]; afterById: Map<string, string>; bboxById: Map<string, Bbox>; anchorById: Map<string, { x: number; y: number }>; attrsById: Map<string, Record<string, unknown>> }> {
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
  // Instruction d'attrs structurés V3 (par catégorie présente). replacedOnly : on ne demande
  // les attrs QUE pour les éléments remplacés (nouvel objet) — un re-finish garde sa forme.
  const attrsInstruction = buildAttrsInstruction(candidates.map((d) => d.category), { replacedOnly: true });
  const prompt = await resolvePrompt("confirm_changes", { candidatesJson, attrsInstruction }, { strict: false });
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
  ).catch((err: unknown) => {
    // flash en « high demand » (503 persistant malgré withRetry) : plutôt que de
    // faire échouer tout le /final, on retombe UNE fois sur le modèle par défaut
    // du prompt (flash-lite) — audit moins discriminant mais liste utilisable.
    if (!isTransientAiError(err)) throw err;
    console.warn(
      "[pipeline:audit] gemini-2.5-flash indisponible → repli sur le modèle par défaut (audit moins discriminant)",
    );
    return withTracking(
      {
        step: "audit",
        projectId,
        provider: prompt.prompt.provider,
        requestPayload: { promptName: "confirm_changes", candidates: candidates.length, fallback: "default-model" },
      },
      () => getVisionProvider(prompt.prompt.provider).analyze(prompt.resolvedTemplate, [composite]),
    );
  }
  );
  const parsed = result.parsed as {
    results?: Array<{ element_id?: string; changed?: boolean; change_kind?: string; after?: string; anchor?: unknown; bbox?: unknown; attrs?: unknown }>;
    additions?: Array<{ element?: string; category?: string; detail?: string }>;
  } | null;

  const appliedIds = new Set<string>();
  const judgedIds = new Set<string>(); // éléments explicitement jugés par l'audit
  // Description de l'APRÈS par élément → la liste de courses reflète ce que
  // l'élément est DEVENU dans le rendu (ex. tapis bleu/jaune), pas l'original.
  const afterById = new Map<string, string>();
  // bbox de l'élément dans le RENDU (APRÈS) → crop pour le matching image↔image.
  const bboxById = new Map<string, Bbox>();
  // Point d'ancrage du pin, POSÉ SUR l'objet (le centre de la bbox tombe à côté sur un
  // meuble en L). Absent → le pin retombe sur le centre de la bbox.
  const anchorById = new Map<string, { x: number; y: number }>();
  // attrs structurés V3 de l'élément (état APRÈS) → score structuré du matching (Étape 2).
  const attrsById = new Map<string, Record<string, unknown>>();
  // LE RENDU FAIT FOI : éléments que le rendu a REMPLACÉS (objet différent) et non
  // simplement re-finis. Un « repeindre la table basse » que le rendu a en fait
  // remplacée par une AUTRE table doit se vendre comme une table, pas comme un pot
  // de peinture (QA Alexis 2026-07-11) — le plan DIY n'est qu'une intention.
  const replacedIds = new Set<string>();
  for (const r of parsed?.results ?? []) {
    if (typeof r.element_id !== "string") continue;
    judgedIds.add(r.element_id);
    if (r.changed) appliedIds.add(r.element_id); // appliedIds = éléments que le rendu a CHANGÉS
    if (r.changed && r.change_kind === "replaced") replacedIds.add(r.element_id);
    if (r.after && r.after.trim()) afterById.set(r.element_id, r.after.trim());
    const compBox = parseBbox(r.bbox);
    if (compBox) {
      const renderBox = mapCompositeBoxToRender(compBox, afterLeftFrac, afterWidthFrac);
      if (renderBox) bboxById.set(r.element_id, renderBox);
    }
    const anchor = mapCompositePointToRender(r.anchor, afterLeftFrac, afterWidthFrac);
    if (anchor) anchorById.set(r.element_id, anchor);
    if (r.attrs && typeof r.attrs === "object" && !Array.isArray(r.attrs)) {
      attrsById.set(r.element_id, r.attrs as Record<string, unknown>);
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

  return { appliedIds, judgedIds, replacedIds, additions, afterById, bboxById, anchorById, attrsById };
}

// Catégories qu'on ne liste PAS en addition (architecture/surfaces + déco sans produit
// catalogue exploitable) — alignées sur le NON_SHOPPABLE du matcher, + floor (surface,
// géré comme candidat, pas comme meuble ajouté).
// 2026-07-10 (Alexis) : miroirs, lampes de table et plafonniers ACTIVÉS — le
// catalogue les couvre désormais (mirror 321, table_lamp 334, pendant_lamp 637).
const ADDITION_SKIP = new Set([
  "other", "frame", "plant", "decor_object",
  "wall", "ceiling", "window", "door", "french_door", "wall_opening", "floor",
]);

/**
 * ADDITIONS robustes : plutôt que de demander à l'audit (1 prompt multi-tâches) de
 * DEVINER les net-new — peu fiable, rate parfois un canapé/tapis pourtant évident sur
 * une pièce vide —, on DÉTECTE l'inventaire complet du RENDU (vision_detect_extended,
 * pleine résolution) et on le réconcilie avec l'AVANT. Addition = meuble présent dans le
 * rendu dont la catégorie n'est pas déjà couverte par un candidat (élément de l'AVANT).
 * Pièce vide → aucun candidat meuble → tout le mobilier du rendu devient addition.
 */
// Recouvrement de deux bbox normalisées (IoU) — dédup géométrique des additions.
function bboxIoU(a: Bbox, b: Bbox): number {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

function reconcileRenderAdditions(
  renderProfiles: ElementProfile[],
  candidates: ElementDecision[],
  taxonomy: Map<string, string | null>,
  // Catégories FIXES mais shoppables (fixed_lightpoint + catalog_category en taxo :
  // ceiling_light→pendant_lamp, wall_sconce) : movable=false car point électrique,
  // mais un luminaire suspendu au rendu est un PRODUIT achetable — sans cette
  // exemption, une suspension swappée n'était jamais shoppée quand la détection
  // de base avait raté le point (projet QAWf50S1 2026-07-10).
  fixedShoppable?: Set<string>,
): Alteration[] {
  const covered = new Map<string, number>(); // multiset des catégories catalogue de l'AVANT
  for (const d of candidates) {
    const c = resolveCatalogCategory(d.category, taxonomy);
    if (c) covered.set(c, (covered.get(c) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  const adds: Alteration[] = [];
  // Élément FANTÔME : la détection émet parfois un élément qu'elle déclare
  // elle-même ne pas voir (« Non visible », hors champ) → jamais une ligne
  // d'achat (matching aveugle à ~0.4, projet fpvZ « chaises à 40% »).
  const GHOST = /non visible|not visible|invisible|hors[- ]champ|barely visible|cannot be seen/i;
  for (const p of renderProfiles) {
    if ((p.movable === false && !fixedShoppable?.has(p.category)) || ADDITION_SKIP.has(p.category)) continue;
    if (GHOST.test(p.description ?? "") || !(p.description ?? "").trim()) continue;
    const c = resolveCatalogCategory(p.category, taxonomy);
    if (!c) continue; // non shoppable
    const used = seen.get(c) ?? 0;
    seen.set(c, used + 1);
    if (used < (covered.get(c) ?? 0)) continue; // déjà couvert par un candidat AVANT
    adds.push({
      element: p.element || p.category,
      action: "added",
      category: p.category,
      detail: (p.description || p.color || "").trim() || undefined,
      shoppingImpact: "to_buy_secondhand",
      // element_id + bbox du rendu → crop de l'ajout pour le matching image↔image.
      element_id: p.element_id,
      bbox: p.bbox,
      color_hex: p.color_hex,
      attrs: p.attrs, // attrs V3 du rendu → score structuré de l'ajout.
    });
  }
  return adds;
}

/** Détecte l'inventaire du rendu (pleine résolution, AVEC bbox) + réconcilie → additions robustes. */
export async function computeRenderAdditions(
  projectId: string,
  renderUrl: string,
  roomType: string | undefined,
  candidates: ElementDecision[],
  taxonomy: Map<string, string | null>,
): Promise<Alteration[]> {
  return (await computeRenderInventory(projectId, renderUrl, roomType, candidates, taxonomy)).adds;
}

/**
 * Inventaire du RENDU (pleine résolution) : additions + TOUS les profils détectés.
 *
 * Les profils portent une bbox mesurée sur le rendu ENTIER. Celles de l'audit, elles,
 * sont émises sur le composite AVANT|APRÈS — une image où le rendu n'occupe que la
 * moitié de la largeur, donc à résolution DIVISÉE PAR DEUX, puis reprojetées. D'où des
 * boîtes trop larges dont le centre tombe au bord du meuble : le pin du canapé se
 * posait sur son accoudoir (QA Alexis 2026-07-12). On expose donc les profils pour
 * pouvoir préférer LEURS bboxes. Aucun appel vision supplémentaire : cet inventaire
 * tourne déjà, on jetait simplement les boîtes des éléments non-additions.
 */
export async function computeRenderInventory(
  projectId: string,
  renderUrl: string,
  roomType: string | undefined,
  candidates: ElementDecision[],
  taxonomy: Map<string, string | null>,
): Promise<{ adds: Alteration[]; profiles: ElementProfile[] }> {
  const renderImg = await loadImage(renderUrl);
  const renderProfiles = await detectElementProfiles(projectId, renderImg, "render_inventory", roomType, { withBbox: true });
  const fixedShoppable = new Set(
    (await getElementCategories().catch(() => [] as ElementCategory[]))
      .filter((c) => c.fixed_lightpoint && c.catalog_category)
      .map((c) => c.slug),
  );
  const adds = reconcileRenderAdditions(renderProfiles, candidates, taxonomy, fixedShoppable);
  console.log(`[pipeline:final] inventaire rendu: ${renderProfiles.length} éléments détectés → ${adds.length} additions`);
  return { adds, profiles: renderProfiles };
}

/**
 * Orchestration du /final en DEUX phases :
 *  A. analyzeRender (VISION Gemini : confirmChanges + inventaire rendu + couleurs murs) →
 *     RenderAnalysis, MISE EN CACHE (clé = renderUrl). Ne dépend QUE du rendu.
 *  B. buildMatchesAndScore (Jina crops + matching + scoring) → ShoppingAssets. Dépend des POIDS.
 * Au refresh, si le rendu n'a pas changé, on RÉUTILISE le cache A → 0 appel Gemini, on ne
 * refait que B (rapide). Le rendu change → A est recalculé.
 */
// Dédup en mémoire des calculs /final : clé projet+rendu. Le précalcul en fond
// (precomputeFinalAssets) et un user qui ouvre le shopping pendant qu'il tourne
// PARTAGENT le même calcul au lieu de le doubler. Clé par RENDU : une itération
// pendant un calcul en cours relance un calcul frais pour le nouveau rendu.
// Best-effort (par process) — la correction en écriture est assurée par les
// gardes anti-staleness ci-dessous, pas par cette Map.
const inflightFinalAssets = new Map<string, Promise<ShoppingAssets | null>>();

// Bail DB considéré actif (calcul en cours dans un autre process/lambda) s'il
// date de moins que le budget maxDuration des routes de calcul.
const FINAL_ASSETS_LEASE_MS = 90_000;

function isFinalAssetsComputing(project: Project): boolean {
  return (
    project.finalAssetsRenderUrl === project.generatedRenderUrl &&
    !!project.finalAssetsStartedAt &&
    Date.now() - Date.parse(project.finalAssetsStartedAt) < FINAL_ASSETS_LEASE_MS
  );
}

export async function ensureFinalAssets(
  projectId: string,
  opts?: { skipIfComputing?: boolean },
): Promise<ShoppingAssets | null> {
  const project = await getProject(projectId);
  if (!project?.generatedRenderUrl) return null;
  if (project.shoppingList) {
    return { shoppingList: project.shoppingList, scoreFoyer: project.scoreFoyer as ScoreFoyer };
  }
  // Un autre process calcule déjà cette liste (bail DB frais) → les déclencheurs
  // fire-and-forget s'abstiennent au lieu de doubler le compute (et le coût).
  if (opts?.skipIfComputing && isFinalAssetsComputing(project)) {
    console.log("[pipeline:final] calcul déjà en cours (bail DB) → skip");
    return null;
  }
  const key = `${projectId}:${project.generatedRenderUrl}`;
  const inflight = inflightFinalAssets.get(key);
  if (inflight) return inflight;
  const run = ensureFinalAssetsInner(projectId, project).finally(() => inflightFinalAssets.delete(key));
  inflightFinalAssets.set(key, run);
  return run;
}

async function ensureFinalAssetsInner(projectId: string, project: Project): Promise<ShoppingAssets | null> {
  // Pose le bail (best-effort, pas transactionnel : les gardes anti-staleness
  // assurent la correction ; le bail évite seulement le double compute).
  await updateProject(projectId, {
    finalAssetsStartedAt: new Date().toISOString(),
    finalAssetsRenderUrl: project.generatedRenderUrl ?? undefined,
  });
  // Réchauffe Jina pendant la phase vision (~15 s) : le cold start (~4 s) est
  // sinon payé au PREMIER embedding du matching. Fire-and-forget, sans await.
  computeTextEmbedding("warmup").catch(() => {});
  // Analyse vision : réutilisée tant que le rendu est le même (sinon recalcul + re-cache).
  let analysis = project.renderAnalysis;
  if (!analysis || analysis.renderUrl !== project.generatedRenderUrl) {
    analysis = await analyzeRender(projectId, project);
    // Anti-staleness : si le rendu a changé pendant l'analyse (itération), on ne
    // persiste pas — on écraserait un cache plus frais. Le résultat reste retourné
    // (l'appelant interactif regarde forcément le rendu qu'il vient de demander).
    const current = await getProject(projectId);
    if (current?.generatedRenderUrl === analysis.renderUrl) {
      await updateProject(projectId, { renderAnalysis: analysis });
    }
  } else {
    console.log("[pipeline:final] analyse vision RÉUTILISÉE (rendu inchangé) → re-rank seul, 0 appel Gemini");
  }
  return buildMatchesAndScore(projectId, project, analysis);
}

/**
 * Levier perf 1 — précalcul fire-and-forget de la liste shopping, déclenché en fin
 * de generate/iterate/select-disposition (via after() dans les routes) : le calcul
 * tourne pendant que le user regarde son rendu → shopping perçu ~0 s à l'arrivée.
 */
export function precomputeFinalAssets(projectId: string, trigger: string): void {
  ensureFinalAssets(projectId, { skipIfComputing: true })
    .then((r) =>
      console.log(
        `[pipeline:precompute:${trigger}] ${r ? `${r.shoppingList.length} items prêts` : "skip (pas de rendu)"}`,
      ),
    )
    .catch((e: unknown) =>
      console.warn(`[pipeline:precompute:${trigger}] échec (non bloquant):`, e instanceof Error ? e.message : e),
    );
}

// ── Phase A : ANALYSE VISION (Gemini) — cacheable, indépendante des poids ────────────────
async function analyzeRender(projectId: string, project: Project): Promise<RenderAnalysis> {
  // generatedRenderUrl est garanti non-null par l'appelant (ensureFinalAssets).
  const renderUrl = project.generatedRenderUrl as string;
  // Remap catégorie par mot-clé de tête sur la description APRÈS (même table que la
  // détection) : ce que le rendu contient prime sur la catégorie d'origine.
  const remapTable = await getCategoryKeywordRemap(project.roomType);
  const afterCategoryRemap = (afterDesc: string): string | null => {
    const hay = afterDesc.toLowerCase();
    return remapTable.find((r) => r.keywords.some((k) => hay.startsWith(k.toLowerCase())))?.slug ?? null;
  };
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
  // Éléments que le RENDU a remplacés par un autre objet (vs simplement re-finis).
  let replacedIds = new Set<string>();
  let additions: Alteration[] = [];
  let afterById = new Map<string, string>();
  let bboxById = new Map<string, Bbox>();
  let anchorById = new Map<string, { x: number; y: number }>();
  const elementHexById = new Map<string, string>(); // element_id → couleur dominante (hex)
  // element_id → attrs structurés V3 (état APRÈS), pour le score structuré du matching.
  const elementAttrsById = new Map<string, Record<string, unknown>>();
  // Couleurs des murs REPEINTS (diff avant/après) — calculées ici (vision) puis cachées ;
  // le matching peinture (matchPaintByColor, Jina) reste en phase B.
  let wallColors: WallColor[] = [];

  // Les TROIS passes vision sont indépendantes (l'inventaire consomme candidates,
  // pas le résultat de l'audit) → parallèle. Wall-clock ≈ la plus lente (l'inventaire)
  // au lieu de la somme. L'échec de l'inventaire est encodé en {ok:false} pour rester
  // rattrapable après coup (fallback additions de l'audit), sans unhandled rejection.
  const taxonomyPromise = getElementCategories()
    .catch(() => [])
    .then((cats) => new Map(cats.map((c) => [c.slug, c.catalog_category])));
  const additionsPromise = taxonomyPromise
    .then((tax) => computeRenderAdditions(projectId, renderUrl, project.roomType, candidates, tax))
    .then((adds) => ({ ok: true as const, adds }))
    .catch((e: unknown) => ({ ok: false as const, e }));

  if (project.basePhotoUrl) {
    const comp = await buildBeforeAfterComposite(project.basePhotoUrl, renderUrl);
    const compBuf = comp.buffer as unknown as ImageInput;
    // Même composite → audit + murs repeints (getChangedWallColors ne renvoie QUE ce qui a changé).
    const [r, wallColorsRes] = await Promise.all([
      confirmChanges(projectId, candidates, compBuf, comp.afterLeftFrac, comp.afterWidthFrac),
      getChangedWallColors(compBuf).catch((e: unknown) => {
        console.warn("[paint] détection couleurs murs échouée:", e instanceof Error ? e.message : e);
        return [] as WallColor[];
      }),
    ]);
    appliedIds = r.appliedIds;
    judgedIds = r.judgedIds;
    replacedIds = r.replacedIds;
    additions = r.additions;
    afterById = r.afterById;
    bboxById = r.bboxById;
    anchorById = r.anchorById;
    r.attrsById.forEach((v, k) => elementAttrsById.set(k, v));
    wallColors = wallColorsRes;
    // bbox de chaque PAN repeint (émises sur le composite) → reprojetées sur le
    // rendu, sous les clés de l'item peinture : `paint-<hex>`, `paint-<hex>-2`…
    // Une peinture = UNE ligne d'achat mais UN pin par pan (demande Alexis
    // 2026-07-11 : 3 pans du même beige ≠ 3 pots à acheter).
    for (const w of wallColors) {
      const key = `paint-${w.hex.replace("#", "")}`;
      const boxes = (w.bboxes?.length ? w.bboxes : w.bbox ? [w.bbox] : [])
        .map((b) => mapCompositeBoxToRender(b, comp.afterLeftFrac, comp.afterWidthFrac))
        .filter(Boolean) as Bbox[];
      boxes.forEach((b, i) => bboxById.set(i === 0 ? key : `${key}-${i + 1}`, b));
    }
  }

  // La LISTE reflète le RENDU, pas seulement les décisions initiales :
  //  - élément jugé CHANGÉ par l'audit → listé (achat). S'il était "keep" (ex. tapis
  //    modifié à l'itération) → promu en remplacement structurel.
  //  - élément jugé inchangé → keep (même si un changement était planifié mais pas fait).
  //  - non jugé (architecture exclue / audit incomplet) → on préserve, candidats présumés OK.
  const effective: ElementDecision[] = decisions.map((d) => {
    const wasCandidate = d.mismatch_type === "surface" || d.mismatch_type === "structural";
    // Fragment tronqué au bord du cadre (ex. fauteuil du 1er plan « visible
    // partiellement ») : injugeable par l'audit (sliver sur le composite) ET
    // inmatchable (crop = bruit) → jamais shoppé. Sans ce garde-fou, la
    // présomption "non jugé → candidat présumé appliqué" l'envoyait en achat
    // alors que le rendu l'a laissé tel quel (cas réel y8skkjRMfEOlStp_Vxsz4).
    if (wasCandidate && isFrameTruncatedFragment(bboxById.get(d.element_id))) {
      return { ...d, mismatch_type: "none" as const, action_slug: null, supply_items: null, qty: null };
    }
    const judged = judgedIds.has(d.element_id);
    const changed = appliedIds.has(d.element_id); // appliedIds = éléments que le rendu a changés
    const after = afterById.get(d.element_id);

    // Élément DISPARU du rendu (l'audit décrit l'après comme « retiré/supprimé ») :
    // « changé » par disparition ≠ un achat — il n'y a RIEN à acheter pour lui (son
    // éventuel remplaçant est détecté comme ADDITION par l'inventaire). Sans ce
    // garde-fou : « Tabouret de bar noir retiré » ×4 en liste d'achat, puis 4
    // chaises INSÉRÉES au rendu par le swap expert (projet CVp7yLGh).
    if (/retiré|supprimé|removed|deleted|disparu|absent du rendu/i.test(after ?? "")) {
      return { ...d, mismatch_type: "none" as const, action_slug: null, supply_items: null, qty: null };
    }

    if (judged && changed) {
      let base: ElementDecision = wasCandidate
        ? d
        : { ...d, mismatch_type: "structural", action_slug: null, supply_items: null, qty: null };
      // LE RENDU FAIT FOI (2026-07-11) : une customisation (« repeindre la table basse »)
      // que le rendu a en réalité REMPLACÉE par un autre objet devient un achat de
      // meuble — sinon on vendait de la peinture pour une table qui n'existe plus.
      // Les surfaces d'architecture (mur/sol/plafond) sont exclues : elles ne sont
      // jamais « remplacées », seulement repeintes.
      if (base.mismatch_type === "surface" && replacedIds.has(d.element_id) && !ARCH_SURFACE_CATEGORIES.has(base.category)) {
        base = { ...base, mismatch_type: "structural", action_slug: null, supply_items: null, qty: null };
      }
      if (after) {
        base = { ...base, description: after };
        // La ligne shoppe ce que le rendu CONTIENT : si l'après décrit clairement une
        // autre catégorie (« Table basse ronde… » pour un mange-debout remplacé), la
        // catégorie suit — sinon la ligne garde une catégorie sans produits et devient
        // insourçable (bar_table → 0 propositions, projet CVp7yLGh).
        const newCat = afterCategoryRemap(after);
        if (newCat && newCat !== base.category) base = { ...base, category: newCat };
      }
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

  // ── MÉTRIQUE conformité plan → rendu (gratuite : le verdict est déjà calculé).
  // Base de décision pour une éventuelle réparation payante (cf. doc DIY §10) :
  // taux d'échec réel par type d'intention et par action, loggé par projet.
  {
    const compliance = { surface: { applied: 0, missing: 0 }, structural: { applied: 0, missing: 0 } };
    const missingByAction: Record<string, number> = {};
    for (const d of decisions) {
      if (d.mismatch_type !== "surface" && d.mismatch_type !== "structural") continue;
      if (!judgedIds.has(d.element_id)) continue;
      const bucket = compliance[d.mismatch_type];
      if (appliedIds.has(d.element_id)) bucket.applied += 1;
      else {
        bucket.missing += 1;
        const k = d.action_slug ?? `${d.mismatch_type}:${d.category}`;
        missingByAction[k] = (missingByAction[k] ?? 0) + 1;
      }
    }
    const total = compliance.surface.applied + compliance.surface.missing + compliance.structural.applied + compliance.structural.missing;
    if (total > 0) {
      await logPipelineEvent({
        project_id: projectId,
        event: "audit",
        step: "plan-compliance",
        metadata: { ...compliance, missingByAction, diyMode: project.diyMode ?? "standard" },
      });
    }
  }

  // Taxonomie DB → résolution catégorie unique (build + matcher), + non-matchés visibles.
  const taxonomy = await taxonomyPromise;

  // ADDITIONS robustes : inventaire complet du RENDU (vision pleine résolution, lancé en
  // parallèle de l'audit ci-dessus) réconcilié avec l'AVANT, au lieu du sous-prompt
  // "additions" de l'audit qui rate parfois un meuble évident (canapé/tapis sur pièce
  // vide). +1 appel vision. Fallback = additions de l'audit.
  let additionsToUse = additions;
  const invRes = await additionsPromise;
  if (invRes.ok) {
    // DÉDUP GÉOMÉTRIQUE : une « addition » dont la bbox recouvre fortement celle
    // d'un candidat jugé est le MÊME objet physique re-détecté sous une autre
    // catégorie (table du coin = bar_table côté décision ET side_table côté
    // inventaire, projet CVp7yLGh) — jamais une deuxième ligne d'achat.
    const candBoxes = [...bboxById.values()];
    additionsToUse = invRes.adds.filter(
      (a) => !a.bbox || !candBoxes.some((cb) => bboxIoU(a.bbox!, cb) > 0.5),
    );
    if (additionsToUse.length < invRes.adds.length) {
      console.log(`[pipeline:final] dédup géométrique: ${invRes.adds.length - additionsToUse.length} addition(s) = objet(s) déjà couvert(s)`);
    }
    // bbox des ajouts (détectées sur le rendu) → bboxById, pour qu'ils obtiennent un crop
    // comme les candidats (matching image↔image au lieu de texte seul).
    for (const a of additionsToUse) {
      if (a.element_id && a.bbox) bboxById.set(a.element_id, a.bbox);
      if (a.element_id && a.color_hex) elementHexById.set(a.element_id, a.color_hex);
      if (a.element_id && a.attrs) elementAttrsById.set(a.element_id, a.attrs);
    }

  } else {
    console.warn("[pipeline:final] détection rendu échouée, fallback additions audit:", invRes.e instanceof Error ? invRes.e.message : invRes.e);
  }

  // VERROU DE POSITION, pendant du verrou de liste. Les meubles ajoutés par une
  // itération EXPERT (« ajoute une table et des chaises ») n'existent que dans le rendu
  // expert : cette analyse tourne sur le rendu FICTIF, elle ne peut donc pas leur
  // trouver de bbox et les effaçait à chaque recalcul — ils restaient dans la liste
  // (grâce à enforceExpertIntegratedPieces) mais perdaient leur pin, silencieusement.
  // expertIntegratedPieces porte désormais leur position : on la réinjecte.
  for (const piece of project.expertIntegratedPieces ?? []) {
    if (piece.elementId && piece.bbox && !bboxById.has(piece.elementId)) {
      bboxById.set(piece.elementId, piece.bbox);
    }
  }

  const plan = reconcilePlan(effective, { elements: [] }, { repairAlreadyUsed: false });
  const built = buildShoppingList(plan, project.selectedStyleId, taxonomy);
  const fromDecisions = builtToLegacyShoppingList(built);
  const fromAdditions = matchAlterationsToCatalog(additionsToUse, project.selectedStyleId, taxonomy);

  // Fusion décisions + ajouts, identiques regroupés en quantité (×N).
  const items = mergeShoppingItems([...fromDecisions, ...fromAdditions]);

  console.log(
    `[pipeline:final] (analyse) ${candidates.length} candidats → ${appliedIds.size} confirmés + ${additionsToUse.length} ajouts → ${items.length} items`,
  );
  return {
    renderUrl,
    items,
    bboxById: Object.fromEntries(bboxById),
    anchorById: Object.fromEntries(anchorById),
    elementHexById: Object.fromEntries(elementHexById),
    elementAttrsById: Object.fromEntries(elementAttrsById),
    wallColors,
    keptScore: built.score.kept,
    builtShoppingList: built,
  };
}

// ── Phase B : MATCHING + SCORING (Jina + SQL) — re-jouable, dépend des POIDS ──────────────
async function buildMatchesAndScore(
  projectId: string,
  project: Project,
  analysis: RenderAnalysis,
): Promise<ShoppingAssets> {
  // Copie fraîche du squelette (on mute matches/scoring). Maps reconstruites depuis le cache.
  const newItems: ShoppingItem[] = analysis.items.map((it) => ({ ...it }));
  const bboxById = new Map<string, Bbox>(Object.entries(analysis.bboxById));
  const elementHexById = new Map<string, string>(Object.entries(analysis.elementHexById));
  const elementAttrsById = new Map<string, Record<string, unknown>>(Object.entries(analysis.elementAttrsById));
  const built = analysis.builtShoppingList;

  // VERROU DE LISTE — composition ET matches (feedback Alexis : un refresh ne doit
  // RIEN changer, pour sortir de l'aléa vision) : les lignes verrouillées sont
  // reprises telles quelles ; la nouvelle analyse n'apporte que les catégories
  // relâchées par une itération et les catégories absentes du verrou.
  const releasedCategories = await mapRequestsToCategories(project.pendingReleaseRequests ?? []);
  const releasedElementIds = new Set(project.pendingReleaseElementIds ?? []);
  const { items: shoppingList, toMatchIdx } = carryOverLockedMatches(newItems, project.lockedShoppingList, releasedCategories, releasedElementIds);

  // CROP du rendu par item : on découpe la zone de l'élément (bbox de l'audit) dans le
  // RENDU → embedding IMAGE (cible image↔image, bien plus discriminant que texte→image).
  // bbox absente (ajout net, audit incomplet, ligne verrouillée) → crop null.
  const renderBytes = await fetchImageBytes(analysis.renderUrl).catch((e) => {
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

  // PEINTURE DIY sur MEUBLE : l'item propose de la PEINTURE (ΔE couleur, comme
  // les murs), JAMAIS des produits de la catégorie du meuble — le pin « Peinture —
  // table basse » qui propose des tables basses est un contresens (QA Alexis
  // 2026-07-11, projet QAWf50S1 ; remplace le « plan B produits » du 2026-07-10
  // pour les seules fournitures peinture).
  const paintDiyIdx = new Set<number>();
  for (let i = 0; i < shoppingList.length; i++) {
    const it = shoppingList[i];
    if (it.source === "diy" && it.category !== "wall" && it.category !== "paint" && /peinture|peindre/i.test(it.name)) {
      paintDiyIdx.add(i);
    }
  }
  for (const i of paintDiyIdx) {
    const it = shoppingList[i];
    // Couleur cible = la teinte SÉMANTIQUE de l'objet (attribut hex du schéma :
    // top_color pour une table, color pour un siège…). Les deux autres sources sont
    // des MOYENNES DE PIXELS sur le crop — elles avalent l'ombre portée, le sol et
    // les objets posés dessus : une table basse BLANCHE (#ffffff en attribut) sortait
    // en #aa9f8f gris-brun, et on proposait de la peinture grise (QA Alexis
    // 2026-07-11, projet -2XwsDxGA). Elles ne servent plus que de repli.
    const attrs = it.elementId ? elementAttrsById.get(it.elementId) : undefined;
    const hexAttrKeys = getSchemaV3(schemaForCategory(it.category))
      .filter((a) => a.type === "hex")
      .map((a) => a.key);
    const attrHex = hexAttrKeys
      .map((k) => attrs?.[k])
      .find((v): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v));

    const hex =
      attrHex ??
      (it.elementId ? elementHexById.get(it.elementId) : undefined) ??
      (crops[i] ? await dominantHexFromImage(crops[i]!) : null);
    if (!hex) { it.matches = []; continue; } // pas de couleur fiable → fournitures seules
    it.targetHex = hex;
    it.matches = await matchPaintByColor(hex);
  }

  // Matching NEUF en BLEND (image + attrs — le texte ne sert qu'au retrieval),
  // pondéré par catégorie × source. Seuls les items à matcher passent (verrou).
  // NB : les items DIY non-peinture (teinte, poignées…) GARDENT leurs propositions
  // produits — plan B si le rendu n'a pas respecté la customisation
  // (décision Alexis 2026-07-10 : ne pas sur-enforcer). L'UI met les fournitures
  // en premier ; avec le scoring attrs (forme/couleur), les propositions restent
  // cohérentes avec le meuble réellement visible dans le rendu.
  const productMatchIdx = toMatchIdx.filter((i) => !paintDiyIdx.has(i));
  if (productMatchIdx.length < shoppingList.length) {
    console.log(`[pipeline:final] verrou de liste: ${shoppingList.length - productMatchIdx.length} item(s) repris tels quels, ${productMatchIdx.length} à matcher (relâchés: ${[...releasedCategories].join(", ") || "aucun"})`);
  }
  const matchResults = await matchPartnerProductsBlendBatch(
    productMatchIdx.map((i) => ({
      category: shoppingList[i].category,
      description: `${shoppingList[i].name} ${shoppingList[i].detail ?? ""}`.trim(),
      crop: crops[i],
      colorHex: shoppingList[i].elementId ? elementHexById.get(shoppingList[i].elementId!) : undefined,
      attrs: shoppingList[i].elementId ? elementAttrsById.get(shoppingList[i].elementId!) : undefined,
    })),
    4,
    // Bonus de style (réversible MATCH_STYLE_BONUS) : les produits taggés du style
    // du projet remontent dans le classement — jamais de pénalité pour les autres.
    { styleId: project.selectedStyleId },
  );
  productMatchIdx.forEach((itemIdx, k) => { shoppingList[itemIdx].matches = matchResults[k]; });
  const toMatchSet = new Set(productMatchIdx);

  // Débogage scoring (/final) : attache à chaque item les attributs DÉTECTÉS SUR LE RENDU
  // (le « target ») + la règle de pondération de sa catégorie (image vs attrs, poids/attribut).
  for (const it of shoppingList) {
    if (it.elementId && elementAttrsById.has(it.elementId)) it.elementAttrs = elementAttrsById.get(it.elementId);
    const schema = schemaForCategory(it.category);
    const cw = CATEGORY_W[schema] ?? CATEGORY_W.default;
    const aw = ATTR_WEIGHTS[schema] ?? ATTR_WEIGHTS.default;
    it.weightRule = { imgW: cw.w, imgWMax: cw.wMax, attrWeights: aw };
  }

  // SOL : blend FILTRÉ par matériau (un parquet bois ne doit pas matcher un carrelage
  // effet bois). Poids 'floor' : w image baissé → le motif joue dans la description.
  for (let i = 0; i < shoppingList.length; i++) {
    const it = shoppingList[i];
    if (it.category !== "floor") continue;
    if (!toMatchSet.has(i) && (it.matches?.length ?? 0) > 0) continue; // sol verrouillé → repris tel quel
    it.matches = await matchFloorProductsBlend(
      `${it.name} ${it.detail ?? ""}`.trim(),
      crops[i],
      4,
      it.elementId ? elementAttrsById.get(it.elementId) : undefined,
    );
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

  // PEINTURE : les murs repeints (diff avant/après) ont été détectés en phase A (cachés dans
  // analysis.wallColors) ; ici on ne fait QUE le matching couleur ΔE (matchPaintByColor, Jina),
  // re-jouable au refresh sans rappeler Gemini. 1 item peinture par mur repeint.
  const wallColors = analysis.wallColors;
  if (wallColors.length > 0) {
    try {
      // Template = item peinture DIY MURAL uniquement (catégorie wall) ; sinon gabarit
      // par défaut (mur repeint à l'itération, hors action DIY). Les peintures DIY
      // de MEUBLE (repaint table basse…) restent des items à part entière : le
      // filtre par nom seul les capturait — l'item du meuble disparaissait et les
      // items muraux héritaient de son elementId/detail → pin du meuble libellé
      // « Peinture — mur derrière le canapé » (projet QAWf50S1 2026-07-10).
      const existing = shoppingList.filter(
        (it) => it.source === "diy" && it.category === "wall" && /peinture|peindre/i.test(it.name),
      );
      const template: ShoppingItem = existing[0] ?? {
        id: "paint", name: "Peinture", category: "paint", detail: "peinture",
        priceMin: 0, priceMax: 0, source: "diy", merchants: [], quantity: 1,
      };
      for (const p of existing) {
        const i = shoppingList.indexOf(p);
        if (i >= 0) shoppingList.splice(i, 1);
      }
      for (const w of wallColors) {
        const key = `paint-${w.hex.replace("#", "")}`;
        // Un pin par PAN peint de cette même couleur (clés posées par analyzeRender).
        const pinKeys = [key, `${key}-2`, `${key}-3`, `${key}-4`].filter((k) => bboxById.has(k));
        shoppingList.push({
          ...template,
          id: key,
          // catégorie "paint" (pas "wall") + elementId(s) = clés des bbox murs
          // → pins sur les murs (wall/floor/ceiling restent sans hotspot).
          category: "paint",
          elementId: pinKeys[0],
          elementIds: pinKeys.length ? pinKeys : undefined,
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

  // VERROU EXPERT : les pièces réellement intégrées au rendu expert (swap NB2) sont
  // ré-injectées dans TOUTE liste reconstruite, produit exact en tête — un meuble
  // visible dans le rendu ne peut jamais disparaître de la liste (bug démo 2026-07-09).
  const current = await getProject(projectId);
  const finalList = enforceExpertIntegratedPieces(shoppingList, current?.expertIntegratedPieces);

  // Anti-staleness (précalcul en fond) : si le rendu a changé pendant le matching
  // (itération), on ne persiste pas une liste calculée sur l'ancien rendu — le
  // CLEAR_FINALIZE de l'itération vient de vider shoppingList, l'écraser la figerait.
  if (current?.generatedRenderUrl === analysis.renderUrl) {
    // Le verrou est rafraîchi sur ce que le user va VOIR ; les demandes d'itération
    // en attente sont consommées (les catégories relâchées viennent d'être rejouées).
    await updateProject(projectId, {
      shoppingList: finalList, scoreFoyer, builtShoppingList: built,
      lockedShoppingList: finalList, pendingReleaseRequests: [], pendingReleaseElementIds: [],
    });
  } else {
    console.log("[pipeline:final] rendu changé pendant le matching → liste non persistée (stale)");
  }
  console.log(`[pipeline:final] (matching) ${finalList.length} items scorés`);
  return { shoppingList: finalList, scoreFoyer };
}
