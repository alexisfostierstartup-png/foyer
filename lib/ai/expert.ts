import { getProject, updateProject } from "@/lib/storage/projects";
import { fetchImageBytes } from "@/lib/ai/pipeline";
import { saveRender } from "@/lib/ai/saveRender";
import { enforceExpertIntegratedPieces } from "@/lib/shopping/integratedPieces";
import type { RoomType, ShoppingItem, CustomProduct, ExpertIntegratedPiece, ProductMatch } from "@/lib/types";

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
  // Suspensions/plafonniers en dernier (swap le plus délicat — point plafond fixe).
  "ceiling_light",
  "pendant_lamp",
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
  ceiling_light: "ceiling pendant light",
  pendant_lamp: "ceiling pendant light",
  chandelier: "ceiling pendant light",
};

// Ce qu'on NE remplace PAS par un produit catalogue dans le rendu (v1) : petite
// déco, textile, luminaires, architecture/fixes. Approche BLOCKLIST (extensible :
// tout meuble non listé ici EST remplaçable — pas de whitelist à faire grossir).
const NON_REPLACEABLE = new Set([
  // déco / accessoires
  "cushion", "pillow", "throw", "frame", "artwork", "art", "painting", "poster", "mirror",
  "plant", "vase", "book", "books", "decor", "decoration", "tableware", "clock", "candle",
  // luminaires NON swappés : lampes mobiles et appliques. Les SUSPENSIONS/plafonniers
  // (ceiling_light/pendant) sont swappés depuis 2026-07-10 (go Alexis) — le produit
  // exact de la liste remplace la suspension du rendu, au même point.
  "lamp", "floor_lamp", "table_lamp", "wall_light", "wall_sconce", "sconce", "light",
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

type Piece = {
  category: string;
  noun: string;
  imageUrl: string;
  name: string;
  // Traçabilité pour la liste de courses autoritaire : élément source + produit exact.
  elementId?: string | null;
  match?: ProductMatch | null;
  // Description de l'élément SOURCE dans le rendu (localisateur) : désambiguïse le
  // mapping quand deux meubles proches coexistent (la table d'appoint BORGEBY avait
  // remplacé la table basse CENTRALE, projet CVp7yLGh).
  sourceDesc?: string | null;
};

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
  // element_ids des décisions REPLACE (structural) : SEULES pièces swappables.
  // Décision Alexis 2026-07-10 : le swap ne touche QUE ce que le plan a remplacé —
  // les keep/customize du user sont sacrés, et les ADDITIONS du fake restent
  // telles quelles (la BORGEBY qui se posait à côté de la table conservée = la
  // violation type). null = pas de restriction (rétro-compat tests).
  replaceIds: Set<string> | null = null,
): Piece[] {
  const priority = new Map(EXPERT_CATEGORIES.map((c, i) => [c as string, i]));
  const pieces = shoppingList
    .map((it) => {
      const cat = it.category;
      if (it.source === "diy" || !isReplaceableFurniture(cat)) return null;
      if (replaceIds && (!it.elementId || !replaceIds.has(it.elementId))) return null;
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
        elementId: (it.elementId ?? null) as string | null,
        match: (cp ? null : match ?? null) as ProductMatch | null,
        sourceDesc: (it.name?.trim() || null) as string | null,
        _p: priority.get(cat) ?? 99,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    // dédup par catégorie (une ligne par type de meuble)
    .filter((x, i, arr) => arr.findIndex((y) => y.category === x.category) === i);

  // Produits custom visant une CATÉGORIE absente de la liste (choisis dès l'upload) :
  // on les ajoute comme pièces (la clé est une catégorie connue, pas un elementId).
  for (const [key, cp] of Object.entries(customProducts)) {
    if (!cp?.imageUrl || !CATEGORY_NOUN[key] || !isReplaceableFurniture(key)) continue;
    if (pieces.some((p) => p.category === key)) continue;
    pieces.push({ category: key, noun: CATEGORY_NOUN[key], imageUrl: cp.imageUrl, name: cp.name ?? CATEGORY_NOUN[key], elementId: null, match: null, sourceDesc: null, _p: priority.get(key) ?? 99 });
  }

  return pieces
    .sort((a, b) => a._p - b._p)
    .slice(0, MAX_PIECES)
    .map(({ category, noun, imageUrl, name, elementId, match, sourceDesc }) => ({ category, noun, imageUrl, name, elementId, match, sourceDesc }));
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

// Ratio NB2 le plus proche des dimensions source — sans lui, NB2 rend dans SON
// ratio par défaut et INVENTE du plafond/du sol pour remplir (« plafond plus haut
// que la réalité », feedback Alexis 2026-07-10 projet 7JDbe).
const NB2_RATIOS: [string, number][] = [
  ["21:9", 21 / 9], ["16:9", 16 / 9], ["3:2", 3 / 2], ["4:3", 4 / 3], ["5:4", 5 / 4],
  ["1:1", 1], ["4:5", 4 / 5], ["3:4", 3 / 4], ["2:3", 2 / 3], ["9:16", 9 / 16],
];
function closestNb2Ratio(width: number, height: number): string {
  const r = width / height;
  return NB2_RATIOS.reduce((best, cur) => (Math.abs(cur[1] - r) < Math.abs(best[1] - r) ? cur : best))[0];
}

async function callNb2(prompt: string, imageUris: string[], aspectRatio?: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const key = process.env.FAL_API_KEY;
  if (!key) throw new Error("FAL_API_KEY manquant");

  const res = await fetch(FAL_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, image_urls: imageUris, num_images: 1, ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}) }),
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
// NB2 sature au-delà de ~3 produits de référence : les grosses pièces sont swappées,
// les petites (pouf, chaise, banc) sont ignorées (bench 2026-07-09, 3/3 sessions).
// → le swap se fait par PASSES CHAÎNÉES de 3 produits max, chaque passe éditant la
// sortie de la précédente (+1 appel NB2 ≈ $0.08 au-delà de 3 pièces).
const SWAP_CHUNK_SIZE = 3;

async function swapOnFake(
  fakeUrl: string,
  pieces: Piece[],
  roomType: RoomType,
): Promise<{ buffer: Buffer; mimeType: string; integrated: Piece[] } | null> {
  const room = ROOM_LABEL[roomType] ?? "room";
  // On VALIDE chaque image produit ; on ne garde que les vraies images (anti-garbage).
  const fakeBytes = await fetchImageBytes(fakeUrl);
  const fakeUri = `data:image/jpeg;base64,${fakeBytes.toString("base64")}`;
  // Ratio de sortie VERROUILLÉ sur le fake : sans lui NB2 rend dans son ratio par
  // défaut et invente du plafond pour remplir (perspective déformée).
  const sharp = (await import("sharp")).default;
  const meta = await sharp(fakeBytes).metadata();
  const aspectRatio = meta.width && meta.height ? closestNb2Ratio(meta.width, meta.height) : undefined;
  const validated: { p: Piece; uri: string }[] = [];
  for (const p of pieces) {
    const uri = await toValidProductUri(p.imageUrl);
    if (uri) validated.push({ p, uri });
    else console.warn(`[expert] image produit injoignable, meuble ignoré: ${p.category} ${p.imageUrl.slice(0, 80)}`);
  }
  if (validated.length === 0) return null; // aucune image valide → on ne rend rien (fallback = fake)

  // Passes chaînées de SWAP_CHUNK_SIZE produits.
  let currentUri = fakeUri;
  let last: { buffer: Buffer; mimeType: string } | null = null;
  for (let i = 0; i < validated.length; i += SWAP_CHUNK_SIZE) {
    const chunk = validated.slice(i, i + SWAP_CHUNK_SIZE);
    last = await swapChunk(currentUri, chunk, room, aspectRatio);
    currentUri = `data:${last.mimeType};base64,${last.buffer.toString("base64")}`;
  }
  return { ...last!, integrated: validated.map((v) => v.p) };
}

async function swapChunk(
  baseUri: string,
  validated: { p: Piece; uri: string }[],
  room: string,
  aspectRatio?: string,
): Promise<{ buffer: Buffer; mimeType: string }> {

  // Pluriel-safe : une catégorie peut représenter plusieurs pièces identiques (ex.
  // 4 chaises) → on demande de remplacer CHAQUE pièce de ce type par le même produit.
  // Localisateur par pièce (« the sofa — currently: … ») : identifie SANS ambiguïté
  // QUEL meuble remplacer quand plusieurs sont proches ; l'apparence cible vient
  // toujours de l'image de référence, jamais de cette description.
  const mapping = validated
    .map((v, i) => `every ${v.p.noun}${v.p.sourceDesc ? ` (currently: "${v.p.sourceDesc.slice(0, 60)}")` : ""} → image ${i + 2}`)
    .join(", ");
  const prompt =
    `This is a beautifully styled photo of a ${room}. YOUR TASK — MANDATORY: replace EACH listed ` +
    `piece of furniture with its real catalog product — but ONLY pieces actually VISIBLE in this ` +
    `photo: if a listed piece does not exist in the photo, SKIP it and add NOTHING for it (never ` +
    `insert a product into an empty spot). A listed piece VISIBLE but left UNCHANGED is a FAILURE; ` +
    `a listed piece replaced by a LOOKALIKE instead of the product's EXACT appearance (shape, ` +
    `colour, materials, details) from its reference image is a FAILURE. IGNORE the reference ` +
    `backgrounds. Place each product at the SAME position and orientation as the piece it ` +
    `replaces, at its REAL-WORLD size — respect the product's true nature and scale (a side ` +
    `table stays a small side table ~40-50 cm, never enlarged into a coffee or dining table; ` +
    `a pouf stays pouf-sized) — and ALWAYS at the product's TRUE proportions and shape from ` +
    `its reference image: NEVER stretch, widen, squash, enlarge or distort a product to ` +
    `fill the old piece's footprint (if the old piece was bigger, leave breathing room instead). ` +
    `When several identical pieces of the same type exist ` +
    `(e.g. dining chairs or bar stools), replace EVERY ONE of them with that same product, keep ` +
    `the same count AND the same natural arrangement: chairs stay tucked at their table, seats ` +
    `FACING the table — never scattered or turned away from it; remove the old pieces: ${mapping}. Keep EVERYTHING ELSE strictly identical to ` +
    `this photo — do NOT change, re-tint, restyle, move OR REMOVE anything other than the furniture ` +
    `listed above. In particular, KEEP every other furniture piece exactly where it is AND exactly ` +
    `as it looks — a repainted or customized piece keeps its EXACT paint colour and finish from this ` +
    `photo, pixel-faithful — even next ` +
    `to a replaced one (e.g. if you replace the bar stools, KEEP the bar/high table they surround; ` +
    `if you replace dining chairs, KEEP the dining table). Also keep unchanged: all wall art and ` +
    `frames, mirrors, lamps and light fixtures, plants, vases, cushions, books, tableware and small ` +
    `decor, the curtains, the wall colors and finishes, the ceiling, the window, the floor, and the ` +
    `entire styling, lighting and camera framing. Preserve the exact exposure and white balance. ` +
    `STRICT RULES — violating any of these ruins the result: add NOTHING that is not in this photo ` +
    `or in the product list above (no extra furniture, lamp, plant or decor); NEVER add, duplicate ` +
    `or move a ceiling or wall light fixture; every MIRROR shows a plausible reflection of THIS very ` +
    `room only — never an object that does not exist in the room, never a duplicated fixture in the ` +
    `reflection; rooms and spaces visible through open doors or wall openings stay EXACTLY as in this ` +
    `photo (do not furnish or restyle them); each replaced piece touches the floor with natural ` +
    `contact shadows — no floating objects, no object intersecting another. Photorealistic.`;
  return callNb2(prompt, [baseUri, ...validated.map((v) => v.uri)], aspectRatio);
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
  const replaceIds = new Set(
    (project.element_decisions ?? [])
      .filter((d) => d.mismatch_type === "structural")
      .map((d) => d.element_id),
  );
  // CATÉGORIES PROTÉGÉES : le user GARDE ou CUSTOMISE un meuble de cette catégorie
  // → le swap n'y touche pas du tout. Le ciblage texte de NB2 ne sait pas viser un
  // objet précis quand deux semblables coexistent (la ligne ex-bar_table recatégorisée
  // coffee_table a fait remplacer la table basse CONSERVÉE, projet CVp7yLGh).
  const protectedCats = new Set(
    (project.element_decisions ?? [])
      .filter((d) => d.mismatch_type === "none" || d.mismatch_type === "surface")
      .map((d) => d.category),
  );
  const swappable = shoppingList.filter((it) => !protectedCats.has(it.category));
  const pieces = selectExpertPieces(swappable, overrides, customProducts, replaceIds);
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
  const { buffer, mimeType, integrated } = result;

  const url = await saveRender(buffer, project.storageFolder, mimeType, "expert");
  // Source de vérité de la liste de courses pour les meubles intégrés : ce qui est
  // DANS le rendu fait foi. Persisté ici, ré-injecté dans toute liste recalculée
  // (enforceExpertIntegratedPieces) — un meuble visible dans le rendu ne peut plus
  // disparaître de la liste, quel que soit le re-gating vision du fake.
  const integratedPieces: ExpertIntegratedPiece[] = integrated.map((p) => ({
    category: p.category,
    name: p.name,
    imageUrl: p.imageUrl,
    elementId: p.elementId ?? null,
    match: p.match ?? null,
  }));
  // La liste courante est aussi mise à jour immédiatement (pin du produit exact).
  const pinnedList = enforceExpertIntegratedPieces(
    (project.shoppingList ?? []) as ShoppingItem[],
    integratedPieces,
  );
  await updateProject(projectId, {
    expertRenderUrl: url,
    expertIntegratedPieces: integratedPieces,
    shoppingList: pinnedList,
  });
  console.log(`[expert] ${projectId} : rendu expert sauvegardé, ${integratedPieces.length} produit(s) épinglés dans la liste`);
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
    `exact perspective and a photorealistic look with natural lighting and contact shadows. ` +
    `STRICT RULES: add NOTHING new to the scene; never add, duplicate or move a light fixture; ` +
    `mirrors reflect THIS room only (never an object absent from the room); spaces seen through ` +
    `doors or openings stay exactly as they are.`;

  const { buffer, mimeType } = await callNb2(prompt, [await toDataUri(parentUrl)]);
  const n = (project.iterationCount ?? 0) + 1;
  const url = await saveRender(buffer, project.storageFolder, mimeType, `iterate_${n}`);
  await updateProject(projectId, { expertRenderUrl: url, iterationCount: n });
  console.log(`[expert] ${projectId} : itération expert #${n} sauvegardée`);
  return url;
}

export { selectExpertPieces };
