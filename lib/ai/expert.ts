import { getProject, updateProject } from "@/lib/storage/projects";
import { fetchImageBytes } from "@/lib/ai/pipeline";
import { saveRender } from "@/lib/ai/saveRender";
import type { RoomType, ShoppingItem, CustomProduct } from "@/lib/types";

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
  chair: "chair",
  dining_chair: "dining chair",
  bar_table: "bar table",
  bar_stool: "bar stool",
  stool: "stool",
  ottoman: "ottoman",
  pouf: "pouf",
  desk: "desk",
  console_table: "console table",
  console: "console table",
  cabinet: "cabinet",
  wardrobe: "wardrobe",
  chest: "chest of drawers",
  tv: "TV",
  buffet: "sideboard",
};

// Ce qu'on NE remplace PAS par un produit catalogue dans le rendu (v1) : petite
// déco, textile, luminaires, architecture/fixes. Approche BLOCKLIST (extensible :
// tout meuble non listé ici EST remplaçable — pas de whitelist à faire grossir).
const NON_REPLACEABLE = new Set([
  // déco / accessoires
  "cushion", "pillow", "throw", "frame", "artwork", "art", "painting", "poster", "mirror",
  "plant", "vase", "book", "books", "decor", "decoration", "tableware", "clock", "candle",
  // luminaires
  "lamp", "floor_lamp", "table_lamp", "ceiling_light", "pendant", "pendant_lamp", "wall_light",
  "sconce", "chandelier", "light",
  // textile / ouvertures souples
  "curtains", "curtain", "blinds", "drapes",
  // architecture / éléments fixes
  "wall", "floor", "ceiling", "window", "door", "radiator", "stairs", "staircase", "fireplace",
  "beam", "column", "pillar", "heater", "water_heater", "molding", "moulding",
]);

/** Un élément est-il un MEUBLE remplaçable par un vrai produit ? (tout sauf blocklist) */
function isReplaceableFurniture(category: string): boolean {
  return !NON_REPLACEABLE.has(category);
}

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

/**
 * Sélectionne les gros meubles matchés (image produit dispo), par priorité.
 * `overrides[elementId]` = produit alternatif choisi (défaut 0) — « liste alternative ».
 * `customProducts[elementId|category]` = produit SUR-MESURE de l'user (URL/JPEG) →
 * prioritaire sur le matching ; s'il vise une catégorie absente de la liste (choix à
 * l'upload), on l'ajoute comme pièce à part entière.
 */
function selectExpertPieces(
  shoppingList: ShoppingItem[],
  overrides: Record<string, number> = {},
  customProducts: Record<string, CustomProduct> = {},
): Piece[] {
  const priority = new Map(EXPERT_CATEGORIES.map((c, i) => [c as string, i]));
  const pieces = shoppingList
    .map((it) => {
      const cat = it.category;
      if (it.source === "diy" || !isReplaceableFurniture(cat)) return null;
      const noun = CATEGORY_NOUN[cat] ?? cat.replace(/_/g, " ");
      // Priorité au produit custom de l'user (par elementId puis par catégorie).
      const cp = (it.elementId ? customProducts[it.elementId] : undefined) ?? customProducts[cat];
      const idx = (it.elementId && overrides[it.elementId]) || 0;
      const match = it.matches?.[idx] ?? it.matches?.[0];
      const imageUrl = cp?.imageUrl ?? match?.primary_image_url ?? it.imgUrl;
      if (!imageUrl) return null;
      return {
        category: cat,
        noun,
        imageUrl,
        name: cp?.name ?? match?.name ?? it.name,
        _p: priority.get(cat) ?? 99,
      };
    })
    .filter((x): x is Piece & { _p: number } => x !== null)
    // dédup par catégorie (une ligne par type de meuble)
    .filter((x, i, arr) => arr.findIndex((y) => y.category === x.category) === i);

  // Produits custom visant une CATÉGORIE absente de la liste (choisis dès l'upload) :
  // on les ajoute comme pièces (la clé est une catégorie connue, pas un elementId).
  for (const [key, cp] of Object.entries(customProducts)) {
    if (!cp?.imageUrl || !CATEGORY_NOUN[key] || !isReplaceableFurniture(key)) continue;
    if (pieces.some((p) => p.category === key)) continue;
    pieces.push({ category: key, noun: CATEGORY_NOUN[key], imageUrl: cp.imageUrl, name: cp.name ?? CATEGORY_NOUN[key], _p: priority.get(key) ?? 99 });
  }

  return pieces
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

/** Vrais octets d'image ? (magic bytes JPEG/PNG/WEBP/GIF) — garde-fou anti-garbage. */
function looksLikeImage(b: Buffer): boolean {
  if (b.length < 512) return false;
  if (b[0] === 0xff && b[1] === 0xd8) return true; // jpeg
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true; // png
  if (b.slice(0, 4).toString("ascii") === "RIFF" && b.slice(8, 12).toString("ascii") === "WEBP") return true; // webp
  if (b.slice(0, 3).toString("ascii") === "GIF") return true; // gif
  return false;
}

/**
 * Image produit → data-URI, MAIS null si on n'arrive pas à récupérer une VRAIE image.
 * Anti-hallucination : jamais de garbage envoyé à NB2 (le user peut coller 1000+ sites).
 */
async function toValidProductUri(url: string): Promise<string | null> {
  try {
    let buf: Buffer;
    let ct = "";
    if (url.startsWith("/") || url.includes("supabase")) {
      buf = await fetchImageBytes(url);
    } else {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15_000);
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) return null;
      ct = r.headers.get("content-type") ?? "";
      buf = Buffer.from(await r.arrayBuffer());
    }
    if (!(ct.startsWith("image/") || looksLikeImage(buf))) return null;
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
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

// ── Swap sur le rendu fictif (garde tout le style, remplace les gros meubles) ─
// On part du rendu fictif — qui porte tout le style validé (murs, luminaires, déco,
// customisations telles que le fake les a rendues) — et on n'y remplace QUE les
// GROS meubles par les vrais produits. Le reste est conservé À L'IDENTIQUE.
// Philosophie : RÉEL pour les grosses pièces (dures à trouver, chères) ; le style et
// la petite déco (vase, cadre, vaisselle) restent ceux du fake → rendu vendeur.
async function swapOnFake(
  fakeUrl: string,
  pieces: Piece[],
  roomType: RoomType,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const room = ROOM_LABEL[roomType] ?? "room";
  // On VALIDE chaque image produit ; on ne garde que les vraies images (anti-garbage).
  const fakeUri = await toDataUri(fakeUrl);
  const validated: { p: Piece; uri: string }[] = [];
  for (const p of pieces) {
    const uri = await toValidProductUri(p.imageUrl);
    if (uri) validated.push({ p, uri });
    else console.warn(`[expert] image produit injoignable, meuble ignoré: ${p.category} ${p.imageUrl.slice(0, 80)}`);
  }
  if (validated.length === 0) return null; // aucune image valide → on ne rend rien (fallback = fake)

  // Pluriel-safe : une catégorie peut représenter plusieurs pièces identiques (ex.
  // 4 chaises) → on demande de remplacer CHAQUE pièce de ce type par le même produit.
  const mapping = validated.map((v, i) => `every ${v.p.noun} → image ${i + 2}`).join(", ");
  const prompt =
    `This is a beautifully styled photo of a ${room}. Replace ONLY the large furniture with its ` +
    `matching real catalog product, using each product's EXACT appearance from its reference image ` +
    `(IGNORE the reference backgrounds), keeping each at the EXACT same position, footprint, size ` +
    `and orientation as the piece it replaces. When several identical pieces of the same type exist ` +
    `(e.g. dining chairs or bar stools), replace EVERY ONE of them with that same product and keep ` +
    `the same count; remove the old pieces: ${mapping}. Keep EVERYTHING ELSE strictly identical to ` +
    `this photo — do NOT change, re-tint, restyle, move OR REMOVE anything other than the furniture ` +
    `listed above. In particular, KEEP every other furniture piece exactly where it is, even next ` +
    `to a replaced one (e.g. if you replace the bar stools, KEEP the bar/high table they surround; ` +
    `if you replace dining chairs, KEEP the dining table). Also keep unchanged: all wall art and ` +
    `frames, mirrors, lamps and light fixtures, plants, vases, cushions, books, tableware and small ` +
    `decor, the curtains, the wall colors and finishes, the ceiling, the window, the floor, and the ` +
    `entire styling, lighting and camera framing. Preserve the exact exposure and white balance. ` +
    `Photorealistic.`;
  return callNb2(prompt, [fakeUri, ...validated.map((v) => v.uri)]);
}

/**
 * Pipeline rendu EXPERT — UNIFIÉ « swap sur le fake » (pièce vide ET meublée).
 * On part du RENDU FICTIF (qui porte déjà tout le style validé : murs repeints,
 * luminaires changés, déco, customisations telles que le fake les a rendues) et on
 * n'y remplace QUE les gros meubles par les VRAIS produits matchés. Le reste du fake
 * est conservé À L'IDENTIQUE → le rendu réel = le fake, avec les vrais meubles.
 * Principe clé : le rendu réel SUIT le fake (pas les décisions brutes) — si le fake a
 * choisi de ne pas re-teinter un meuble, on le garde tel quel. Un seul appel NB2.
 * (Remplace l'ancien « édition sélective sur photo de base + consignes texte » qui
 * divergeait du fake et perdait son style.)
 */
export async function runExpertRenderPipeline(projectId: string): Promise<string> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (!project.generatedRenderUrl) {
    throw new Error("Pas de rendu de base — lancez d'abord une génération.");
  }

  const shoppingList = (project.shoppingList ?? []) as ShoppingItem[];
  const overrides = (project.productOverrides ?? {}) as Record<string, number>;
  const customProducts = (project.customProducts ?? {}) as Record<string, CustomProduct>;
  const pieces = selectExpertPieces(shoppingList, overrides, customProducts);
  if (pieces.length === 0) {
    // Rien à remplacer (tous les meubles gardés, pièce déjà bien meublée) → le rendu
    // réel = le fake tel quel (pas de 400 : c'est un résultat légitime).
    console.log(`[expert] ${projectId} : aucun gros meuble à swapper → rendu réel = fake`);
    await updateProject(projectId, { expertRenderUrl: project.generatedRenderUrl });
    return project.generatedRenderUrl;
  }

  console.log(
    `[expert] ${projectId} : swap-sur-fake — ${pieces.length} meubles (${pieces.map((p) => p.category).join(", ")})`,
  );
  const result = await swapOnFake(project.generatedRenderUrl, pieces, project.roomType);
  if (!result) {
    // Aucune image produit valide → on NE génère PAS (anti-hallucination) : rendu = fake.
    console.warn(`[expert] ${projectId} : aucune image produit valide → rendu réel = fake`);
    await updateProject(projectId, { expertRenderUrl: project.generatedRenderUrl });
    return project.generatedRenderUrl;
  }
  const { buffer, mimeType } = result;

  const url = await saveRender(buffer, project.storageFolder, mimeType, "expert");
  await updateProject(projectId, { expertRenderUrl: url });
  console.log(`[expert] ${projectId} : rendu expert sauvegardé`);
  return url;
}

/**
 * Itération EXPERT (sol / peinture) : on édite le RENDU RÉEL (expertRenderUrl),
 * pas le rendu fictif. On applique UNIQUEMENT la demande user (ex. « sol en
 * parquet chêne clair », « murs bleu canard ») en préservant tout le reste
 * (meubles intégrés, agencement, architecture). Self-contained : ne touche pas
 * au matching du rendu fictif. Le sol/la peinture ne font pas partie du swap
 * expert → c'est ICI qu'on les applique, par-dessus.
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

export { selectExpertPieces };
