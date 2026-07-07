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
 */
function selectExpertPieces(
  shoppingList: ShoppingItem[],
  overrides: Record<string, number> = {},
): Piece[] {
  const priority = new Map(EXPERT_CATEGORIES.map((c, i) => [c as string, i]));
  return shoppingList
    .map((it) => {
      const cat = it.category;
      if (it.source === "diy" || !isReplaceableFurniture(cat)) return null;
      const noun = CATEGORY_NOUN[cat] ?? cat.replace(/_/g, " ");
      const idx = (it.elementId && overrides[it.elementId]) || 0;
      const match = it.matches?.[idx] ?? it.matches?.[0];
      const imageUrl = match?.primary_image_url ?? it.imgUrl;
      if (!imageUrl) return null;
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

type ReplaceItem = { noun: string; description: string; imageUrl: string; count: number };
type CustomizeItem = { noun: string; description: string; instruction: string };
// Restyle = modif STYLÉE non-meuble (mur repeint, luminaire changé, sol, textile,
// déco) décidée à la review → appliquée en TEXTE (pas de produit) pour que le rendu
// réel retrouve le style du fake (sinon ces éléments reviennent à la photo de base).
type RestyleItem = { noun: string; instruction: string };
type ExpertPlan = {
  replace: ReplaceItem[];
  customize: CustomizeItem[];
  restyle: RestyleItem[];
  hasFurniture: boolean;
};

/**
 * Image du vrai produit matché pour un élément à remplacer.
 * 1) via son element_id ; 2) fallback même CATÉGORIE (ex. 4 chaises identiques →
 * 1 seule ligne shopping `chair_1` → sert pour chaque chaise).
 * `overrides[elementId]` = index du produit ALTERNATIF choisi (défaut 0 = meilleur).
 */
function productImageForElement(
  elementId: string,
  category: string,
  shoppingList: ShoppingItem[],
  overrides: Record<string, number>,
): string | null {
  const hasImg = (i: ShoppingItem) =>
    i.source !== "diy" && (i.matches?.[0]?.primary_image_url || i.imgUrl);
  const it =
    shoppingList.find((i) => i.elementId === elementId && hasImg(i)) ??
    shoppingList.find((i) => i.category === category && hasImg(i));
  if (!it) return null;
  const idx = (it.elementId && overrides[it.elementId]) || 0;
  const chosen = it.matches?.[idx] ?? it.matches?.[0];
  return chosen?.primary_image_url ?? it.imgUrl ?? null;
}

/** Construit le plan d'édition (replace/customize) à partir des décisions. */
function buildExpertPlan(
  decisions: ElementDecision[],
  shoppingList: ShoppingItem[],
  overrides: Record<string, number>,
): ExpertPlan {
  const replace: ReplaceItem[] = [];
  const customize: CustomizeItem[] = [];
  const restyle: RestyleItem[] = [];
  let hasFurniture = false;

  for (const d of decisions) {
    if (!NON_FURNITURE.has(d.category)) hasFurniture = true;
    const action = MISMATCH_TO_ACTION[d.mismatch_type];
    if (action === "keep") continue; // gardé → "keep everything else" s'en charge.
    const noun = CATEGORY_NOUN[d.category] ?? d.category.replace(/_/g, " ");
    const description = d.description ?? "";

    if (isReplaceableFurniture(d.category)) {
      // MEUBLE : replace = vrai produit ; customize = consigne DIY (teinter, retapisser…).
      if (action === "replace") {
        const imageUrl = productImageForElement(d.element_id, d.category, shoppingList, overrides);
        if (imageUrl) replace.push({ noun, description, imageUrl, count: 1 });
        // pas de produit → on ne touche pas (le meuble existant est conservé).
      } else if (d.action_label) {
        customize.push({ noun, description, instruction: d.action_label });
      }
    } else if (d.action_label && !/garder|conserver|^keep/i.test(d.action_label)) {
      // NON-meuble modifié (mur, luminaire, sol, textile, déco) : on applique la consigne
      // stylée en texte → le rendu réel retrouve le style du fake (mur repeint, pendant…).
      restyle.push({ noun, instruction: d.action_label });
    }
  }

  // Dédup : plusieurs éléments identiques (ex. 4 chaises → même produit) → 1 seule
  // entrée ×N, pour ne pas envoyer 4 fois la même image ni décrire 4 fois la pièce.
  const merged: ReplaceItem[] = [];
  for (const r of replace) {
    const ex = merged.find((m) => m.imageUrl === r.imageUrl);
    if (ex) ex.count += 1;
    else merged.push({ ...r });
  }
  return { replace: merged, customize, restyle, hasFurniture };
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
        `position, footprint, size, orientation and COUNT as the piece(s) it replaces, and remove ` +
        `the old one(s):\n` +
        plan.replace
          .map((r, i) =>
            r.count > 1
              ? `- ALL ${r.count} ${r.noun}s → image ${refBase + i} (replace every one of them with this same product model, keep the same number)`
              : `- the existing ${r.noun}${r.description ? ` (${r.description})` : ""} → image ${refBase + i}`,
          )
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
): Promise<{ buffer: Buffer; mimeType: string }> {
  const room = ROOM_LABEL[roomType] ?? "room";
  // Pluriel-safe : une catégorie peut représenter plusieurs pièces identiques (ex.
  // 4 chaises) → on demande de remplacer CHAQUE pièce de ce type par le même produit.
  const mapping = pieces.map((p, i) => `every ${p.noun} → image ${i + 2}`).join(", ");
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
  const [fakeUri, ...refUris] = await Promise.all([
    toDataUri(fakeUrl),
    ...pieces.map((p) => toDataUri(p.imageUrl)),
  ]);
  return callNb2(prompt, [fakeUri, ...refUris]);
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
  const pieces = selectExpertPieces(shoppingList, overrides);
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
  const { buffer, mimeType } = await swapOnFake(project.generatedRenderUrl, pieces, project.roomType);

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
