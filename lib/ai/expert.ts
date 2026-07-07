import { getProject, updateProject } from "@/lib/storage/projects";
import { fetchImageBytes } from "@/lib/ai/pipeline";
import { saveRender } from "@/lib/ai/saveRender";
import type { RoomType, ShoppingItem } from "@/lib/types";

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
// On N'IMPOSE PAS le placement (Gemini agence très bien seul, testé) : on lui donne
// juste une contrainte de containment (le seul vrai levier — sans elle, il posait
// le meuble TV à cheval sur un mur).
function furnishPrompt(pieces: Piece[], roomType: RoomType): string {
  const room = ROOM_LABEL[roomType] ?? "room";
  const list = pieces.map((p, i) => `the ${p.noun} in image ${i + 2}`).join(", ");
  return (
    `This is a photo of a REAL EMPTY ${room}. Furnish it realistically by ADDING these ` +
    `furniture products — EXACTLY ONE of each — using each product's exact appearance from its ` +
    `reference image and IGNORING the reference backgrounds: ${list}. Arrange them the way a ` +
    `professional interior stylist would, in a comfortable balanced layout, at correct ` +
    `real-world scale with natural contact shadows. EVERY piece must rest fully inside the room, ` +
    `flat on the floor and flush against a wall where appropriate — NO piece may overlap, cross ` +
    `or pass through a wall, doorway, window or alcove edge, and none may float or be clipped by ` +
    `the frame. Keep the room's ARCHITECTURE and fixed elements EXACTLY as photographed: walls, ` +
    `wall recesses/alcoves, windows, curtains, doors, radiators, the floor, the ceiling and ` +
    `light fixtures, and the SAME camera angle and framing. Do NOT add, remove, move or alter ` +
    `any wall, window, door or opening, and do NOT add any furniture or decor that is not in the ` +
    `reference images. Preserve the EXACT lighting, exposure, white balance and colors of the ` +
    `input photo — do not brighten, wash out or over-expose the scene. Photorealistic.`
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

/**
 * Pipeline rendu EXPERT (vider → meubler) : on part de la PHOTO DE BASE (pas du
 * rendu fictif), on la vide de son mobilier amovible en conservant l'architecture
 * et les éléments non remplacés (rideaux, parquet…), puis on la meuble avec les
 * VRAIS gros meubles matchés du catalogue, en un seul appel (image de référence +
 * prompt minimal). Partir du vide élimine par construction le bug du meuble fictif
 * conservé/dupliqué. Nécessite un projet avec photo de base + liste shopping matchée.
 */
export async function runExpertRenderPipeline(projectId: string): Promise<string> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (!project.basePhotoUrl) throw new Error("Pas de photo de base — recommencez la création.");

  const shoppingList = (project.shoppingList ?? []) as ShoppingItem[];
  const pieces = selectExpertPieces(shoppingList);
  if (pieces.length === 0) {
    throw new Error("Aucun gros meuble matché dans la liste shopping.");
  }
  console.log(
    `[expert] ${projectId} : ${pieces.length} meubles → ${pieces.map((p) => p.category).join(", ")}`,
  );

  const shellUrl = await ensureEmptyShell(projectId);
  const { buffer, mimeType } = await furnishRoom(shellUrl, pieces, project.roomType);
  const url = await saveRender(buffer, project.storageFolder, mimeType, "expert");
  await updateProject(projectId, { expertRenderUrl: url });
  console.log(`[expert] ${projectId} : rendu expert sauvegardé`);
  return url;
}

export { EXPERT_CATEGORIES, selectExpertPieces };
