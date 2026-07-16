import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { nanoid } from "nanoid";
import { resolvePrompt } from "@/lib/prompts/engine";
import { loadStyleContext, loadRoomDefaults, loadRoomRemoveCategories, formatUserInstructions, formatDesignPlan, ARCH_SURFACE_CATEGORIES, type UserChoicesInput } from "@/lib/prompts/helpers";
import { getElementCategoryEnum, getElementCategories, getAllowedActionsByCategory, getCategoryKeywordRemap, getFloorPresets } from "@/lib/db/assets";
import type { DecisionAction, ElementCategory } from "@/lib/db/assets";
import { mergeShoppingItems, resolveCatalogCategory } from "@/lib/shopping/categories";
import { bilanCo2, origineDe, type Origine } from "@/lib/co2";
import { getImageProvider, getVisionProvider } from "./provider";
import { saveRender } from "./saveRender";
import { logPipelineEvent } from "./logger";
import { withTracking } from "./track";
import { isTransientAiError } from "./retry";
import { enforceOpeningWalls, murDepuisBbox } from "./openings";
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

// Audit #13 (validé Alexis) : le JSON de détection injecté dans les prompts de
// GÉNÉRATION charrie dims/condition/surface_features — du bruit pour un modèle
// image (l'état d'usure ne le regarde pas) qui gonfle chaque prompt de plusieurs
// milliers de caractères. On élague à l'ASSEMBLAGE uniquement : la détection
// complète reste en DB pour le matching, le DIY et les audits. `movable` RESTE
// (demande explicite d'Alexis : c'est lui qui distingue ce qui peut bouger).
export function visionJsonPourPrompt(
  profiles: ElementProfile[],
  // Conversion de pièce (salon déclaré « chambre ») : les éléments à RETIRER
  // sortent aussi du JSON. Les y laisser, c'est décrire au modèle un canapé
  // (plan, matière, position) qu'une seule ligne en fin de prompt lui demande de
  // supprimer — il perdait l'arbitrage et restylait le salon (O_nmJO, 2026-07-16).
  // Leur seule mention doit être la removeList.
  removeCategories: string[] = [],
): string {
  const aRetirer = new Set(removeCategories);
  return JSON.stringify(
    profiles
      .filter((p) => !aRetirer.has(p.category))
      .map(({ dims: _d, condition: _c, surface_features: _s, ...garde }) => garde),
    null,
    2,
  );
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
    // Audit #18 (validé Alexis) : la version précédente ÉNUMÉRAIT un mobilier minimum
    // obligatoire (« AT LEAST: a large sofa, TWO armchairs… ») — le modèle l'exécutait
    // comme une liste de courses, même quand la pièce réelle appelait autre chose. On
    // garde l'exigence vérifiable (pas de moitié de pièce nue, seconde zone si besoin)
    // sans dicter l'inventaire : le contenu vient de la pièce et du roomType.
    return `\n- ROOM SIZE — LARGE: this room is BIG. A single small seating group leaves it half-empty — that is a failed render. Furnish it to its REAL potential with what this room type calls for: a generously sized, complete main zone (seating, tables, lighting, a rug that anchors the seats, textiles, wall decor) — and if open floor still dominates, a SECOND distinct zone in the style (a reading nook, a console with a mirror, a pair of poufs…). Every added piece stands FREE on the floor, never built into a wall. Circulation stays clear, and every rule above still holds.`;
  }
  if (roomScale === "small") {
    return `\n- ROOM SIZE — SMALL: keep to the essentials, correctly scaled (no oversized furniture); prioritize breathing room and circulation over adding pieces.`;
  }
  if (roomScale === "medium") {
    return `\n- ROOM SIZE — MEDIUM: comfortably furnished — the main zone complete (seating, tables, lighting, textiles, wall decor), no large bare stretch of floor or wall; still airy, never crowded.`;
  }
  return "";
}

// ── DIVERSITÉ DU MOBILIER ───────────────────────────────────────────────────
// Le modèle a un canapé et une table basse « par défaut » : d'un projet à l'autre, il
// repose souvent les mêmes (constat Alexis 2026-07-13). On lui impose donc une VARIANTE.
//
// Deux garde-fous :
//  1. on ne varie que la SILHOUETTE et la MATIÈRE — jamais la catégorie : varier au-delà
//     produirait des meubles qu'on ne sait pas vendre (le catalogue a des canapés et des
//     tables basses, pas des banquettes de piano) ;
//  2. le tirage est DÉTERMINISTE (dérivé de l'id du projet), pas aléatoire : deux projets
//     différents tombent sur des meubles différents, mais un même projet regénéré reste
//     stable — sinon chaque clic serait une loterie, et l'utilisateur ne pourrait plus
//     retrouver le rendu qu'il aimait.
const SILHOUETTES_CANAPE = [
  "a straight 3-seater with visible tapered wooden legs",
  "a deep modular sofa, low back, no visible legs",
  "a curved sofa with rounded arms",
  "an L-shaped corner sofa",
  "a channel-tufted sofa on slim metal legs",
  "a compact 2-seater paired with a second armchair",
];
const SILHOUETTES_TABLE_BASSE = [
  "round, in solid wood",
  "rectangular, wooden top on a black metal frame",
  "a pair of nesting tables of different heights",
  "oval, with a stone-look top",
  "a low square wooden block",
  "round, in metal and glass",
];

// Catégories NON-mobilières : elles n'entrent pas dans le compte des meubles.
const NON_MOBILIER = new Set([
  "floor", "wall", "ceiling", "window", "french_door", "door", "wall_opening",
  "radiator", "water_heater", "staircase", "fireplace", "ceiling_light", "wall_sconce",
  "curtains", "frame", "plant", "cushion", "decor_object", "other",
]);

/**
 * VERROU D'INVENTAIRE — le NOMBRE de meubles est celui de la photo.
 *
 * Rien ne le disait, et le modèle faisait n'importe quoi avec : il a SUPPRIMÉ un meuble TV
 * existant, en a dessiné DEUX (avec deux télés) sur une autre variation, et a RALLONGÉ le
 * canapé d'un module — un canapé qu'on ne pourra jamais racheter si le modèle est ancien
 * (QA Alexis 2026-07-14, projet yfZl5BqH). La liste des meubles « par défaut du salon »
 * (« sofa, coffee table, TV stand with TV… ») l'encourageait même à en ajouter un second.
 *
 * On lui donne donc le compte exact, catégorie par catégorie. Même patron que les points
 * lumineux, seul verrou qui ait jamais tenu : un NOMBRE explicite, pas une consigne molle.
 */
export function buildInventoryLockLine(
  profiles: ElementProfile[],
  // Catégories à RETIRER pour ce type de pièce (room_defaults.removeCategories) :
  // les compter mettait le verrou en guerre avec la removeList — pour un salon
  // déclaré « chambre », il disait « EXACTLY 1 sofa … NEVER delete one » pendant
  // que la removeList ordonnait de retirer ce canapé. Le modèle obéissait au
  // verrou → salon rendu dans une chambre (jyhDc8bQ, 2026-07-16).
  removeCategories: string[] = [],
): string {
  const aRetirer = new Set(removeCategories);
  const compte = new Map<string, number>();
  for (const p of profiles) {
    if (NON_MOBILIER.has(p.category) || aRetirer.has(p.category)) continue;
    compte.set(p.category, (compte.get(p.category) ?? 0) + 1);
  }
  if (compte.size === 0) return "";

  // Position depuis la bbox quand la détection l'a donnée (meubles structurants,
  // cf. OPENINGS_BOX_SUFFIX) : le verrou purement NUMÉRIQUE était violé quand le
  // meuble est COUPÉ par le bord du cadre — le modèle gardait l'original hors-champ
  // ET en bâtissait un second mieux placé (2 meubles TV, projet -qIiWS 2026-07-16).
  // Nommer la place — surtout « coupé par le bord » — ancre l'exemplaire existant,
  // exactement comme nommer le mur a ancré les ouvertures (a275927).
  const positionDe = (p: ElementProfile): string | null => {
    const b = p.bbox;
    if (!b) return null;
    const parts: string[] = [];
    const mur = murDepuisBbox(b);
    if (mur) parts.push(mur === "LEFT" ? "on the left" : mur === "RIGHT" ? "on the right" : "at the back");
    if (b.y + b.h > 0.9) parts.push("in the foreground");
    if (b.x <= 0.02 || b.x + b.w >= 0.98 || b.y + b.h >= 0.97) parts.push("partially CUT by the photo's edge — it still exists and still counts");
    return parts.length ? parts.join(", ") : null;
  };
  const posParCat = new Map<string, string[]>();
  for (const p of profiles) {
    if (NON_MOBILIER.has(p.category)) continue;
    const pos = positionDe(p);
    if (pos) posParCat.set(p.category, [...(posParCat.get(p.category) ?? []), pos]);
  }

  const liste = [...compte.entries()]
    .map(([cat, n]) => {
      const positions = posParCat.get(cat);
      const ou = positions?.length ? ` (${positions.join("; ")})` : "";
      return `${n} ${cat.replace(/_/g, " ")}${n > 1 ? "s" : ""}${ou}`;
    })
    .join(", ");

  return (
    `\n- THE ROOM'S FURNITURE, COUNTED: the photo contains EXACTLY ${liste}. ` +
    `Each of these exists in your render exactly that many times — kept (the same object) or replaced (ONE new piece standing in its place). ` +
    `NEVER delete one: a piece the owner already has does not vanish because the new layout is prettier without it. ` +
    `NEVER draw a second one either: one TV unit stays one TV unit, one sofa stays one sofa. ` +
    // ⚠️ CE VERROU COMPTE CE QUI EXISTE — IL N'INTERDIT PAS DE MEUBLER. Sans cette phrase,
    // il se lit comme un plafond : une pièce à moitié vide resterait à moitié vide, et une
    // pièce nue le resterait (Alexis, 2026-07-14 : « si tu fermes trop, il n'ajoutera plus
    // de meubles, et j'aurai une pièce vide »). Une pièce VIDE n'a d'ailleurs aucune ligne
    // de verrou du tout (rien à compter) : elle se meuble librement.
    `This list counts what EXISTS — it does NOT cap what is MISSING. Anything absent from it is genuinely absent from the room: ` +
    `if this room type needs it and the room does not have it, ADD it (one of each). A room that ends up bare, or half-furnished, is a FAILED render.` +
    // Le cas qui violait le compte : meuble TV au premier plan, coupé par le cadre →
    // le modèle en bâtissait un second face au canapé. On le nomme explicitement.
    (compte.has("tv_stand") || compte.has("television")
      ? ` THE TV LIVES WHERE THE PHOTO PUTS IT: the room's ONLY television sits on its photographed unit, even if that unit is at the edge of the frame or seen from behind — NEVER build a second TV, TV unit or media wall anywhere else.`
      : "")
  );
}

// Idée Alexis (2026-07-16) : si la détection a déjà trouvé un genre de meuble, la liste
// des défauts ne doit plus pousser à en AJOUTER un — c'est elle qui semait le doublon
// (« TV stand with TV » listé alors que la photo en a un, vu de dos au bord du cadre →
// le modèle en bâtit un « visible »). On n'en RETIRE aucun (le template dit « no other
// kind belongs here » : un canapé retiré deviendrait un intrus à supprimer) — on ANNOTE.
const DEFAULTS_KIND_CATEGORIES: Array<[RegExp, string[]]> = [
  [/tv stand|tv unit|meuble tv/i, ["tv_stand", "television"]],
  [/coffee table/i, ["coffee_table"]],
  [/dining table/i, ["dining_table"]],
  [/dining chair/i, ["dining_chair"]],
  [/floor lamp/i, ["floor_lamp"]],
  [/pendant/i, ["pendant_lamp"]],
  [/bookshelf|shelf/i, ["bookshelf", "shelf"]],
  [/sofa/i, ["sofa"]],
  [/armchair/i, ["armchair"]],
  [/\brug\b/i, ["rug"]],
  [/\bbed\b/i, ["bed"]],
  [/nightstand/i, ["nightstand"]],
  [/wardrobe/i, ["wardrobe"]],
  [/dresser/i, ["dresser"]],
  [/sideboard/i, ["sideboard"]],
  [/desk/i, ["desk"]],
  [/mirror/i, ["mirror"]],
];

export function annoteDefaultsSelonDetection(defaults: string, profiles: ElementProfile[]): string {
  const present = new Set(profiles.map((p) => p.category));
  return defaults
    .split(/,\s*/)
    .map((entry) => {
      const cats = DEFAULTS_KIND_CATEGORIES.find(([re]) => re.test(entry))?.[1] ?? [];
      const deja = cats.some((c) => present.has(c));
      return deja ? `${entry} (ALREADY in the photo — keep or replace THAT one, NEVER add a second)` : entry;
    })
    .join(", ");
}

/** Somme des codes de caractères : stable, suffisante pour répartir sur 6 variantes. */
function graine(projectId: string): number {
  let n = 0;
  for (const c of projectId) n = (n + c.charCodeAt(0)) % 100000;
  return n;
}

export function buildVariationLine(
  projectId: string,
  // Une catégorie à RETIRER de la pièce ne reçoit JAMAIS de variante : dire « if the
  // room gets a sofa, make it curved » dans une chambre est une invitation à garder
  // le canapé — et le fake d'O_nmJO a précisément rendu ce canapé courbe (2026-07-16).
  removeCategories: string[] = [],
): string {
  const g = graine(projectId);
  const aRetirer = new Set(removeCategories);
  const clauses: string[] = [];
  if (!aRetirer.has("sofa")) {
    clauses.push(`if the room gets a sofa, make it ${SILHOUETTES_CANAPE[g % SILHOUETTES_CANAPE.length]}`);
  }
  if (!aRetirer.has("coffee_table")) {
    clauses.push(`if it gets a coffee table, make it ${SILHOUETTES_TABLE_BASSE[(g >> 2) % SILHOUETTES_TABLE_BASSE.length]}`);
  }
  if (clauses.length === 0) return "";
  return `\n- VARIATION (do not fall back on your default furniture): ${clauses.join(". ").replace(/^if it/, "if the room")}. This fixes the SHAPE and the MATERIAL, never the category — stay fully within the style.`;
}

/**
 * CONVERSION DE PIÈCE — la photo montre des meubles d'un AUTRE usage (salon déclaré
 * « chambre »). Le template générique est écrit pour restyler une pièce qui garde sa
 * fonction : ses règles dures (« keep each furniture in its original zone ») et le
 * style (« low-slung sofas ») poussent à garder le salon, contre la seule removeList
 * en fin de prompt. Quand une conversion est en jeu, on l'annonce EN TÊTE DU PLAN —
 * la section la mieux suivie — pour que le retrait gagne l'arbitrage (O_nmJO, 2026-07-16).
 */
export function buildConversionLine(
  profiles: ElementProfile[],
  removeCategories: string[],
  roomType: string,
): string {
  const aRetirer = new Set(removeCategories);
  const concernes = profiles.filter((p) => aRetirer.has(p.category));
  if (concernes.length === 0) return "";
  const noms = concernes.map((p) => p.description?.trim() || p.element || p.category).join("; ");
  return `\n- THIS ROOM CHANGES FUNCTION: the photo still shows furniture from a previous use (${noms}). These pieces are GONE — reproduce NONE of them, do not restyle them, do not keep even one: their floor space is FREED. Furnish the room as a true ${roomType} instead (ROOM CONTENT below). Removing them changes NOTHING about the shell: same walls, same openings, same floor, same viewpoint.`;
}

/**
 * MISSION DE CONVERSION — injectée dans la PREMIÈRE PHRASE du template ({{conversionMission}}).
 * Le banc du 2026-07-16 (replay O_nmJO, 3+3 rendus) a prouvé que la purge du JSON/variation
 * + une ligne dans le plan ne suffisent PAS : sur une tâche d'ÉDITION, la photo du salon
 * gagne contre toute consigne enterrée — 6/6 rendus « salon sans lit ». La conversion doit
 * définir la MISSION elle-même, pas être une règle parmi trente. Vide hors conversion
 * (le placeholder doit TOUJOURS être fourni : resolvePrompt strict throw sinon).
 */
export function buildConversionMission(
  profiles: ElementProfile[],
  removeCategories: string[],
  roomType: string,
  // Défauts BRUTS du room type (avant annotation) : le premier item est la pièce
  // maîtresse attendue (« bed » pour une chambre) — data-driven, rien de codé en dur.
  roomDefaults: string,
): string {
  const aRetirer = new Set(removeCategories);
  const concernes = profiles.filter((p) => aRetirer.has(p.category));
  if (concernes.length === 0) return "";
  const noms = concernes.map((p) => p.description?.trim() || p.element || p.category).join("; ");
  // Certains room_defaults sont une LISTE (« bed, nightstand… ») dont le 1er item est
  // la pièce maîtresse ; d'autres de la PROSE (« A DINING ROOM. The dining TABLE… ») —
  // là, coller le 1er morceau produirait une phrase absurde : on reste générique.
  const premier = roomDefaults.split(",")[0]?.trim() ?? "";
  const centre =
    premier && premier.length <= 30 && !premier.includes(".")
      ? `a ${premier} is the new centerpiece, standing where the old set-up stood`
      : `its defining furniture (ROOM CONTENT below) takes over the freed space`;
  return ` THE ROOM'S FUNCTION CHANGES — this is the ONE big transformation of this edit: the photo still shows the room furnished for ANOTHER use (${noms}). In your render that old set-up has been MOVED OUT: NONE of those pieces appears — not restyled, not repositioned, not even one — their floor space is freed. The room is furnished as a genuine ${roomType} instead: ${centre}, completed per ROOM CONTENT. The shell does not move: same walls, same openings, same floor, same viewpoint.`;
}

export async function buildLightingPlanLine(
  profiles: ElementProfile[],
  styleName: string,
  // Décisions du verdict : un luminaire en « none » est GARDÉ tel quel. Sans ça, la
  // ligne disait « swap each fixture » sans consulter le plan — la suspension design
  // que le verdict conservait était remplacée par une coupole générique, puis LISTÉE
  // À L'ACHAT par la réconciliation (n-ALUOR, QA Alexis 2026-07-16). Le template gen
  // présente le swap de luminaire comme « expected and good » : seul le PLAN peut
  // l'en dispenser, donc c'est ici que le keep doit se dire.
  decisions?: ElementDecision[] | null,
): Promise<string> {
  const lights = await lightpointProfiles(profiles);
  const cats = await getElementCategories().catch(() => [] as ElementCategory[]);
  const replaceOnly = new Set(cats.filter((c) => c.replace_only).map((c) => c.slug));
  const gardes = new Set(
    (decisions ?? []).filter((d) => d.mismatch_type === "none").map((d) => d.element_id),
  );

  // Les APPLIQUES comptent à part. Fondues dans le total (« exactement 3 points
  // lumineux »), le modèle ne savait pas combien étaient MURALES — et en peignait une de
  // plus, parfois sur une porte de placard (projet iZp1c73T, 2026-07-13 : 2 sur la photo,
  // 3 au rendu). Le compte séparé rend la violation flagrante pour lui.
  const murales = lights.filter((l) => replaceOnly.has(l.category));
  const plafond = lights.filter((l) => !replaceOnly.has(l.category));

  const repere = (l: ElementProfile) =>
    (l.description?.trim() || l.element || l.category).replace(/\s+/g, " ").slice(0, 70);

  const lignes: string[] = [];

  if (plafond.length === 0) {
    lignes.push(`- CEILING LIGHTS: this room has NO ceiling light point — add NONE (a floor/table lamp is allowed only per the lighting rule).`);
  } else {
    // « pendant over the dining table » : biais récurrent du modèle — il en ajoute
    // une même quand aucun point électrique n'existe là (banc out-lightblur s02).
    const aGarder = plafond.filter((l) => gardes.has(l.element_id));
    const aSwapper = plafond.filter((l) => !gardes.has(l.element_id));
    const parts: string[] = [];
    if (aGarder.length) {
      parts.push(
        `KEEP ${aGarder.length === plafond.length ? "each one" : `${aGarder.length} of them`} EXACTLY as photographed — same fixture, same model, the owner keeps it: ${aGarder.map(repere).join(" · ")}`,
      );
    }
    if (aSwapper.length) {
      parts.push(
        `swap ${aGarder.length ? `the other ${aSwapper.length}` : "each existing fixture"} — ${aSwapper.map(repere).join(" · ")} — for a ${styleName} fixture AT ITS EXACT SAME ceiling point`,
      );
    }
    lignes.push(
      `- CEILING LIGHTS (exactly ${plafond.length}): ${parts.join("; ")}. The result contains EXACTLY ${plafond.length}: not one more, none added elsewhere, none duplicated. A dining table does NOT automatically get a pendant above it — only if one of the existing points is already there.`,
    );
  }

  if (murales.length === 0) {
    lignes.push(
      `- WALL SCONCES: this room has ZERO (0). Paint NOT A SINGLE ONE. A sconce is fed by a cable buried in the wall — inventing one promises rewiring we cannot deliver. The output must contain 0 wall sconces.`,
    );
  } else {
    const muralesGardees = murales.filter((l) => gardes.has(l.element_id));
    const consigneMurales = muralesGardees.length === murales.length
      ? `KEEP each one EXACTLY as photographed (same sconce, same model — the owner keeps them).`
      : muralesGardees.length
        ? `KEEP ${muralesGardees.map(repere).join(" · ")} exactly as photographed; swap the others for a ${styleName} sconce AT THEIR EXACT SAME wall point.`
        : `Swap each for a ${styleName} sconce AT ITS EXACT SAME wall point.`;
    lignes.push(
      `- WALL SCONCES (exactly ${murales.length}): ${murales.map(repere).join(" · ")}. ${consigneMurales} The output must contain EXACTLY ${murales.length} — count them before you finish. Do NOT add a ${murales.length + 1}th anywhere, do NOT repeat them along the wall as a decorative motif, and NEVER mount one on a door, a cupboard front, a wardrobe, panelling or any joinery: no cable runs there.`,
    );
  }

  return lignes.join("\n");
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

/**
 * LE MEUBLE CONSERVÉ, MONTRÉ PLUTÔT QU'INTERDIT.
 *
 * « Ne redessine pas le canapé » ne suffit pas : le modèle régénère TOUTE l'image, et un
 * canapé sans accoudoirs revient avec des accoudoirs, un cadre en bois, une autre assise
 * (QA Alexis 2026-07-14, dispo 1 de Pp3p3JZt — verdict « conserver », canapé déformé).
 * L'ordre négatif sur une image ne marche pas ; la référence VISUELLE, si — c'est déjà ce
 * qui a sauvé la réparation d'architecture (montrer la photo d'origine) et c'est le
 * principe du swap expert.
 *
 * On découpe donc chaque assise CONSERVÉE dans la photo et on la joint au prompt. Aucun
 * appel de plus : juste une image de plus dans le même appel.
 */
// ⚠️ DÉSACTIVÉ PAR DÉFAUT (2026-07-16) — CE MÉCANISME RÉINVENTAIT LA PIÈCE.
// Banc A/B contrôlé (bench-dispositions --ctxFrom=Q8zUH, tout identique sauf les crops) :
// avec crops = 14 fautes d'architecture, 3/5 pièces méconnaissables, ratio de sortie
// décroché de la photo (1472x704 sur photo 4:3 — signature d'une COMPOSITION, plus une
// édition) ; sans crops = 0 faute, 5/5 fidèles. Joindre des gros plans en refImages fait
// basculer gemini-2.5-flash-image d'édition en composition : il assemble une scène neuve
// autour des meubles montrés. C'était LA cause des dispositions « réinventées » des
// 15-16/07 (mêmes prompts DB, ancien code Vercel sans crops = OK). SEAT_REF_CROPS=1
// pour ré-expérimenter ; le problème d'origine (canapé conservé redessiné avec
// accoudoirs) doit se traiter DANS le prompt ou par un autre canal, pas par des images.
const SEAT_REF_CROPS = process.env.SEAT_REF_CROPS === "1";

export async function refsAssisesConservees(
  basePhotoUrl: string,
  profiles: ElementProfile[],
  decisions: ElementDecision[] | undefined,
): Promise<{ images: ImageInput[]; note: string }> {
  if (!SEAT_REF_CROPS) return { images: [], note: "" };
  const conservees = new Set(
    (decisions ?? []).filter((d) => d.mismatch_type === "none").map((d) => d.element_id),
  );
  const cibles = profiles.filter(
    (p) => SEAT_CATS.has(p.category) && conservees.has(p.element_id) && p.bbox,
  );
  if (cibles.length === 0) return { images: [], note: "" };

  try {
    const photo = await fetchImageBytes(basePhotoUrl);
    const crops: ImageInput[] = [];
    const libelles: string[] = [];
    for (const p of cibles.slice(0, 3)) {
      const crop = await extractCrop(photo, p.bbox);
      if (!crop) continue;
      crops.push(crop as unknown as ImageInput);
      libelles.push(p.description?.trim() || p.category);
    }
    if (crops.length === 0) return { images: [], note: "" };

    return {
      images: crops,
      note:
        `\n=== THE KEPT SEATING — LOOK AT THE LAST ${crops.length} IMAGE(S) BEFORE YOU DRAW ===\n` +
        `The last ${crops.length} attached image(s) are close-ups, cut out of the room photo, of the piece(s) the plan says to KEEP: ` +
        `${libelles.join("; ")}.\n` +
        `BEFORE drawing each of them, LOOK at its close-up and answer, silently: does it have ARMS? does it have visible LEGS? how many seats / modules? ` +
        `Then draw EXACTLY that. An armless sofa comes back ARMLESS. A legless sofa comes back LEGLESS. A 3-module sofa comes back with 3 modules. ` +
        `Same silhouette, same proportions, same size, same back, same fabric, same colour.\n` +
        `Adding arms, a wooden frame, a base, piping or a module it does not have is a FAILED render — the owner keeps THIS piece, and would have to ` +
        `recognise it in your image.\n` +
        `You may MOVE it, turn it and re-group it as the layout requires — keeping a piece means not changing the OBJECT, never freezing it in place.`,
    };
  } catch {
    return { images: [], note: "" }; // la référence est un bonus : jamais bloquante
  }
}

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

  // OUVERTURES — compte explicite ET interdiction explicite, dans les DEUX cas.
  //
  // On ne disait « NEVER add one » que lorsque le compte était ZÉRO. Dès qu'il y avait au
  // moins une ouverture, la ligne se réduisait à un décompte (« 1 fenêtre(s) ») : le
  // modèle satisfaisait « il y a 1 fenêtre » en en DESSINANT une là où ça l'arrangeait,
  // le mur du fond devenant une porte-fenêtre à balcon (dispo 3 de O0DNBvO, 2026-07-13).
  // Les points lumineux, eux, tiennent depuis qu'ils annoncent « EXACTLY n — never add
  // one » : c'est ce patron qu'on applique ici. Et surtout, on dit ce qui n'était nulle
  // part : TOUT MUR NON LISTÉ EST PLEIN — le fait devient explicite au lieu d'être une
  // déduction laissée au modèle.
  const OUVERTURES: Record<string, string> = {
    window: "window",
    french_door: "french door",
    door: "door",
    wall_opening: "open passage to another room",
  };
  // Le mur vient de lib/ai/openings.ts : le prompt qui ANNONCE les murs pleins et le
  // contrôle qui les VÉRIFIE doivent partager la même définition, sinon ils divergeront.
  // Sans boîte, on ne prétend pas savoir : le compte reste, la position est tue.
  const murDe = (p: ElementProfile): string | null => murDepuisBbox(p.bbox);

  const ouvertures = profiles.filter((p) => OUVERTURES[p.category]);
  if (ouvertures.length === 0) {
    parts.push(
      "NO opening of any kind (0 window, 0 french door, 0 door, 0 passage) — every wall is SOLID. NEVER add one, and NO curtains anywhere",
    );
  } else {
    // Le VERROU EST POSITIONNEL, pas seulement numérique. Il ne l'était pas : le prompt
    // n'annonçait qu'un compte (« 1 porte-fenêtre »), que le modèle satisfaisait en la
    // DÉPLAÇANT sur le mur libéré par la nouvelle disposition (dispo 3 de O0DNBvO :
    // porte-fenêtre passée de gauche à droite, compte inchangé). On nomme donc le mur de
    // chacune, et surtout on déclare PLEINS les murs qui n'en portent aucune — le fait
    // devient explicite au lieu d'être une déduction laissée au modèle.
    const parMur = new Map<string, string[]>();
    // La catégorie seule TRAHISSAIT la photo : la taxonomie range une baie vitrée
    // coulissante de 3,5 m sous `french_door`, et le prompt annonçait « 1 french door »
    // — le modèle, sommé de reproduire « the COMPLETE set », EXÉCUTAIT le texte : il
    // remplaçait la baie par une vraie petite porte-fenêtre et rebâtissait le mur
    // autour (D1 de UJAH8T sur test1, 2026-07-16 : pièce entière réinventée). On
    // réinjecte donc la description et la largeur DÉTECTÉES : le verrou redevient
    // une description de la photo, pas une réécriture appauvrie.
    const liste = ouvertures.map((p) => {
      const mur = murDe(p);
      if (mur) parMur.set(mur, [...(parMur.get(mur) ?? []), OUVERTURES[p.category]]);
      const desc = p.description ? ` (in the photo: "${p.description}"${p.dims?.width_cm ? `, ~${p.dims.width_cm} cm wide` : ""})` : "";
      return `1 ${OUVERTURES[p.category]}${mur ? ` on the ${mur} wall` : ""}${desc}`;
    });
    const pleins = ["LEFT", "BACK", "RIGHT"].filter((m) => !parMur.has(m));
    const w = count("window");
    const fd = count("french_door");

    parts.push(
      `EXACTLY ${ouvertures.length} opening(s), and here is WHERE: ${liste.join("; ")}. ` +
        `This is the COMPLETE set. Reproduce each one on ITS OWN wall, same size, same place — never move one to another wall, never add one, never remove one. ` +
        // Primauté de la photo : la clause « PRESERVE it anyway » du template a sauté
        // dans une refonte (v38 ne l'a plus) — on la porte ICI, côté code, pour qu'elle
        // survive aux réécritures de template. Sans elle, une détection appauvrie fait
        // loi et le rendu suit le TEXTE contre la PHOTO.
        `Each opening keeps its PHOTOGRAPHED size, span and frame: a wide glazed bay stays a wide glazed bay — NEVER shrunk into a smaller door or window, never simplified. If the photo shows an opening that this list missed or under-describes, the PHOTO wins: reproduce exactly what is photographed.` +
        (pleins.length
          ? ` The ${pleins.join(" and ")} wall${pleins.length > 1 ? "s are" : " is"} SOLID: no window, no french door, no passage there, EVER — ` +
            `even if the new layout leaves ${pleins.length > 1 ? "them" : "it"} bare, even if an opening there would look better. A bare wall takes furniture, art, or nothing at all — never a hole.`
          : "") +
        (w + fd === 0 ? " NO curtains anywhere (no window to hang them on)." : ""),
    );
  }
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
  // CHEMINÉE — on n'en parle QUE s'il y en a une.
  //
  // La règle vivait dans le gabarit, donc le mot « fireplace » partait dans TOUS les prompts,
  // y compris pour des pièces qui n'en ont pas — et le modèle finissait par en dessiner une
  // (manteau de marbre inventé, 2026-07-14). C'est la même faute que les briefs qui
  // nommaient « fireplace, TV or window » : on plante la graine. Elle la présentait en plus
  // comme « le POINT FOCAL », ce qui invitait à orienter le canapé dessus — alors qu'Alexis
  // demande l'inverse : « ne dis pas de mettre le canapé face à la cheminée, dis que s'il y
  // en a une, on ne met pas de meuble juste devant ».
  //
  // La consigne est donc INJECTÉE PAR LA DONNÉE : pas de cheminée détectée, pas un mot.
  const cheminees = profiles.filter(
    (p) =>
      p.category === "fireplace" ||
      /chemin[ée]e|fireplace|manteau de chemin|insert|po[êe]le/i.test(`${p.element ?? ""} ${p.description ?? ""}`),
  );
  if (cheminees.length > 0) {
    const mur = murDepuisBbox(cheminees[0].bbox);
    parts.push(
      `a FIREPLACE${mur ? ` on the ${mur} wall` : ""} — reproduce it EXACTLY as the photo shows it, same place, same mantel, same surround. ` +
        `Keep it FULLY VISIBLE and keep the floor in front of it CLEAR: never place a sofa, an armchair, a sideboard or any other furniture ` +
        `right in front of it, against it, or across its opening. Never cover it, box it in or wall it up`,
    );
  }

  // Fixtures FIXES à reproduire à l'identique (jamais déplacer/supprimer/ajouter/recolorer).
  // ⚠️ inclut le CHAUFFE-EAU/ballon (était absent → la génération le supprimait), et le poêle.
  // ÉLECTROMÉNAGER ajouté (2026-07-13) : dans un studio, le frigo est devenu un buffet en
  // cannage (projet 3nh0_lxN). Un appareil est branché, alimenté, parfois évacué : il se
  // reproduit à l'identique, comme un radiateur — jamais « restylé » en meuble.
  const KW = /escalier|staircase|stair|chemin|fireplace|po[êe]le|radiat|chauffe[- ]?eau|water[- ]?heater|ballon|cumulus|poutre|beam|colonne|column|pilier|pillar|frigo|r[ée]frig[ée]rateur|fridge|refrigerator|cong[ée]lateur|freezer|four\b|oven|lave[- ]?vaisselle|dishwasher|lave[- ]?linge|washing machine|hotte|extractor|plaque de cuisson|hob|cookto/i;
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
  "ignorée. Rater une ouverture fait construire un mur à sa place en génération (grave)." +
  // Rideaux moutarde au bord gauche du cadre non détectés (n-ALUOR, 2026-07-16) : le rendu
  // les gardait, la réconciliation les croyait NOUVEAUX → facturés au client alors qu'il
  // les possède. Même famille de ratés que les meubles coupés par le cadre.
  "\n\nIMPORTANT — BORDS DU CADRE : inventorie aussi les éléments PARTIELLEMENT COUPÉS par le " +
  "bord de la photo — rideaux au bord d'une fenêtre, meuble du premier plan vu de dos, tapis " +
  "dont on ne voit qu'un coin. Un élément coupé existe : le rater le fait facturer comme " +
  "NOUVEAU en aval alors que le client le possède déjà.";

export async function detectElementProfiles(
  projectId: string,
  sourceImage: ImageInput,
  label: string,
  opts?: { withBbox?: boolean },
  // Sortie annexe optionnelle (non cassante) : room_scale estimé par la même
  // détection — petit/moyen/grand salon ne se meublent pas pareil.
  out?: { roomScale?: "small" | "medium" | "large" },
): Promise<ElementProfile[]> {
  const tDet = Date.now();
  // Taxonomie DB-driven, COMPLÈTE : on nomme tout ce qu'on voit, quelle que soit la pièce
  // annoncée. Le type de pièce ne passe PLUS ici — il décide en aval de ce qu'on fait de
  // chaque élément (room_defaults.removeCategories), pas de ce qu'on a le droit de voir.
  // Le filtrer ici rendait un canapé invisible dans une chambre (il tombait en `other`),
  // donc impossible à retirer, à acheter ou à compter.
  const categories = await getElementCategoryEnum();
  const detPrompt = await resolvePrompt("vision_detect_extended", { categories }, { strict: false });
  // withBbox = inventaire du rendu : on émet AUSSI les attrs V3 (tous les meubles du rendu
  // sont des achats potentiels) → score structuré pour les AJOUTS (pièces vides), et on
  // OMET les champs DIY (lean) : cet inventaire ne sert qu'au matching.
  const ROOM_SCALE_SUFFIX =
    `\nROOM SCALE: wrap the output as {"room_scale": "small|medium|large", "elementProfiles": [...]} — ` +
    `room_scale = overall floor area of the room judged from the photo (small <15m², medium 15-25m², large >25m²).`;
  // Boîte des SEULES ouvertures, sur la détection SOURCE. Sans elle, le prompt de
  // génération ne connaissait que le NOMBRE d'ouvertures : le modèle satisfaisait
  // « exactement 1 porte-fenêtre » en la DÉPLAÇANT sur le mur que sa disposition libérait
  // (dispo 3 de O0DNBvO : porte-fenêtre passée du mur gauche au mur droit, compte
  // inchangé — un verrou par comptage y est aveugle). On demande donc la position, dans
  // l'appel qui tourne déjà : aucun appel de plus, quelques dizaines de tokens en sortie.
  // Boîtes des OUVERTURES (pour dire au prompt quels murs sont pleins) et des ASSISES
  // (pour découper le canapé conservé et le MONTRER au modèle en référence : lui dire de
  // ne pas le redessiner ne suffit pas, il lui ajoute des accoudoirs quand même).
  // + meubles STRUCTURANTS (tv_stand, sideboard…) depuis 2026-07-16 : le verrou
  // d'inventaire était purement NUMÉRIQUE (« EXACTLY 1 tv stand ») et le modèle le
  // violait quand le meuble est COUPÉ par le bord du cadre — il gardait l'original
  // hors-champ ET en bâtissait un second face au canapé (projet -qIiWS, 2 meubles
  // TV). Même leçon que les ouvertures (a275927) : le compte ne suffit pas, il faut
  // NOMMER la position. La boîte permet de dire « au premier plan gauche, coupé par
  // le cadre — c'est LE poste TV » dans buildInventoryLockLine.
  const OPENINGS_BOX_SUFFIX =
    "\n\nEN PLUS : pour les SEULS éléments dont la catégorie est window, french_door, door, wall_opening, " +
    "sofa, armchair, chair, dining_chair, bench, " +
    "tv_stand, television, sideboard, dresser, bookshelf ou shelf, " +
    'ajoute "box_2d": [ymin, xmin, ymax, xmax] — boîte englobante SERRÉE, en ENTIERS de 0 à 1000 ' +
    "(origine en haut à gauche), y compris si l'objet est PARTIELLEMENT COUPÉ par le bord de la photo " +
    "(borne la boîte au bord). Aucun autre élément n'a besoin de box_2d.";
  const template = opts?.withBbox
    ? detPrompt.resolvedTemplate + NO_REFLECTION_SUFFIX + BBOX_SUFFIX + buildAttrsInstruction() + LEAN_INVENTORY_SUFFIX
    : detPrompt.resolvedTemplate + NO_REFLECTION_SUFFIX + ROOM_SCALE_SUFFIX + OPENINGS_BOX_SUFFIX;
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
  const remap = await getCategoryKeywordRemap();
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
      // box_2d (convention native) d'abord ; repli sur l'ancien champ bbox. Toujours
      // parsée : la détection source ne la renvoie que pour les ouvertures (cf.
      // OPENINGS_BOX_SUFFIX), et c'est elle qui permet de dire SUR QUEL MUR elles sont.
      bbox:
        parseBox2d((p as { box_2d?: unknown }).box_2d) ??
        parseBbox((p as { bbox?: unknown }).bbox) ??
        undefined,
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
    const profiles = await detectElementProfiles(projectId, sourceImage, label, undefined, out);
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
    // ÉCHEC BRUYANT, pas de review vide silencieuse : une pièce meublée qui
    // détecte 0 élément = détection cassée (parse, bundle HMR périmé…), pas une
    // pièce vide. On ne persiste RIEN (l'ancien état reste réutilisable) et on
    // remonte l'erreur à la route → l'UI peut proposer de réessayer.
    // (Incident 2026-07-14 : review vide après refactor à chaud de la détection.)
    throw new Error("Détection vide (0 élément) — analyse abandonnée, réessayez (serveur peut-être à redémarrer)");
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
  //
  // SANS directive, on GARDE — la règle produit était écrite ici, mais elle ne s'appliquait
  // QUE si l'utilisateur avait rempli l'écran des contraintes. Sans elle, le verdict de
  // style faisait loi : il a décidé d'arracher un parquet chevrons haussmannien pour cause
  // de « style moderne » (projet 4oxGnkEm, QA Alexis 2026-07-14). Refaire un sol est le
  // poste le plus lourd d'un projet — en argent, en travaux et en CO₂ : on ne le propose
  // JAMAIS de sa propre initiative.
  const floorChoice = project.userConstraints?.floor;
  const decisionsWithFloor = await (async () => {
    if (!floorChoice) {
      return finalDecisions.map((d) =>
        d.category === "floor"
          ? { ...d, mismatch_type: "none" as const, action_slug: null, action_label: null, supply_items: null, qty: null }
          : d,
      );
    }
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

  // ── 9. LA PIÈCE DEMANDÉE FAIT LOI ──────────────────────────────────────────
  // Un meuble étranger à la pièce (un canapé dans une chambre) est RETIRÉ, pas décidé :
  // il ne peut être ni conservé, ni personnalisé, ni remplacé — sinon le plan le CLOUE
  // en place (« garder ce canapé exactement ») et le rendu, qui suit le plan ligne à
  // ligne, produit un salon là où on demandait une chambre (incident 2026-07-13).
  // Il ne disparaît pas pour autant du prompt : {{removeList}}, construit à partir des
  // profils détectés, dit explicitement au modèle de le retirer et de libérer sa place.
  const aRetirer = new Set(await loadRoomRemoveCategories(project.roomType));
  const decisionsPropres = decisionsWithFloor.filter((d) => !aRetirer.has(d.category));
  const retires = decisionsWithFloor.length - decisionsPropres.length;
  if (retires > 0) {
    console.log(`[pipeline:analyze] ${retires} élément(s) étranger(s) à « ${project.roomType} » → à retirer, hors plan`);
  }

  await updateProject(projectId, { element_decisions: decisionsPropres, visionOutput: profiles, ...CLEAR_FINALIZE });
  console.log(`[pipeline:analyze] saved ${decisionsPropres.length} decisions (2 calls: detection + verdict)`);
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
  const roomDefaultsBruts = await loadRoomDefaults(project.roomType);
  const furnitureDefaults = annoteDefaultsSelonDetection(roomDefaultsBruts, profiles);
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
    visionJson: visionJsonPourPrompt(profiles, removeCategories),
    conversionMission: buildConversionMission(profiles, removeCategories, project.roomType, roomDefaultsBruts),
    fixedFeatures: await buildFixedFeaturesSummary(profiles),
    // Éléments détectés à retirer pour ce type de pièce (asset ∩ détection).
    removeList: buildRemoveList(profiles, removeCategories),
    userInstructions,
    designPlan: `${designPlan || "None — restyle freely to fit the style."}${buildConversionLine(profiles, removeCategories, project.roomType)}\n${await buildLightingPlanLine(profiles, styleName, project.element_decisions as ElementDecision[] | undefined)}${buildRoomScaleLine(project.roomScale)}${buildVariationLine(project.id, removeCategories)}${buildInventoryLockLine(profiles, removeCategories)}${canaryPlanNote}`,
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

  // Les assises CONSERVÉES sont jointes en photo : leur dire de ne pas les redessiner ne
  // suffit pas, il faut les leur MONTRER (cf. refsAssisesConservees).
  const assises = await refsAssisesConservees(
    project.basePhotoUrl,
    profiles,
    project.element_decisions as ElementDecision[] | undefined,
  );
  if (assises.images.length) {
    refImages = [...(refImages ?? []), ...assises.images];
    refNote += assises.note;
    console.log(`[pipeline:generate] ${assises.images.length} assise(s) conservée(s) jointe(s) en référence`);
  }

  const t1 = Date.now();
  const genPrompt = await resolvePrompt(genSlug, genCtx, { strict: false });
  const genResult = await withTracking(
    { step: "generation", projectId, provider: genPrompt.prompt.provider,
      requestPayload: { promptName: genSlug, prompt: genPrompt.resolvedTemplate } },
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
  // AUDIT→RETOUCHE ouvertures : un mur plein dans la photo ne peut pas être percé.
  const openFixed = await enforceOpeningWalls(
    projectId, seatFixed, profiles, genPrompt.prompt.provider, "first-render", project.storageFolder, project.basePhotoUrl,
  );
  genResult.imageBuffer = openFixed.imageBuffer;
  genResult.mimeType = openFixed.mimeType;

  // NOTE: audit_quality prompt exists but is intentionally not called here.
  // Audit belongs in a future "finalize" step triggered explicitly by the user,
  // not at generation time where it costs a Gemini Vision call with no action taken.

  const renderUrl = await saveRender(genResult.imageBuffer, project.storageFolder, genResult.mimeType, "first-render");
  const firstRender = project.firstRenderUrl ?? renderUrl;
  await updateProject(projectId, {
    generatedRenderUrl: renderUrl,
    firstRenderUrl: firstRender,
    iterationCount: 0,
    // UN NOUVEAU RENDU INVALIDE TOUT CE QUI EN DÉCOULAIT. Ces champs ne sont pas dans
    // CLEAR_FINALIZE : l'itération standard, elle, doit les conserver — elle pose son
    // propre verrou juste avant, et le spread de CLEAR_FINALIZE l'écraserait.
    //
    // · lockedShoppingList — le verrou de liste est rafraîchi à CHAQUE calcul (« un
    //   refresh ne doit RIEN changer »). Il survivait donc à une régénération et FIGEAIT
    //   l'ancienne liste : le rendu changeait, la liste restait celle d'avant. Une pièce
    //   régénérée en chambre gardait le canapé du rendu précédent (QA Alexis 2026-07-12).
    // · expertIntegratedPieces — mémoire de ce qui est incrusté dans le rendu EXPERT,
    //   lequel dérive du fake. Nouveau fake ⇒ mémoire périmée : sans ça,
    //   enforceExpertIntegratedPieces ré-injectait les meubles du rendu précédent.
    // · renderAnalysis / expertRenderUrl — recalculés sur le nouveau rendu.
    lockedShoppingList: undefined,
    pendingReleaseRequests: [],
    pendingReleaseElementIds: [],
    renderAnalysis: undefined,
    expertRenderUrl: undefined,
    expertIntegratedPieces: undefined,
    expertIterated: undefined,
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
export const DISPOSITION_BRIEFS = [
  // MOINS AMBITIEUX, MAIS FIABLE (décision Alexis, 2026-07-16). On a essayé de faire BOUGER
  // les meubles entre les 3 dispositions ; sur NB1 ça déclenchait une dérive d'architecture
  // (boiseries ajoutées, fenêtres changées, surtout sur les grandes pièces ouvertes) — le
  // modèle, dès qu'on lui rend de la liberté d'agencement, en profite pour redessiner les
  // murs. « L'architecture n'a rien à faire dans l'agencement » (Alexis). Donc : édition
  // stricte (murs ET meubles gardés en place), et les 3 variations diffèrent par le STYLE —
  // palette et densité de déco — pas par le layout. Fiable d'abord.
  //
  // Aucun nom d'architecture ici (pas de cheminée/fenêtre/mur) : les nommer poussait le
  // modèle à en fabriquer (cheminée de marbre, balcon inventés).
  "Variation 1 — DOUCE ET LUMINEUSE. Keep the room's layout exactly as the photo (nothing moves). Dress it in the LIGHTEST, airiest reading of the {{styleName}} palette: pale, warm neutrals on the surfaces the plan allows you to repaint, natural textures, restrained decor — a large soft rug, a few cushions, one throw, greenery, calm wall art. Bright and serene. Magazine-quality, unmistakably {{styleName}}.",
  "Variation 2 — CHALEUREUSE ET HABITÉE. Same layout, nothing moves. Now the deepest, most saturated version of the {{styleName}} palette on the surfaces the plan allows you to repaint, and a richly layered, collected look: more textiles, more plants, a bold rug, generously dressed surfaces, a statement piece of wall art. Warm and enveloping. Clearly a different mood from the other two.",
  // ⚠️ d3 ne dit PLUS « the most design-forward / graphic / boldest ». Ce registre donnait
  // à NB1 la licence de RÉINTERPRÉTER la pièce — il ajoutait des boiseries, rétrécissait la
  // baie, resserrait le cadrage (QA Alexis 2026-07-16, d3 de CKSoR12). d1 et d2 restent
  // fidèles parce qu'ils sont sages. d3 est donc audacieux SUR LA DÉCO uniquement (couleur
  // d'accent, textiles à motifs, art fort), jamais « design-forward » au sens qui touche la
  // pièce. Comme les deux autres : même layout, mêmes murs, même cadrage.
  "Variation 3 — L'ACCENT COLORÉ. Same layout, nothing moves — exactly the same room, walls, openings and framing as the photo. It is ONLY the decoration that is bolder here: pick ONE confident accent colour from the {{styleName}} palette for the wall surfaces the plan allows you to repaint, then dress the room with patterned textiles (a graphic rug, printed cushions, a throw), a couple of strong decorative objects and one large piece of wall art. Contrasted and characterful in its DECOR — never in its architecture. Magazine-quality, unmistakably {{styleName}}.",
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
    profiles = await detectElementProfiles(projectId, sourceImage, "dispositions");
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
  const roomDefaultsBruts = await loadRoomDefaults(project.roomType);
  const furnitureDefaults = annoteDefaultsSelonDetection(roomDefaultsBruts, profiles);
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
    visionJson: visionJsonPourPrompt(profiles, removeCategories),
    conversionMission: buildConversionMission(profiles, removeCategories, project.roomType, roomDefaultsBruts),
    fixedFeatures: await buildFixedFeaturesSummary(profiles),
    removeList: buildRemoveList(profiles, removeCategories),
    userInstructions,
    // Mêmes lignes de plan que le rendu unique : la taille de pièce et la variation de
    // mobilier leur manquaient, d'où des dispositions vides et un mobilier « par défaut ».
    designPlan: `${designPlan || "None — restyle freely to fit the style."}${buildConversionLine(profiles, removeCategories, project.roomType)}\n${await buildLightingPlanLine(profiles, styleName, project.element_decisions as ElementDecision[] | undefined)}${buildRoomScaleLine(project.roomScale)}${buildVariationLine(project.id, removeCategories)}${buildInventoryLockLine(profiles, removeCategories)}`,
  };

  // Les assises conservées, montrées en photo — c'est ICI que le canapé se faisait le plus
  // redessiner : chaque disposition le replace ailleurs, donc le REDESSINE entièrement.
  const assises = await refsAssisesConservees(
    project.basePhotoUrl,
    profiles,
    project.element_decisions as ElementDecision[] | undefined,
  );
  if (assises.images.length) {
    console.log(`[pipeline:dispositions] ${assises.images.length} assise(s) conservée(s) jointe(s) en référence`);
  }

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
          requestPayload: { promptName: dispoSlug, disposition: i + 1, prompt: genPrompt.resolvedTemplate } },
        () =>
          getImageProvider(genPrompt.prompt.provider).generateFromText(
            genPrompt.resolvedTemplate + assises.note,
            sourceImage,
            assises.images.length ? assises.images : undefined,
          ),
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
      // C'est ICI que le défaut se concentre : une disposition qui vide le mur d'en face
      // pousse le modèle à y percer une porte-fenêtre à balcon.
      const openFixed = await enforceOpeningWalls(
        projectId, seatFixed, profiles, genPrompt.prompt.provider, `disposition_${i + 1}`, project.storageFolder, project.basePhotoUrl,
      );
      const url = await saveRender(openFixed.imageBuffer, project.storageFolder, openFixed.mimeType, `disposition_${i + 1}`);
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
      requestPayload: { promptName: "iterate_generic", userRequest, prompt: iterPrompt.resolvedTemplate } },
    () => getImageProvider(iterPrompt.prompt.provider).editImage(iterPrompt.resolvedTemplate, parentImage),
  );
  console.log(`[pipeline:iterate] generation: ${Date.now() - t1}ms, ${Math.round(result.imageBuffer.length / 1024)}KB`);

  const step = `iterate_${iterCount + 1}`;
  // Une retouche peut aussi percer un mur (« ajoute de la lumière » → le modèle
  // dessine une fenêtre). Les profils de la photo d'origine font foi.
  const iterFixed = await enforceOpeningWalls(
    projectId,
    { imageBuffer: result.imageBuffer, mimeType: result.mimeType },
    (project.visionOutput ?? []) as ElementProfile[],
    iterPrompt.prompt.provider,
    step,
    project.storageFolder,
    project.basePhotoUrl,
  );
  const resultUrl = await saveRender(iterFixed.imageBuffer, project.storageFolder, iterFixed.mimeType, step);
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
    // Le verrou vaut pour le rendu COURANT (pré-itération) : si le recalcul
    // post-itération analyse un autre rendu, il reconstruira à neuf.
    lockedShoppingListRenderUrl: project.shoppingList?.length
      ? project.generatedRenderUrl
      : project.lockedShoppingListRenderUrl ?? null,
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

export function mapCompositeBoxToRender(
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

// bbox tolérante aux DEUX conventions (prompt v7+ : box_2d natif [ymin,xmin,ymax,xmax]
// 0-1000 — même échelle que anchor ; legacy : [x,y,w,h] 0-1, qui mélangeait parfois
// les échelles au sein d'une même boîte → normalisation PAR COMPOSANTE).
function parseBbox(raw: unknown, opts?: { native?: boolean }): Bbox | null {
  let vals: unknown[];
  if (Array.isArray(raw) && raw.length === 4) vals = raw;
  else if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    vals = [o.x, o.y, o.w, o.h];
  } else return null;
  const nums = vals.map(Number);
  if (nums.some((v) => !Number.isFinite(v) || v < 0)) return null;
  const norm = nums.map((v) => (v > 1.5 ? v / 1000 : v));
  if (opts?.native) {
    const [ymin, xmin, ymax, xmax] = norm;
    if (xmax <= xmin || ymax <= ymin) return null;
    return { x: xmin, y: ymin, w: xmax - xmin, h: ymax - ymin };
  }
  const [x, y, w, h] = norm;
  return { x, y, w, h };
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
  // Catégories d'ADDITIONS injectées depuis la taxonomie DB (audit #5) : l'enum
  // figée du prompt ignorait pouf/pendant_lamp/etc. → additions non shoppables.
  const additionCategories = (await getElementCategories().catch(() => []))
    .map((c) => c.slug)
    .join("|") || "other";
  const prompt = await resolvePrompt("confirm_changes", { candidatesJson, attrsInstruction, additionCategories }, { strict: false });
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
    const rr = r as { box_2d?: unknown; bbox?: unknown };
    const compBox = rr.box_2d != null ? parseBbox(rr.box_2d, { native: true }) : parseBbox(rr.bbox);
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
  // Catégories REMPLAÇABLES mais jamais AJOUTABLES (assets.element_category.replace_only) :
  // une applique murale suppose un point électrique dans le mur. Le modèle en peint parfois
  // une de plus que la photo n'en portait (projet iZp1c73T : 2 sur la photo, 3 au rendu, la
  // 3e plaquée sur une porte de placard) — sans ce verrou, elle devenait un article
  // achetable, alors qu'on ne peut ni promettre ni chiffrer le passage du courant.
  replaceOnly?: Set<string>,
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
    if (replaceOnly?.has(p.category)) continue; // remplaçable, jamais ajoutable
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
  let renderProfiles = await detectElementProfiles(projectId, renderImg, "render_inventory", { withBbox: true });
  // 0 élément sur un RENDU (toujours meublé) = détection cassée (parse flash-lite),
  // pas une pièce vide. Avalé en silence, ce zéro cascadait : 0 addition → aucune
  // ligne meuble → RIEN à swapper → le rendu expert servait le FAKE tel quel
  // (O_nmJOEf, QA Alexis 2026-07-16 : « fake = rendu réel, aucun swap »). Un retry,
  // puis échec BRUYANT — l'appelant retombe sur les additions de l'audit.
  if (renderProfiles.length === 0) {
    console.warn(`[pipeline:final] inventaire rendu VIDE — retry (détection probablement cassée)`);
    renderProfiles = await detectElementProfiles(projectId, renderImg, "render_inventory_retry", { withBbox: true });
    if (renderProfiles.length === 0) {
      throw new Error("Inventaire du rendu vide après retry — détection cassée, fallback additions audit");
    }
  }
  const categories = await getElementCategories().catch(() => [] as ElementCategory[]);
  const fixedShoppable = new Set(
    categories.filter((c) => c.fixed_lightpoint && c.catalog_category).map((c) => c.slug),
  );
  const replaceOnly = new Set(categories.filter((c) => c.replace_only).map((c) => c.slug));
  // Un meuble étranger à la pièce ne devient JAMAIS une ligne d'achat. Si le modèle a
  // laissé traîner le canapé qu'il devait retirer d'une chambre, l'inventaire le voit
  // comme une « addition » et proposerait de l'ACHETER. On ne vend pas un canapé pour
  // une chambre — le défaut reste le rendu, pas la liste.
  const etrangers = new Set(roomType ? await loadRoomRemoveCategories(roomType) : []);
  const adds = reconcileRenderAdditions(renderProfiles, candidates, taxonomy, fixedShoppable, new Set([...replaceOnly, ...etrangers]));
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

/**
 * Le rendu que l'utilisateur REGARDE — la seule base légitime de l'analyse, de la
 * liste, des pins et des quantités (directive Alexis, réaffirmée 2026-07-16 sur les
 * 2 pins de table basse : « pins et quantités doivent suivre le rendu affiché »).
 * En expert : le rendu post-swap (expertRenderUrl) dès qu'il existe — l'analyse sur
 * le FAKE décrivait des meubles que le swap avait fusionnés/remplacés. Avant le
 * swap (sélection des produits), le fake est encore le rendu affiché : correct.
 */
export function renduAffiche(project: Project): string | undefined {
  return project.mode === "expert" && project.expertRenderUrl
    ? project.expertRenderUrl
    : project.generatedRenderUrl ?? undefined;
}

function isFinalAssetsComputing(project: Project): boolean {
  return (
    project.finalAssetsRenderUrl === renduAffiche(project) &&
    !!project.finalAssetsStartedAt &&
    Date.now() - Date.parse(project.finalAssetsStartedAt) < FINAL_ASSETS_LEASE_MS
  );
}

export async function ensureFinalAssets(
  projectId: string,
  // force : recalculer même si une liste existe — utilisé après le swap expert, où la
  // liste ÉPINGLÉE est servie immédiatement mais où analyse/pins/quantités doivent
  // être refaits sur le rendu affiché (renduAffiche = expertRenderUrl).
  opts?: { skipIfComputing?: boolean; force?: boolean },
): Promise<ShoppingAssets | null> {
  const project = await getProject(projectId);
  if (!project?.generatedRenderUrl) return null;
  if (project.shoppingList && !opts?.force) {
    // AUTO-GUÉRISON : une liste sans analyse alignée sur le rendu affiché = pins
    // morts. Cas réel en PROD (zwtgBd, 2026-07-16) : le recalcul forcé post-swap
    // est un `void …` fire-and-forget — la lambda Vercel est gelée à la réponse,
    // le recalcul meurt, et ce raccourci « liste déjà là » verrouillait l'état
    // cassé pour toujours. Si l'analyse est fraîche on sert le cache ; sinon on
    // continue vers le recalcul (le polling /shopping-status répare tout seul).
    if (project.renderAnalysis?.renderUrl === renduAffiche(project)) {
      return { shoppingList: project.shoppingList, scoreFoyer: project.scoreFoyer as ScoreFoyer };
    }
    console.log("[pipeline:final] liste présente mais analyse absente/périmée → recalcul (auto-guérison)");
  }
  // Un autre process calcule déjà cette liste (bail DB frais) → les déclencheurs
  // fire-and-forget s'abstiennent au lieu de doubler le compute (et le coût).
  if (opts?.skipIfComputing && isFinalAssetsComputing(project)) {
    console.log("[pipeline:final] calcul déjà en cours (bail DB) → skip");
    return null;
  }
  const key = `${projectId}:${renduAffiche(project)}`;
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
    finalAssetsRenderUrl: renduAffiche(project),
  });
  // Réchauffe Jina pendant la phase vision (~15 s) : le cold start (~4 s) est
  // sinon payé au PREMIER embedding du matching. Fire-and-forget, sans await.
  computeTextEmbedding("warmup").catch(() => {});
  // Analyse vision : réutilisée tant que le rendu est le même (sinon recalcul + re-cache).
  let analysis = project.renderAnalysis;
  if (!analysis || analysis.renderUrl !== renduAffiche(project)) {
    analysis = await analyzeRender(projectId, project);
    // Anti-staleness : si le rendu a changé pendant l'analyse (itération), on ne
    // persiste pas — on écraserait un cache plus frais. Le résultat reste retourné
    // (l'appelant interactif regarde forcément le rendu qu'il vient de demander).
    const current = await getProject(projectId);
    if (current && renduAffiche(current) === analysis.renderUrl) {
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
  const renderUrl = renduAffiche(project) as string;
  // Remap catégorie par mot-clé de tête sur la description APRÈS (même table que la
  // détection) : ce que le rendu contient prime sur la catégorie d'origine.
  const remapTable = await getCategoryKeywordRemap();
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
      // PROMOTION D'UN GARDÉ (« Conserver » changé malgré tout) : seulement si le rendu
      // montre un AUTRE OBJET à sa place (change_kind=replaced — le canapé d'EJFyzwWG :
      // « jamais celui du fake, un de la liste ou l'original »). Un gardé simplement
      // RE-FINI (étagères repeintes en beige, 7woTi 2026-07-16) reste le meuble de
      // l'utilisateur : rien à acheter — « l'original est acceptable », la ligne
      // « à sourcer » ne faisait que du bruit.
      if (!wasCandidate && !replacedIds.has(d.element_id)) {
        return after ? { ...d, description: after } : d;
      }
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
  //
  // MAIS le verrou ne vaut QUE pour le rendu qui l'a produit (directive Alexis
  // 2026-07-16, réaffirmée : « la liste se construit sur la DERNIÈRE version du
  // rendu ») : une liste verrouillée sur un rendu antérieur décrit des objets qui
  // n'existent plus (« table basse ronde » vs rendu carré, pins joints aux mauvaises
  // bboxes — ND5qBys). Rendu différent → verrou ignoré, reconstruction complète sur
  // l'analyse fraîche ; les choix produits explicites survivent via productPicks.
  // Le verrou garde tout son rôle anti-loterie sur les recalculs du MÊME rendu.
  const lockValide =
    Boolean(project.lockedShoppingList?.length) &&
    project.lockedShoppingListRenderUrl === analysis.renderUrl;
  if (project.lockedShoppingList?.length && !lockValide) {
    console.log("[pipeline:final] verrou de liste construit sur un autre rendu → ignoré, liste reconstruite");
  }
  const releasedCategories = await mapRequestsToCategories(project.pendingReleaseRequests ?? []);
  const releasedElementIds = new Set(project.pendingReleaseElementIds ?? []);
  const { items: shoppingList, toMatchIdx } = carryOverLockedMatches(newItems, lockValide ? project.lockedShoppingList : null, releasedCategories, releasedElementIds);

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
        // UN SEUL PIN PAR POT. On en posait un par PAN peint de cette couleur : trois pans
        // du même vert donnaient trois pins identiques sur le rendu, pour une seule ligne
        // de courses (QA Alexis 2026-07-13, projet zvU9qetu). Les elementIds multiples ont
        // un sens quand ils désignent des EXEMPLAIRES à acheter (2 lampadaires = 2 pins) —
        // ici c'est le même pot appliqué à plusieurs murs.
        const pinKeys = [key, `${key}-2`, `${key}-3`, `${key}-4`].filter((k) => bboxById.has(k));
        shoppingList.push({
          ...template,
          id: key,
          // catégorie "paint" (pas "wall") + elementId = clé de la bbox du mur
          // → pin sur le mur (wall/floor/ceiling restent sans hotspot).
          category: "paint",
          elementId: pinKeys[0],
          elementIds: undefined,
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
  //
  // LE BUDGET SE LIT SUR LE PRODUIT RÉELLEMENT MATCHÉ. priceMin/priceMax viennent du
  // catalogue MOCK, vide depuis le retrait du Wizard-of-Oz : ils valent 0 sur TOUTES les
  // lignes. Le Score Foyer annonçait donc « ~0 € » au-dessus d'une liste pleine de meubles
  // chiffrés (QA Alexis 2026-07-13). Même cause pour « neuf éco » : le test portait sur
  // `merchants`, vide lui aussi — le compte tombait à zéro.
  const prixLigne = (i: ShoppingItem) => {
    const p = i.matches?.[0]?.price;
    return typeof p === "number" ? p : (i.priceMin + i.priceMax) / 2;
  };
  const achetable = (i: ShoppingItem) => (i.matches?.length ?? 0) > 0 || i.merchants.length > 0;

  const unitsWhere = (pred: (i: ShoppingItem) => boolean) =>
    shoppingList.filter(pred).reduce((s, i) => s + (i.quantity ?? 1), 0);

  // SECONDE MAIN = occasion (Emmaüs, Selency, Leboncoin…) ET reconditionné (TheBradery) :
  // deux origines fusionnées à l'affichage, mais PAS au bilan carbone (10 % du neuf contre
  // 70 %). L'origine se lit sur l'ENSEIGNE du produit matché — le catalogue ne porte qu'un
  // source_type binaire, qui ne les distingue pas.
  const origineLigne = (i: ShoppingItem): Origine =>
    origineDe(i.source, i.matches?.[0]?.merchant ?? i.merchants[0]?.name);

  const shUnits = unitsWhere((i) => achetable(i) && origineLigne(i) !== "neuf");
  const ecoNewUnits = unitsWhere((i) => achetable(i) && origineLigne(i) === "neuf");

  // Bilan carbone : kg CO₂e réels par catégorie (ADEME), pas un compte d'objets — la
  // formule précédente (`conservés × 30 + occasion × 20 + neuf × 5`) faisait « économiser »
  // du CO₂ à chaque achat NEUF, et donnait le même poids à une armoire et à un coussin.
  const bilan = bilanCo2(
    built.score.keptCategories ?? [],
    shoppingList
      .filter(achetable)
      .map((i) => ({ category: i.category, quantity: i.quantity ?? 1, origine: origineLigne(i) })),
  );

  const scoreFoyer: ScoreFoyer = {
    kept: built.score.kept,
    keptLabels: built.score.keptLabels,
    secondhand: shUnits,
    ecoNew: ecoNewUnits,
    co2SavedKg: bilan.eviteKg,
    co2EmittedKg: bilan.emisKg,
    totalEstimated: Math.round(
      shoppingList.reduce((s, i) => s + prixLigne(i) * (i.quantity ?? 1), 0),
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
  if (current && renduAffiche(current) === analysis.renderUrl) {
    // Le verrou est rafraîchi sur ce que le user va VOIR ; les demandes d'itération
    // en attente sont consommées (les catégories relâchées viennent d'être rejouées).
    await updateProject(projectId, {
      shoppingList: finalList, scoreFoyer, builtShoppingList: built,
      lockedShoppingList: finalList, lockedShoppingListRenderUrl: analysis.renderUrl,
      pendingReleaseRequests: [], pendingReleaseElementIds: [],
    });
  } else {
    console.log("[pipeline:final] rendu changé pendant le matching → liste non persistée (stale)");
  }
  console.log(`[pipeline:final] (matching) ${finalList.length} items scorés`);
  return { shoppingList: finalList, scoreFoyer };
}
