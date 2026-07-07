import { getProject, updateProject } from "@/lib/storage/projects";
import { fetchImageBytes } from "@/lib/ai/pipeline";
import { saveRender } from "@/lib/ai/saveRender";
import type { RoomType, ShoppingItem } from "@/lib/types";
import type { ElementDecision } from "@/lib/diy/types";

// ── Gros meubles à intégrer au rendu expert ─────────────────────────────────
// V1 : SEULEMENT les gros éléments principaux. Exclus volontairement : déco,
// peinture, sol, luminaires, coussins, plantes, cadres, rideaux, poufs.
// L'ordre = priorité (les plus structurants d'abord) si on doit plafonner.
const EXPERT_CATEGORIES = [
  "sofa",
  "armchair",
  "coffee_table",
  "dining_table",
  "side_table",
  "rug",
  "tv_stand",
  "sideboard",
  "bookshelf",
  "dresser",
  "bed",
  "nightstand",
  "bench",
] as const;

// Nom lisible injecté dans le prompt (le modèle doit savoir QUEL meuble ajouter,
// sans qu'on décrive sa forme — l'image de référence s'en charge).
const CATEGORY_NOUN: Record<string, string> = {
  sofa: "sofa",
  armchair: "armchair",
  coffee_table: "coffee table",
  dining_table: "dining table",
  side_table: "side table",
  rug: "rug",
  tv_stand: "TV stand",
  sideboard: "sideboard",
  bookshelf: "bookshelf",
  dresser: "chest of drawers",
  bed: "bed",
  nightstand: "nightstand",
  bench: "bench",
};

// Type de pièce → libellé anglais pour le prompt (le modèle agence mieux s'il sait
// quelle pièce il meuble).
const ROOM_LABEL: Record<string, string> = {
  salon: "living room",
  chambre: "bedroom",
  chambre_parentale: "bedroom",
};

// On plafonne le nombre de références envoyées à NB2 (au-delà, il peut saturer).
const MAX_PIECES = 8;

type Piece = { category: string; noun: string; imageUrl: string; name: string };

/** Sélectionne les gros meubles matchés (image produit dispo), par priorité. */
function selectExpertPieces(shoppingList: ShoppingItem[]): Piece[] {
  const priority = new Map(EXPERT_CATEGORIES.map((c, i) => [c as string, i]));
  return shoppingList
    .map((it) => {
      const cat = it.category;
      const noun = CATEGORY_NOUN[cat];
      const match = it.matches?.[0];
      const imageUrl = match?.primary_image_url;
      if (!noun || !imageUrl) return null;
      return { category: cat, noun, imageUrl, name: match?.name ?? it.name, _p: priority.get(cat) ?? 99 };
    })
    .filter((x): x is Piece & { _p: number } => x !== null)
    // dédup par catégorie (une ligne par type de meuble)
    .filter((x, i, arr) => arr.findIndex((y) => y.category === x.category) === i)
    .sort((a, b) => a._p - b._p)
    .slice(0, MAX_PIECES)
    .map(({ category, noun, imageUrl, name }) => ({ category, noun, imageUrl, name }));
}

async function toDataUri(url: string): Promise<string> {
  // Rendu (supabase) ou image produit (externe) → bytes → data-URI (fal a des
  // soucis intermittents à télécharger certaines URLs, le data-URI les évite).
  const buf = url.startsWith("/") || url.includes("supabase")
    ? await fetchImageBytes(url)
    : Buffer.from(await (await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } })).arrayBuffer());
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

const FAL_ENDPOINT = "https://fal.run/fal-ai/nano-banana-2/edit";

async function callNb2(prompt: string, imageUris: string[]): Promise<{ buffer: Buffer; mimeType: string }> {
  const key = process.env.FAL_API_KEY;
  if (!key) throw new Error("FAL_API_KEY manquant");

  const res = await fetch(FAL_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, image_urls: imageUris, num_images: 1 }),
  });
  const json = (await res.json()) as { images?: { url: string }[]; detail?: unknown };
  if (!res.ok) {
    throw new Error(`fal nano-banana-2 ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  const outUrl = json.images?.[0]?.url;
  if (!outUrl) throw new Error("fal nano-banana-2: pas d'image renvoyée");

  const out = await fetch(outUrl);
  const mimeType = out.headers.get("content-type")?.split(";")[0] ?? "image/png";
  return { buffer: Buffer.from(await out.arrayBuffer()), mimeType };
}

// ── Étape 1 : vider la pièce ────────────────────────────────────────────────
// La photo de base n'est PAS toujours vide (annonces déjà meublées / staging).
// On retire tout le mobilier amovible mais on conserve l'architecture et les
// éléments non remplacés (murs + couleur, alcôves, moulures, fenêtres, RIDEAUX,
// portes, radiateurs, PARQUET, plafond + luminaires). Résultat = coquille nue.
const EMPTY_PROMPT =
  `Remove ALL movable furniture and freestanding objects from this room — every sofa, ` +
  `armchair, chair, table, bed, rug, shelf, bookcase, sideboard, dresser, lamp, plant, ` +
  `framed art, mirror, cushion, book and decorative item — to reveal the room COMPLETELY ` +
  `EMPTY, as if photographed before anyone moved in. Keep the ARCHITECTURE and permanent ` +
  `elements EXACTLY as they are: the walls and their exact paint colors, wall recesses and ` +
  `alcoves, mouldings, windows, curtains, doors, radiators, the floor, the ceiling and any ` +
  `ceiling-mounted light fixture, and the SAME camera angle and framing. Do not change wall ` +
  `color, do not add anything, do not alter the exposure. Photorealistic empty room.`;

async function emptyRoom(photoUrl: string): Promise<{ buffer: Buffer; mimeType: string }> {
  return callNb2(EMPTY_PROMPT, [await toDataUri(photoUrl)]);
}

// ── Étape 2 : meubler avec les vrais produits ───────────────────────────────
// Recette validée : image de référence + prompt MINIMAL (ne jamais décrire la
// forme d'un meuble — le texte écrase l'image). On mappe chaque produit à son
// image, on impose "exactement un de chaque", on fige l'architecture et l'expo.
// On N'IMPOSE PAS de placement rigide par meuble (Gemini agence très bien seul),
// mais on lui donne des RÈGLES FONCTIONNELLES : sans elles, il posait le meuble TV
// à cheval sur une porte, ou le canapé devant une ouverture, ou rien face à la TV.
// Testé 5 tirages/5 acceptables avec ces règles (vs cas inacceptables sans).
function furnishPrompt(pieces: Piece[], roomType: RoomType): string {
  const room = ROOM_LABEL[roomType] ?? "room";
  const list = pieces.map((p, i) => `the ${p.noun} in image ${i + 2}`).join(", ");
  return (
    `This is a photo of a REAL EMPTY ${room}. Furnish it realistically by ADDING these ` +
    `furniture products — EXACTLY ONE of each — using each product's exact appearance from its ` +
    `reference image and IGNORING the reference backgrounds: ${list}. Arrange them like a ` +
    `professional interior stylist into a FUNCTIONAL ${room} layout, at correct real-world scale ` +
    `with natural contact shadows.\n` +
    `FUNCTIONAL RULES (critical):\n` +
    `1. Keep EVERY door, doorway and open passage to another room completely clear and visible — ` +
    `NEVER place any furniture in front of, across or covering a door, doorway or open passage, ` +
    `and never block circulation.\n` +
    `2. If a TV / TV stand is included, stand it against a SOLID wall segment that has NO door and ` +
    `NO window on it — never over a door, doorway or window (a shallow wall recess facing the ` +
    `seating is fine).\n` +
    `3. Arrange the main seating (sofa, armchair) to FACE the focal point — the TV if there is ` +
    `one — forming a conversation area around the rug and coffee table (coffee table on the rug ` +
    `between the seating and the TV).\n` +
    `4. Push the large pieces (sofa, TV stand, bookshelf, bed) back flush against walls, keeping ` +
    `the centre and all passages open.\n` +
    `Every piece must rest fully inside the room, flat on the floor — NO piece may overlap, cross ` +
    `or pass through a wall, door, window or opening, and none may float or be clipped by the ` +
    `frame. Keep the room's ARCHITECTURE and fixed elements EXACTLY as photographed (walls, wall ` +
    `recesses/alcoves, doors, windows, curtains, radiators, the floor, the ceiling and light ` +
    `fixtures) and the SAME camera angle and framing. Do NOT add, remove, move or alter any wall, ` +
    `window, door or opening, and do NOT add any furniture or decor not in the references. ` +
    `Preserve the EXACT lighting, exposure, white balance and colors of the input photo — do not ` +
    `brighten, wash out or over-expose the scene. Photorealistic.`
  );
}

async function furnishRoom(
  shellUrl: string,
  pieces: Piece[],
  roomType: RoomType,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const [shellUri, ...refUris] = await Promise.all([
    toDataUri(shellUrl),
    ...pieces.map((p) => toDataUri(p.imageUrl)),
  ]);
  return callNb2(furnishPrompt(pieces, roomType), [shellUri, ...refUris]);
}

/**
 * Coquille vide de la pièce, mise en cache. La photo de base ne changeant jamais,
 * on ne la re-vide pas à chaque régénération du rendu expert.
 */
export async function ensureEmptyShell(projectId: string): Promise<string> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (project.emptyShellUrl) return project.emptyShellUrl;
  if (!project.basePhotoUrl) throw new Error("Pas de photo de base.");

  const { buffer, mimeType } = await emptyRoom(project.basePhotoUrl);
  const url = await saveRender(buffer, project.storageFolder, mimeType, "empty");
  await updateProject(projectId, { emptyShellUrl: url });
  console.log(`[expert] ${projectId} : coquille vide générée`);
  return url;
}

// ── Édition SÉLECTIVE pilotée par element_decisions ─────────────────────────
// Le vrai modèle : chaque meuble détecté a une action DIY (element_decisions).
//   mismatch_type "none" → KEEP (on le retrouve tel quel)
//   mismatch_type "surface" → CUSTOMIZE (on applique action_label : peindre, teinter…)
//   mismatch_type "structural" → REPLACE (on le swap par le vrai produit matché)
// On édite la PHOTO DE BASE en un seul appel : on ne touche QUE les pièces listées,
// tout le reste (déco, plantes, lampes, agencement, architecture) est conservé.
// C'est du sélectif par élément → l'user retrouve ses meubles gardés/customisés.

// mismatch_type → action haut niveau (identique au flux standard, ACTION_OF).
const MISMATCH_TO_ACTION: Record<ElementDecision["mismatch_type"], "keep" | "customize" | "replace"> = {
  none: "keep",
  surface: "customize",
  structural: "replace",
};

// Catégories qu'on NE customise PAS en v1 (peinture/sol/architecture hors scope —
// v1 = gros meubles). Une customisation sur ces catégories est ignorée (laissée telle
// quelle), le scope peinture/sol viendra plus tard.
const CUSTOMIZE_EXCLUDE = new Set([
  "wall", "floor", "ceiling", "window", "door", "curtain", "stairs", "radiator", "fireplace",
]);

// Détection meublé vs vide : catégories NON meublées (architecture/surfaces). S'il
// existe au moins un élément meublé détecté → pièce meublée → édition sélective ;
// sinon → pièce vide → on vide (no-op) puis on meuble avec les produits.
const NON_FURNITURE = new Set([
  "wall", "floor", "ceiling", "window", "door", "curtain", "stairs", "radiator", "fireplace",
]);

type ReplaceItem = { noun: string; description: string; imageUrl: string };
type CustomizeItem = { noun: string; description: string; instruction: string };
type ExpertPlan = { replace: ReplaceItem[]; customize: CustomizeItem[]; hasFurniture: boolean };

/** Image du vrai produit matché pour un élément à remplacer (via son element_id). */
function productImageForElement(elementId: string, shoppingList: ShoppingItem[]): string | null {
  const it = shoppingList.find(
    (i) => i.elementId === elementId && i.source !== "diy" && (i.matches?.[0]?.primary_image_url || i.imgUrl),
  );
  return it ? (it.matches?.[0]?.primary_image_url ?? it.imgUrl ?? null) : null;
}

/** Construit le plan d'édition (replace/customize) à partir des décisions. */
function buildExpertPlan(decisions: ElementDecision[], shoppingList: ShoppingItem[]): ExpertPlan {
  const replace: ReplaceItem[] = [];
  const customize: CustomizeItem[] = [];
  let hasFurniture = false;

  for (const d of decisions) {
    if (!NON_FURNITURE.has(d.category)) hasFurniture = true;
    const action = MISMATCH_TO_ACTION[d.mismatch_type];
    const noun = CATEGORY_NOUN[d.category] ?? d.category.replace(/_/g, " ");
    const description = d.description ?? "";

    if (action === "replace") {
      // v1 : on ne remplace que les gros meubles (on a des produits catalogue).
      if (!EXPERT_CATEGORIES.includes(d.category as (typeof EXPERT_CATEGORIES)[number])) continue;
      const imageUrl = productImageForElement(d.element_id, shoppingList);
      if (imageUrl) replace.push({ noun, description, imageUrl });
    } else if (action === "customize") {
      // Customisation d'un meuble existant : on applique la consigne DIY (action_label)
      // telle quelle. Hors scope : peinture murale, sol, architecture (v1).
      if (CUSTOMIZE_EXCLUDE.has(d.category)) continue;
      if (!d.action_label) continue;
      customize.push({ noun, description, instruction: d.action_label });
    }
    // keep : rien à faire, "keep everything else" s'en charge.
  }
  return { replace, customize, hasFurniture };
}

/** Prompt d'édition sélective : on ne touche QUE replace + customize, on garde le reste. */
function selectiveEditPrompt(plan: ExpertPlan, roomType: RoomType, refBase: number): string {
  const room = ROOM_LABEL[roomType] ?? "room";
  const blocks: string[] = [
    `This photo shows a real furnished ${room}. Make ONLY the changes listed below and keep ` +
      `ABSOLUTELY EVERYTHING ELSE identical to the original photo — every other piece of furniture, ` +
      `all decor, plants, artwork, lamps, rugs, the wall colors, the floor, windows, doors, ceiling, ` +
      `lighting, and the exact same layout and camera framing.`,
  ];
  if (plan.replace.length) {
    blocks.push(
      `REPLACE these existing pieces — swap each with its catalog product shown in the given image ` +
        `(use the product's EXACT appearance, IGNORE its reference background), keeping the SAME ` +
        `position, footprint, size and orientation as the piece it replaces; keep EXACTLY ONE of each ` +
        `and remove the old one:\n` +
        plan.replace
          .map((r, i) => `- the existing ${r.noun}${r.description ? ` (${r.description})` : ""} → image ${refBase + i}`)
          .join("\n"),
    );
  }
  if (plan.customize.length) {
    blocks.push(
      `CUSTOMIZE these existing pieces IN PLACE — keep their EXACT shape, size, position and ` +
        `orientation, and change ONLY what each instruction says:\n` +
        plan.customize
          .map((c) => `- the ${c.noun}${c.description ? ` (${c.description})` : ""}: ${c.instruction}`)
          .join("\n"),
    );
  }
  blocks.push(
    `Do not add or remove any furniture or decor other than the replacements above. Preserve the ` +
      `EXACT lighting, exposure, white balance and colors of the original photo. Photorealistic, ` +
      `natural contact shadows.`,
  );
  return blocks.join("\n\n");
}

/** Édition sélective de la photo de base (replace en place + customize). */
async function selectiveEdit(
  basePhotoUrl: string,
  plan: ExpertPlan,
  roomType: RoomType,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const refBase = 2; // image 1 = photo de base ; les produits replace commencent à 2
  const prompt = selectiveEditPrompt(plan, roomType, refBase);
  const [baseUri, ...refUris] = await Promise.all([
    toDataUri(basePhotoUrl),
    ...plan.replace.map((r) => toDataUri(r.imageUrl)),
  ]);
  return callNb2(prompt, [baseUri, ...refUris]);
}

/**
 * Pipeline rendu EXPERT — piloté par element_decisions (keep/customize/replace).
 * • Pièce MEUBLÉE (des meubles détectés) → édition SÉLECTIVE de la photo de base :
 *   on remplace les meubles `replace` par les vrais produits, on customise les
 *   `customize` (action_label DIY appliquée verbatim), et on GARDE tout le reste
 *   (les `keep`, la déco, l'agencement). L'user retrouve ses meubles conservés.
 * • Pièce VIDE (aucun meuble détecté) → on vide (no-op) puis on meuble avec les
 *   produits matchés (fallback vider→meubler).
 * Un seul appel NB2 dans les deux cas.
 */
export async function runExpertRenderPipeline(projectId: string): Promise<string> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (!project.basePhotoUrl) throw new Error("Pas de photo de base — recommencez la création.");

  const shoppingList = (project.shoppingList ?? []) as ShoppingItem[];
  const decisions = (project.element_decisions ?? []) as ElementDecision[];
  const plan = buildExpertPlan(decisions, shoppingList);

  let result: { buffer: Buffer; mimeType: string };

  if (plan.hasFurniture) {
    // Pièce meublée → édition sélective sur la photo de base.
    if (plan.replace.length === 0 && plan.customize.length === 0) {
      throw new Error("Aucun gros meuble à remplacer ou customiser.");
    }
    console.log(
      `[expert] ${projectId} : sélectif — ${plan.replace.length} replace, ${plan.customize.length} customize`,
    );
    result = await selectiveEdit(project.basePhotoUrl, plan, project.roomType);
  } else {
    // Pièce vide → vider (no-op sur photo déjà vide) puis meubler avec les produits.
    const pieces = selectExpertPieces(shoppingList);
    if (pieces.length === 0) {
      throw new Error("Aucun gros meuble matché dans la liste shopping.");
    }
    console.log(
      `[expert] ${projectId} : vide→meubler — ${pieces.length} meubles (${pieces.map((p) => p.category).join(", ")})`,
    );
    const shellUrl = await ensureEmptyShell(projectId);
    result = await furnishRoom(shellUrl, pieces, project.roomType);
  }

  const url = await saveRender(result.buffer, project.storageFolder, result.mimeType, "expert");
  await updateProject(projectId, { expertRenderUrl: url });
  console.log(`[expert] ${projectId} : rendu expert sauvegardé`);
  return url;
}

/**
 * Itération EXPERT (sol / peinture) : on édite le RENDU RÉEL (expertRenderUrl),
 * pas le rendu fictif. On applique UNIQUEMENT la demande user (ex. « sol en
 * parquet chêne clair », « murs bleu canard ») en préservant tout le reste
 * (meubles intégrés, agencement, architecture). Self-contained : ne touche pas
 * au matching du rendu fictif. Sol/peinture sont hors-scope du rendu expert
 * (CUSTOMIZE_EXCLUDE) → c'est ICI qu'on les applique, par-dessus.
 */
export async function runExpertIteration(projectId: string, userRequest: string): Promise<string> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  const parentUrl = project.expertRenderUrl;
  if (!parentUrl) throw new Error("Pas de rendu expert à affiner.");

  const prompt =
    `Apply ONLY the following change to this room photo: ${userRequest}. ` +
    `Keep EVERYTHING ELSE exactly as it is — all furniture and its exact positions, all decor, ` +
    `the layout, the windows, doors, ceiling, lighting, and the SAME camera angle and framing. ` +
    `Only change what the request explicitly asks (e.g. the floor or the wall paint). Preserve the ` +
    `exact perspective and a photorealistic look with natural lighting and contact shadows.`;

  const { buffer, mimeType } = await callNb2(prompt, [await toDataUri(parentUrl)]);
  const n = (project.iterationCount ?? 0) + 1;
  const url = await saveRender(buffer, project.storageFolder, mimeType, `iterate_${n}`);
  await updateProject(projectId, { expertRenderUrl: url, iterationCount: n });
  console.log(`[expert] ${projectId} : itération expert #${n} sauvegardée`);
  return url;
}

export { EXPERT_CATEGORIES, selectExpertPieces };
