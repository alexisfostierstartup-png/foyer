import { getProject, updateProject } from "@/lib/storage/projects";
import { fetchImageBytes, computeRenderAdditions, buildBeforeAfterComposite, confirmChanges, mapCompositeBoxToRender } from "@/lib/ai/pipeline";
import { saveRender } from "@/lib/ai/saveRender";
import { enforceExpertIntegratedPieces } from "@/lib/shopping/integratedPieces";
import { matchAlterationsToCatalog } from "@/lib/shopping/matcher";
import { matchPartnerProductsBlendBatch, matchFloorProductsBlend } from "@/lib/shopping/partnerMatch";
import { getChangedWallColors, matchPaintByColor, type WallColor } from "@/lib/shopping/paintMatch";
import { extractCrop } from "@/lib/shopping/crop";
import { getElementCategories } from "@/lib/db/assets";
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
  // Luminaires MOBILES : swap simple (aucun point électrique à respecter).
  "floor_lamp",
  "table_lamp",
  // Luminaires FIXES en dernier (swap le plus délicat — point plafond/mur imposé).
  "ceiling_light",
  "pendant_lamp",
  "wall_sconce",
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
  // Luminaires sortis de la blocklist 2026-07-11 : sans ce libellé, selectExpertPieces
  // les retenait mais le prompt les nommait « floor lamp » via le fallback slug — ici on
  // fixe le nom exact, et l'apparence vient toujours de l'image de référence.
  floor_lamp: "floor lamp",
  table_lamp: "table lamp",
  lamp: "lamp",
  wall_sconce: "wall sconce",
  wall_light: "wall sconce",
};

// Ce qu'on NE remplace PAS par un produit catalogue dans le rendu (v1) : petite
// déco, textile, luminaires, architecture/fixes. Approche BLOCKLIST (extensible :
// tout meuble non listé ici EST remplaçable — pas de whitelist à faire grossir).
const NON_REPLACEABLE = new Set([
  // déco / accessoires : trop petits ou trop nombreux pour un swap fiable, et le style
  // les met en scène très bien lui-même. Périmètre confirmé par Alexis (2026-07-11) :
  // plaid, coussins, vases, miroir, petite déco restent hors swap.
  "cushion", "pillow", "throw", "frame", "artwork", "art", "painting", "poster", "mirror",
  "plant", "vase", "book", "books", "decor", "decoration", "tableware", "clock", "candle",
  // LUMINAIRES : plus aucun n'est bloqué (go Alexis 2026-07-11 — les suspensions
  // l'avaient été le 2026-07-10, on aligne le reste). Un lampadaire / une lampe à poser
  // / une applique de la liste remplace donc bien celui du rendu. Les luminaires FIXES
  // (applique, plafonnier) sont swappés AU MÊME POINT électrique — garde-fou dans le
  // prompt de swap, jamais un second luminaire ajouté.
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
  chambre_enfant: "child's bedroom",
  salle_a_manger: "dining room",
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
  // elementId → ID du produit choisi. FAIT FOI sur `overrides` (un indice), qui
  // dérive dès que `matches` est réordonné. `overrides` reste le repli des projets
  // créés avant productPicks.
  picks: Record<string, string> = {},
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
      // 1) l'ID choisi (stable) ; 2) l'indice hérité (fragile) ; 3) le meilleur match.
      const pickedId = it.elementId ? picks[it.elementId] : undefined;
      const byId = pickedId ? it.matches?.find((m) => m.id === pickedId) : undefined;
      const idx = (it.elementId && overrides[it.elementId]) || 0;
      const match = byId ?? it.matches?.[idx] ?? it.matches?.[0];
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

async function callNb2(
  prompt: string,
  imageUris: string[],
  aspectRatio?: string,
  // Résolution de sortie : "0.5K" | "1K" (défaut API) | "2K" | "4K".
  // On NE la force PAS dans le parcours normal : la dégradation ne vient pas d'un manque
  // de pixels mais du fait que chaque passe RE-GÉNÈRE l'image. Monter en résolution
  // n'agrandirait que la bouillie, en facturant plus cher (2K = 0,12 $, 4K = 0,16 $
  // contre 0,08 $). Le vrai levier est le NOMBRE de passes.
  // Seul le téléchargement HD la force (4K) : là, le projet est fini, l'utilisateur le
  // demande explicitement, et l'image produite ne remplace PAS le rendu du projet.
  resolution?: "0.5K" | "1K" | "2K" | "4K",
): Promise<{ buffer: Buffer; mimeType: string }> {
  const key = process.env.FAL_API_KEY;
  if (!key) throw new Error("FAL_API_KEY manquant");

  const res = await fetch(FAL_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      image_urls: imageUris,
      num_images: 1,
      // output_format png : sans lui, une sortie JPEG rajouterait une compression
      // par-dessus la perte générative, à chaque tour. Gratuit, donc pris.
      output_format: "png",
      ...(resolution ? { resolution } : {}),
      ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
    }),
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
// UNE SEULE PASSE. Le swap découpait en paquets de 3 — une valeur de DÉPART des tests
// d'Alexis, jamais mesurée, et coûteuse : 8 meubles = 3 générations = 3 × 0,08 $, et
// surtout 3 re-générations empilées de l'image entière.
//
// Bench du 2026-07-12 (scripts/bench-swap-chunk.ts), même base et mêmes 8 produits :
//   paquets de 3 → 3 passes, 0,24 $, 50 s — les 6 produits posables sont là, MAIS les
//                  couleurs ont dérivé (murs saturés, canapé bouclé BLANC devenu beige,
//                  console modifiée) : chaque passe re-rend toute la scène et l'éloigne.
//   paquets de 8 → 1 passe,  0,08 $, 20 s — mêmes 6 produits, couleurs FIDÈLES au fictif
//                  et au produit, image nette.
// Le découpage était donc pire sur tous les axes. L'API accepte 14 images en entrée ;
// la limite supposée du modèle n'existait pas.
const SWAP_CHUNK_SIZE = MAX_PIECES;

export async function swapOnFake(
  fakeUrl: string,
  pieces: Piece[],
  roomType: RoomType,
  // Paramétrable pour le bench : le plafond de 3 vient d'un bench du 2026-07-09 et
  // n'a jamais été revérifié depuis, alors qu'il coûte 3 passes (3 × 0,08 $) et
  // 3 générations de dégradation pour 8 meubles. cf. scripts/bench-swap-chunk.ts
  chunkSize: number = SWAP_CHUNK_SIZE,
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
  for (let i = 0; i < validated.length; i += chunkSize) {
    const chunk = validated.slice(i, i + chunkSize);
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
    `if you replace dining chairs, KEEP the dining table). Also keep unchanged — EXCEPT any piece ` +
    `explicitly listed above, which MUST be replaced: all wall art and ` +
    `frames, mirrors, lamps and light fixtures, plants, vases, cushions, books, tableware and small ` +
    `decor, the curtains, the wall colors and finishes, the ceiling, the window, the floor, and the ` +
    `entire styling, lighting and camera framing. Preserve the exact exposure and white balance. ` +
    `STRICT RULES — violating any of these ruins the result: add NOTHING that is not in this photo ` +
    `or in the product list above (no extra furniture, lamp, plant or decor); NEVER add, duplicate ` +
    `or move a ceiling or wall light fixture — the ONE allowed change is swapping a LISTED pendant or ` +
    `wall sconce for its product AT THE SAME electrical point (same count of fixtures, same ceiling/wall ` +
    `point, never a second one, never relocated). A LISTED floor or table lamp is swapped in place, ` +
    `standing exactly where the old one stood, at its real-world height; ` +
    `every MIRROR shows a plausible reflection of THIS very ` +
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
  // Pièces que le swap a le droit de toucher :
  //  1. les REPLACE du plan (décision structural) ;
  //  2. les ADDITIONS du rendu — meubles que le fake a CRÉÉS (bibliothèque, suspension) :
  //     ils n'ont aucune décision, donc `replaceIds` seul les excluait et ils restaient
  //     des objets inventés, impossibles à acheter (QA Alexis 2026-07-11). Ils sont par
  //     construction VISIBLES dans le fake (ils viennent de son inventaire vision) → le
  //     garde-fou anti-BORGEBY (« si la pièce n'est pas sur la photo, n'ajoute RIEN »)
  //     vit dans le prompt de swap, pas ici.
  // Les KEEP/CUSTOMIZE restent intouchables via `protectedCats` ci-dessous.
  const decisionIds = new Set((project.element_decisions ?? []).map((d) => d.element_id));
  const replaceIds = new Set(
    (project.element_decisions ?? [])
      .filter((d) => d.mismatch_type === "structural")
      .map((d) => d.element_id),
  );
  for (const it of shoppingList) {
    if (it.elementId && !decisionIds.has(it.elementId) && it.source !== "diy") {
      replaceIds.add(it.elementId);
    }
  }
  // CATÉGORIES PROTÉGÉES : le user GARDE ou CUSTOMISE un meuble de cette catégorie
  // → le swap n'y touche pas du tout. Le ciblage texte de NB2 ne sait pas viser un
  // objet précis quand deux semblables coexistent (la ligne ex-bar_table recatégorisée
  // coffee_table a fait remplacer la table basse CONSERVÉE, projet CVp7yLGh).
  const protectedCats = new Set(
    (project.element_decisions ?? [])
      .filter((d) => d.mismatch_type === "none" || d.mismatch_type === "surface")
      .map((d) => d.category),
  );
  // CHOIX EXPLICITE DU USER : « Choisir un produit précis » sur un élément écrase
  // la protection ET le gating replaceIds. Le user s'est contredit (il avait dit
  // « je customise »), on le suit : hiérarchie user > DIY > colorway.
  // Sans ça, l'override était lu par selectExpertPieces APRÈS ce filtre, sur une
  // liste dont l'élément avait déjà disparu → le choix partait à la poubelle sans
  // le moindre log (meuble TV du projet 51NekyJs0Qt, QA Alexis 2026-07-11).
  const userPicked = new Set<string>([...Object.keys(overrides), ...Object.keys(customProducts)]);
  const swappable = shoppingList.filter(
    (it) => !protectedCats.has(it.category) || (it.elementId != null && userPicked.has(it.elementId)),
  );
  for (const id of userPicked) replaceIds.add(id);
  const picks = (project.productPicks ?? {}) as Record<string, string>;
  const allPieces = selectExpertPieces(swappable, overrides, customProducts, replaceIds, picks);

  // BASE DU SWAP. Par défaut le fake : il porte le style validé, et repartir de lui
  // à chaque fois évite d'empiler les éditions (dégradation de l'image).
  // MAIS si le rendu expert a été ITÉRÉ, il contient des meubles que le fake n'a
  // jamais eus (« ajoute une table et des chaises »). Repartir du fake les EFFACE :
  // c'est ce qui a fait disparaître table et chaises au clic sur « Nouveau rendu »,
  // alors que la base de données les gardait — image et liste se contredisaient
  // (QA Alexis 2026-07-12). Dans ce cas, on swappe sur le rendu expert courant.
  const surRenduItere = Boolean(project.expertIterated && project.expertRenderUrl);
  const base = surRenduItere ? project.expertRenderUrl! : project.generatedRenderUrl;

  // NE RE-SWAPPER QUE CE QUI A CHANGÉ — c'est LE levier contre la dégradation.
  //
  // Chaque passe NB2 RE-GÉNÈRE l'image entière : la perte est générative, pas une
  // question de pixels (monter en résolution ne ferait qu'agrandir la bouillie). Ce qui
  // compte, c'est le NOMBRE de passes. Or le swap se fait par paquets de 3 produits :
  // re-swapper les 8 meubles = 3 générations, à CHAQUE « Nouveau rendu », même si
  // l'utilisateur n'a changé qu'un seul produit.
  //
  // Tant qu'on repartait du fake, la profondeur restait constante (toujours 3 passes
  // depuis une base propre). Depuis qu'on part du rendu ITÉRÉ — pour ne pas effacer les
  // meubles ajoutés — ces 3 passes s'EMPILENT sur une image déjà générée, et la perte se
  // cumule sans fin (QA Alexis 2026-07-12). Sur un rendu itéré, on ne repose donc que les
  // meubles dont le produit diffère de celui DÉJÀ dans l'image : changer un produit coûte
  // 1 passe au lieu de 3, et n'en changer aucun n'en coûte aucune.
  const signature = (p: { match?: ProductMatch | null; imageUrl?: string }) =>
    p.match?.id ?? p.imageUrl ?? null;
  const dejaDansLimage = new Map(
    (project.expertIntegratedPieces ?? []).map((p) => [p.elementId ?? p.category, signature(p)]),
  );
  const pieces = surRenduItere
    ? allPieces.filter((p) => {
        const cle = p.elementId ?? p.category;
        return !dejaDansLimage.has(cle) || dejaDansLimage.get(cle) !== signature(p);
      })
    : allPieces;

  if (pieces.length === 0) {
    // Soit rien à remplacer, soit — sur un rendu itéré — rien qui ait changé : dans les
    // deux cas, régénérer ne ferait que dégrader l'image pour un résultat identique.
    console.log(`[expert] ${projectId} : rien de nouveau à swapper → rendu inchangé (0 génération)`);
    await updateProject(projectId, { expertRenderUrl: base });
    return base;
  }

  console.log(
    `[expert] ${projectId} : swap sur ${surRenduItere ? "le rendu expert ITÉRÉ" : "le fake"} — ` +
      `${pieces.length}/${allPieces.length} meubles (${pieces.map((p) => p.category).join(", ")}) ` +
      `→ ${Math.ceil(pieces.length / SWAP_CHUNK_SIZE)} génération(s)`,
  );
  const result = await swapOnFake(base, pieces, project.roomType);
  if (!result) {
    // Aucune image produit valide → on NE génère PAS (anti-hallucination) : on garde la base.
    console.warn(`[expert] ${projectId} : aucune image produit valide → rendu réel = base`);
    await updateProject(projectId, { expertRenderUrl: base });
    return base;
  }
  const { buffer, mimeType, integrated } = result;

  const url = await saveRender(buffer, project.storageFolder, mimeType, "expert");
  // Source de vérité de la liste de courses pour les meubles intégrés : ce qui est
  // DANS le rendu fait foi. Persisté ici, ré-injecté dans toute liste recalculée
  // (enforceExpertIntegratedPieces) — un meuble visible dans le rendu ne peut plus
  // disparaître de la liste, quel que soit le re-gating vision du fake.
  const reposees: ExpertIntegratedPiece[] = integrated.map((p) => ({
    category: p.category,
    name: p.name,
    imageUrl: p.imageUrl,
    elementId: p.elementId ?? null,
    match: p.match ?? null,
    // La bbox d'une pièce déjà présente est conservée (cf. fusion juste après) : seule
    // une pièce reposée perd la sienne, et l'analyse la retrouvera.
    bbox: null,
  }));

  // FUSION, jamais remplacement. Le swap peut être PARTIEL (on ne repose que ce qui a
  // changé) : écraser la liste avec les seules pièces reposées effacerait toutes les
  // autres, pourtant bien présentes dans l'image. On remplace celles qu'on vient de
  // reposer, on garde les autres telles quelles — avec leur position.
  const parCle = new Map<string, ExpertIntegratedPiece>(
    (project.expertIntegratedPieces ?? []).map((p) => [p.elementId ?? p.category, p]),
  );
  for (const p of reposees) {
    const cle = p.elementId ?? p.category;
    parCle.set(cle, { ...p, bbox: parCle.get(cle)?.bbox ?? null });
  }
  const integratedPieces = [...parCle.values()];

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
  console.log(
    `[expert] ${projectId} : rendu sauvegardé — ${reposees.length} produit(s) reposé(s), ${integratedPieces.length} au total dans l'image`,
  );
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
// Architecture pure : jamais un « achat », donc jamais une addition à matcher.
const NON_DETECTABLE = new Set(["ceiling", "door", "french_door", "window", "wall_opening"]);

/**
 * Referme la boucle après une itération EXPERT qui a AJOUTÉ du mobilier
 * (« ajoute une table et des chaises à manger »).
 *
 * Sans ça, les meubles ajoutés n'existent QUE dans les pixels : absents de la
 * liste de courses (donc invendables) et absents d'expertIntegratedPieces (donc
 * éternellement fictifs). La route /iterate ne recalculait rien en mode expert —
 * choix légitime tant qu'on n'itérait que sur le sol ou la peinture, faux dès
 * qu'on ajoute un meuble (QA Alexis 2026-07-12).
 *
 * On analyse le rendu expert COURANT (surtout pas le fake : il ignore
 * l'itération), on isole les ajouts nets, on les matche au catalogue, on les
 * ajoute à la liste, puis on swappe les vrais produits DANS ce même rendu expert
 * — ce qui préserve l'itération au lieu de l'écraser.
 */
export async function reintegrateExpertAdditions(projectId: string): Promise<{ added: number }> {
  const project = await getProject(projectId);
  if (!project || project.mode !== "expert" || !project.expertRenderUrl) return { added: 0 };

  const cats = await getElementCategories().catch(() => []);
  const taxonomy = new Map(cats.map((c) => [c.slug, c.catalog_category]));
  const candidates = (project.element_decisions ?? []).filter((d) => !NON_DETECTABLE.has(d.category));

  const adds = await computeRenderAdditions(
    projectId,
    project.expertRenderUrl,
    project.roomType,
    candidates,
    taxonomy,
  );

  // Une itération AJOUTE ; elle ne recrée pas l'existant. Tout ce que la liste
  // connaît déjà (ou qui est déjà incrusté) n'est pas un ajout : sans ce filtre,
  // le canapé déjà swappé reviendrait en double à chaque itération.
  const list = (project.shoppingList ?? []) as ShoppingItem[];
  const known = new Set<string>([
    ...list.map((i) => i.category),
    ...(project.expertIntegratedPieces ?? []).map((p) => p.category),
  ]);
  const fresh = adds.filter((a) => a.category && !known.has(a.category));

  if (fresh.length === 0) {
    console.log(`[expert] ${projectId} : itération sans ajout de mobilier → rien à réintégrer`);
    return { added: 0 };
  }
  console.log(
    `[expert] ${projectId} : ${fresh.length} meuble(s) ajouté(s) par l'itération (${fresh.map((a) => a.category).join(", ")})`,
  );

  // ── Matching catalogue des nouveaux venus ──────────────────────────────────
  const newItems = matchAlterationsToCatalog(fresh, project.selectedStyleId, taxonomy);
  if (newItems.length === 0) return { added: 0 };

  // Crop de chaque ajout DANS le rendu expert → embedding image↔image (bien plus
  // discriminant que le texte seul), comme le fait la phase B du pipeline.
  const renderBytes = await fetchImageBytes(project.expertRenderUrl).catch(() => null);
  const byElementId = new Map(fresh.filter((a) => a.element_id).map((a) => [a.element_id!, a]));
  const crops = await Promise.all(
    newItems.map(async (it) => {
      const a = it.elementId ? byElementId.get(it.elementId) : undefined;
      return renderBytes && a?.bbox ? extractCrop(renderBytes, a.bbox).catch(() => null) : null;
    }),
  );

  const matches = await matchPartnerProductsBlendBatch(
    newItems.map((it, i) => {
      const a = it.elementId ? byElementId.get(it.elementId) : undefined;
      return {
        category: it.category,
        description: `${it.name} ${it.detail ?? ""}`.trim(),
        crop: crops[i],
        colorHex: a?.color_hex,
        attrs: a?.attrs,
      };
    }),
    4,
    { styleId: project.selectedStyleId },
  );
  newItems.forEach((it, i) => { it.matches = matches[i]; });

  // ── Swap des vrais produits DANS le rendu expert courant ───────────────────
  // replaceIds = null : ces ajouts n'ont aucune décision de review (ils viennent
  // de l'itération), donc le gating par décisions les exclurait tous.
  const pieces = selectExpertPieces(
    newItems,
    (project.productOverrides ?? {}) as Record<string, number>,
    (project.customProducts ?? {}) as Record<string, CustomProduct>,
    null,
    (project.productPicks ?? {}) as Record<string, string>,
  );

  const mergedList = [...list, ...newItems];

  // Les pins viennent de renderAnalysis.bboxById. computeRenderAdditions a détecté
  // la bbox de chaque ajout SUR LE RENDU EXPERT — sans les y reporter, la table et
  // les chaises seraient dans la liste mais n'auraient AUCUN point sur l'image
  // (QA Alexis 2026-07-12). On enrichit l'analyse existante au lieu de la remplacer :
  // les bboxes des meubles d'origine restent valides.
  const mergedAnalysis = (() => {
    const a = project.renderAnalysis;
    if (!a) return undefined;
    const bboxById = { ...a.bboxById };
    const elementHexById = { ...a.elementHexById };
    const elementAttrsById = { ...a.elementAttrsById };
    for (const add of fresh) {
      if (!add.element_id) continue;
      if (add.bbox) bboxById[add.element_id] = add.bbox;
      if (add.color_hex) elementHexById[add.element_id] = add.color_hex;
      if (add.attrs) elementAttrsById[add.element_id] = add.attrs;
    }
    return { ...a, bboxById, elementHexById, elementAttrsById, items: [...a.items, ...newItems] };
  })();

  if (pieces.length === 0) {
    // Aucun gros meuble swappable (ex. déco) : ils restent fictifs dans l'image,
    // mais deviennent au moins ACHETABLES et ÉPINGLÉS. Option 2 en repli automatique.
    await updateProject(projectId, { shoppingList: mergedList, renderAnalysis: mergedAnalysis });
    console.log(`[expert] ${projectId} : ajouts non swappables → liste + pins seulement`);
    return { added: newItems.length };
  }

  const result = await swapOnFake(project.expertRenderUrl, pieces, project.roomType);
  if (!result) {
    // Aucune image produit valide → on NE régénère PAS (anti-hallucination) :
    // le rendu itéré reste tel quel, mais les meubles entrent dans la liste.
    await updateProject(projectId, { shoppingList: mergedList, renderAnalysis: mergedAnalysis });
    console.warn(`[expert] ${projectId} : aucune image produit valide → liste + pins, rendu inchangé`);
    return { added: newItems.length };
  }

  const url = await saveRender(result.buffer, project.storageFolder, result.mimeType, "expert");
  const newPieces: ExpertIntegratedPiece[] = result.integrated.map((p) => ({
    category: p.category,
    name: p.name,
    imageUrl: p.imageUrl,
    elementId: p.elementId ?? null,
    match: p.match ?? null,
    // La bbox voyage AVEC la pièce : l'analyse (qui tourne sur le fake) ne pourra
    // jamais la retrouver, puisque le fake ne contient pas ce meuble.
    bbox: (p.elementId ? byElementId.get(p.elementId)?.bbox : undefined) ?? null,
  }));
  const allPieces = [...(project.expertIntegratedPieces ?? []), ...newPieces];

  await updateProject(projectId, {
    expertRenderUrl: url,
    expertIntegratedPieces: allPieces,
    shoppingList: enforceExpertIntegratedPieces(mergedList, allPieces),
    renderAnalysis: mergedAnalysis, // ← bboxes des ajouts : sans elles, pas de pin
  });
  console.log(
    `[expert] ${projectId} : ${newPieces.length} vrai(s) produit(s) intégré(s) dans le rendu itéré (${newPieces.map((p) => p.category).join(", ")})`,
  );
  return { added: newItems.length };
}

/**
 * Referme la boucle pour les SURFACES (sol, murs) après une itération expert.
 *
 * Une itération est une pure édition d'image : « change le sol » repeint un parquet
 * INVENTÉ, qui ne vient d'aucun produit. Jusqu'ici il n'entrait nulle part : le swap
 * expert ne touche qu'aux MEUBLES (floor et wall sont dans NON_REPLACEABLE), et
 * reintegrateExpertAdditions ne gère que le mobilier. Résultat : l'utilisateur changeait
 * son sol, l'image était superbe, et le sol était INACHETABLE (QA Alexis 2026-07-12).
 *
 * On rejoue donc la seule partie « surfaces » de l'analyse, sur le rendu expert courant :
 * le sol a-t-il changé (→ ligne + produits similaires, comme la peinture), et quels murs
 * ont été repeints (→ pots de peinture par ΔE). Le rendu, lui, reste celui de l'itération :
 * on ne régénère AUCUNE image ici, on ne fait que rendre achetable ce qui est déjà à
 * l'écran. Deux appels vision, zéro génération.
 */
export async function reintegrateExpertSurfaces(projectId: string): Promise<{ sol: boolean; murs: number }> {
  const project = await getProject(projectId);
  if (!project || project.mode !== "expert" || !project.expertRenderUrl || !project.basePhotoUrl) {
    return { sol: false, murs: 0 };
  }

  const comp = await buildBeforeAfterComposite(project.basePhotoUrl, project.expertRenderUrl);
  const compBuf = comp.buffer as unknown as Parameters<typeof confirmChanges>[2];

  const surfaces = (project.element_decisions ?? []).filter(
    (d) => d.category === "floor" || d.category === "wall",
  );

  const [audit, wallColors] = await Promise.all([
    surfaces.length
      ? confirmChanges(projectId, surfaces, compBuf, comp.afterLeftFrac, comp.afterWidthFrac).catch(() => null)
      : Promise.resolve(null),
    getChangedWallColors(compBuf).catch(() => [] as WallColor[]),
  ]);

  const list = [...((project.shoppingList ?? []) as ShoppingItem[])];
  const analysis = project.renderAnalysis;
  const bboxById: Record<string, { x: number; y: number; w: number; h: number }> = { ...(analysis?.bboxById ?? {}) };
  let solChange = false;

  // ── LE SOL ────────────────────────────────────────────────────────────────
  const solDec = surfaces.find((d) => d.category === "floor");
  if (audit && solDec && audit.appliedIds.has(solDec.element_id)) {
    const desc = audit.afterById.get(solDec.element_id)?.trim();
    const box = audit.bboxById.get(solDec.element_id);
    if (desc) {
      solChange = true;
      if (box) bboxById[solDec.element_id] = box;
      const renderBytes = await fetchImageBytes(project.expertRenderUrl).catch(() => null);
      const crop = renderBytes && box ? await extractCrop(renderBytes, box).catch(() => null) : null;
      const matches = await matchFloorProductsBlend(desc, crop, 4, audit.attrsById.get(solDec.element_id));

      const i = list.findIndex((it) => it.category === "floor");
      const ligne: ShoppingItem = {
        ...(i >= 0 ? list[i] : {
          id: `floor-${solDec.element_id}`,
          category: "floor",
          detail: "",
          priceMin: 0, priceMax: 0,
          source: "new" as const,
          merchants: [],
          elementId: solDec.element_id,
        }),
        name: desc,
        matches,
      } as ShoppingItem;
      if (i >= 0) list[i] = ligne; else list.push(ligne);
      console.log(`[expert] ${projectId} : sol changé par l'itération → « ${desc.slice(0, 40)} », ${matches.length} produit(s)`);
    }
  }

  // ── LES MURS ──────────────────────────────────────────────────────────────
  // Un pot par POT DE PEINTURE (paint_group), un pin par pan. Mêmes clés que
  // analyzeRender (`paint-<hex>`), donc les pins se posent au même endroit.
  if (wallColors.length > 0) {
    for (let i = list.length - 1; i >= 0; i--) if (list[i].category === "paint") list.splice(i, 1);
    for (const w of wallColors) {
      const key = `paint-${w.hex.replace("#", "")}`;
      const boxes = (w.bboxes?.length ? w.bboxes : w.bbox ? [w.bbox] : [])
        .map((b) => mapCompositeBoxToRender(b, comp.afterLeftFrac, comp.afterWidthFrac))
        .filter(Boolean) as { x: number; y: number; w: number; h: number }[];
      boxes.forEach((b, i) => { bboxById[i === 0 ? key : `${key}-${i + 1}`] = b; });

      list.push({
        id: key,
        name: "Peinture",
        category: "paint",
        detail: w.label,
        priceMin: 0, priceMax: 0,
        source: "diy",
        merchants: [],
        quantity: 1,
        elementId: boxes.length ? key : undefined,
        targetHex: w.hex,
        matches: await matchPaintByColor(w.hex, 4),
      } as ShoppingItem);
    }
    console.log(`[expert] ${projectId} : ${wallColors.length} peinture(s) murale(s) → ligne(s) d'achat`);
  }

  if (!solChange && wallColors.length === 0) return { sol: false, murs: 0 };

  await updateProject(projectId, {
    shoppingList: list,
    ...(analysis ? { renderAnalysis: { ...analysis, bboxById } } : {}),
  });
  return { sol: solChange, murs: wallColors.length };
}

/**
 * TÉLÉCHARGEMENT HD — un tirage 4K du rendu FINI, pour l'utilisateur.
 *
 * Chaque itération dégrade un peu l'image (toute passe la re-génère). Une fois le projet
 * terminé, ce coût n'a plus d'importance : on peut se payer UNE passe en 4K dont le seul
 * but est de récupérer de la netteté et du détail (0,16 $ contre 0,08 $).
 *
 * Le résultat est écrit sous un nom DISTINCT (hd.png) et n'écrase JAMAIS le rendu du
 * projet. C'est délibéré : NB2 est génératif — même quand on lui ordonne de ne rien
 * changer, il peut déformer un détail. Et `saveRender` réécrit toujours le même chemin,
 * sans aucun historique : un upscale raté qui deviendrait LE rendu serait irrécupérable.
 * L'utilisateur télécharge une image ; son projet, lui, reste intact.
 */
export async function renderHd(projectId: string): Promise<string> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const source =
    project.mode === "expert" && project.expertRenderUrl
      ? project.expertRenderUrl
      : project.generatedRenderUrl;
  if (!source) throw new Error("Pas de rendu à exporter.");

  const prompt =
    `Upscale this interior photo to a high-resolution, print-quality image. ` +
    `Change NOTHING about its content: the exact same furniture, the exact same objects, ` +
    `at the exact same positions and orientations, the same colours, the same wall and floor ` +
    `finishes, the same lighting and shadows, the same camera angle, perspective and framing. ` +
    `Add nothing, remove nothing, move nothing, restyle nothing. ` +
    `Your ONLY job is to restore detail and sharpness: recover fine texture (fabric weave, ` +
    `wood grain, rattan, plant leaves, wall paint), crisp edges and clean lines, as if the photo ` +
    `had been shot at high resolution from the start. Keep it photorealistic and natural.`;

  const { buffer, mimeType } = await callNb2(prompt, [await toDataUri(source)], undefined, "4K");
  // Nom DISTINCT : n'écrase pas expert.png / IN_1.png.
  const url = await saveRender(buffer, project.storageFolder, mimeType, "hd");
  console.log(`[expert] ${projectId} : tirage HD 4K généré (le rendu du projet est inchangé)`);
  return url;
}

export async function runExpertIteration(
  projectId: string,
  userRequest: string,
  // Meuble DÉSIGNÉ au doigt sur le rendu (tap-to-target). Le flux expert le jetait :
  // la route ne le transmettait pas. NB2 recevait donc une consigne GLOBALE (« change la
  // suspension ») sans savoir sur quoi se concentrer, et se croyait autorisé à re-rendre
  // toute la scène — il a ainsi ajouté une chaise à manger au milieu du salon alors qu'on
  // ne lui demandait que la suspension (QA Alexis 2026-07-12). Nommer la cible ancre
  // l'édition.
  target?: { targetLabel?: string },
): Promise<string> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  const parentUrl = project.expertRenderUrl;
  if (!parentUrl) throw new Error("Pas de rendu expert à affiner.");

  const cible = target?.targetLabel?.trim()
    ? `The change concerns ONE object and one only: the ${target.targetLabel.trim()}. Everything else in the room is FROZEN. `
    : "";

  const prompt =
    `Apply ONLY the following change to this room photo: ${userRequest}. ` +
    cible +
    `Keep EVERYTHING ELSE exactly as it is — all furniture and its exact positions, all decor, ` +
    `the layout, the windows, doors, ceiling, lighting, and the SAME camera angle and framing. ` +
    `Only change what the request explicitly asks (e.g. the floor or the wall paint). Preserve the ` +
    `exact perspective and a photorealistic look with natural lighting and contact shadows. ` +
    `Preserve the input image's sharpness, texture and grain: do NOT smooth, repaint or re-render ` +
    `areas you were not asked to change — copy them through untouched. ` +
    `STRICT RULES: add NOTHING new to the scene — no extra chair, table, seat or any other object, ` +
    `even if the room looks like it could use one; never duplicate an existing piece of furniture; ` +
    `never add, duplicate or move a light fixture; ` +
    `mirrors reflect THIS room only (never an object absent from the room); spaces seen through ` +
    `doors or openings stay exactly as they are.`;

  const { buffer, mimeType } = await callNb2(prompt, [await toDataUri(parentUrl)]);
  const n = (project.iterationCount ?? 0) + 1;
  const url = await saveRender(buffer, project.storageFolder, mimeType, `iterate_${n}`);
  // expertIterated : à partir d'ici, le rendu expert peut contenir des meubles que
  // le fake n'a jamais eus → le fake n'est plus une base de swap valide.
  await updateProject(projectId, { expertRenderUrl: url, iterationCount: n, expertIterated: true });
  console.log(`[expert] ${projectId} : itération expert #${n} sauvegardée`);
  return url;
}

export { selectExpertPieces };
