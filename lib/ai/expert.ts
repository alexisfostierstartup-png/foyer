import { getProject, updateProject } from "@/lib/storage/projects";
import { fetchImageBytes } from "@/lib/ai/pipeline";
import { saveRender } from "@/lib/ai/saveRender";
import type { ShoppingItem } from "@/lib/types";

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

// Nom lisible injecté dans le prompt (le modèle doit savoir QUEL meuble remplacer,
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

/** Appel NB2 (Gemini 3.x edit) via fal : base + N images produit → rendu swappé. */
async function nb2Edit(baseUrl: string, pieces: Piece[]): Promise<{ buffer: Buffer; mimeType: string }> {
  const key = process.env.FAL_API_KEY;
  if (!key) throw new Error("FAL_API_KEY manquant");

  const [baseUri, ...refUris] = await Promise.all([
    toDataUri(baseUrl),
    ...pieces.map((p) => toDataUri(p.imageUrl)),
  ]);

  // Prompt MINIMAL de mapping cible→image (JAMAIS décrire la forme : l'image gagne).
  const mapping = pieces
    .map((p, i) => `the ${p.noun} with the furniture in image ${i + 2}`)
    .join(", ");
  const prompt =
    `In this room, replace ${mapping}. Keep everything else in the room exactly the same ` +
    `(walls, window, door, floor, lighting and the same camera framing). Photorealistic.`;

  const res = await fetch("https://fal.run/fal-ai/nano-banana-2/edit", {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, image_urls: [baseUri, ...refUris], num_images: 1 }),
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

/**
 * Pipeline rendu EXPERT : reprend la disposition choisie (generatedRenderUrl) et
 * remplace les GROS meubles par les vrais produits matchés du catalogue, en un
 * seul appel NB2 (recette validée : image de référence + prompt minimal).
 * Nécessite un projet avec un rendu + une liste shopping matchée.
 */
export async function runExpertRenderPipeline(projectId: string): Promise<string> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  const baseUrl = project.generatedRenderUrl;
  if (!baseUrl) throw new Error("Pas de rendu de base — lancez d'abord une génération.");

  const shoppingList = (project.shoppingList ?? []) as ShoppingItem[];
  const pieces = selectExpertPieces(shoppingList);
  if (pieces.length === 0) {
    throw new Error("Aucun gros meuble matché dans la liste shopping.");
  }
  console.log(
    `[expert] ${projectId} : ${pieces.length} meubles → ${pieces.map((p) => p.category).join(", ")}`,
  );

  const { buffer, mimeType } = await nb2Edit(baseUrl, pieces);
  const url = await saveRender(buffer, project.storageFolder, mimeType, "expert");
  await updateProject(projectId, { expertRenderUrl: url });
  console.log(`[expert] ${projectId} : rendu expert sauvegardé`);
  return url;
}

export { EXPERT_CATEGORIES, selectExpertPieces };
