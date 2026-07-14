import { createSupabaseAdmin } from "@/lib/supabase/server";
import type {
  AmbianceData,
  FloorPresetData,
  StyleColorway,
  WallPaletteData,
} from "@/lib/db/database.types";

export type StyleContextOptions = {
  // Index de déclinaison colorée (rotation à la régénération). 0 = déclinaison
  // par défaut → styleMood inchangé. Modulo le nombre de déclinaisons du style.
  colorwayIndex?: number;
  // true quand le user a choisi explicitement une couleur de murs
  // (walls.repaint) : la déclinaison ne touche alors pas aux murs.
  lockWalls?: boolean;
};

export async function loadStyleContext(
  styleId: string,
  opts?: StyleContextOptions,
): Promise<{ styleName: string; styleMood: string; colorwaySlug?: string }> {
  const { data, error } = await createSupabaseAdmin()
    .from("assets")
    .select("data")
    .eq("category", "ambiance")
    .eq("slug", styleId)
    .single();

  if (error || !data) throw new Error(`Style not found: ${styleId}`);

  const d = data.data as AmbianceData & { beauty?: string; avoid?: string[] };
  // Qualificatif architecture : les signatures de style citent des éléments
  // architecturaux (cheminée marbre, parquet point de Hongrie, moulures…) que
  // le modèle AJOUTE à des pièces qui n'en ont pas (cheminée inventée ×2, banc
  // nuit 2026-07-10) — on borne la liste au lieu d'éditer les 18 assets.
  const signature = d.signature?.length
    ? `. signature elements (architectural ones — fireplace, mouldings, parquet pattern, ceiling rose — ONLY if the photo already shows them; NEVER add them): ${d.signature.join(", ")}`
    : "";
  // Référent beauté (seed-style-beauty.mjs) : la direction artistique qui rend le
  // style DÉSIRABLE + les pièges qui l'enlaidissent. Contrepoids des règles
  // restrictives : on dit enfin au modèle à quoi ressemble un rendu réussi.
  const beauty = d.beauty ? `. craft — what makes this style gorgeous: ${d.beauty}` : "";
  // Script déco concret (distillé des images de référence d'Alexis) : QUOI
  // accrocher/poser/draper, pas juste une ambiance — la mise en scène devient
  // exécutable (demande Alexis 2026-07-14 : « mieux décorer »).
  const decor = (d as { decor?: string[] }).decor?.length
    ? `. STAGE THIS DECOR (concrete, from the style's reference shoots — adapt placement to THIS room): ${(d as { decor?: string[] }).decor!.join("; ")}`
    : "";
  const avoid = d.avoid?.length ? `. NEVER: ${d.avoid.join("; ")}` : "";

  const colorway = buildColorwayDirective(d.colorways ?? [], opts);

  return {
    styleName: d.name,
    styleMood: `${d.mood}. palette: ${d.palette.join(", ")}. materials: ${d.materials.join(", ")}${signature}${beauty}${decor}${avoid}${colorway.part}`,
    colorwaySlug: colorway.slug,
  };
}

/**
 * Déclinaison colorée : une seule ligne d'orientation couleur ajoutée au
 * styleMood, sans toucher à l'identité (matériaux/formes/signatures restent
 * ceux du mood). Index 0 (ou modulo retombant sur 0) = déclinaison par défaut
 * → aucune ligne. lockWalls retire la consigne murs (choix user explicite).
 */
export function buildColorwayDirective(
  colorways: StyleColorway[],
  opts?: StyleContextOptions,
): { part: string; slug?: string } {
  if (colorways.length === 0) return { part: "" };
  const idx = (opts?.colorwayIndex ?? 0) % colorways.length;
  const cw = colorways[idx];
  if (idx === 0 || !cw) return { part: "" };
  const parts = [
    ...(cw.walls && !opts?.lockWalls ? [cw.walls] : []),
    ...(cw.accents ? [cw.accents] : []),
  ];
  if (parts.length === 0) return { part: "" };
  return {
    part: `. Colour direction for THIS render (same materials and furniture shapes as the style, only the colour story changes — overrides the default palette hues): ${parts.join("; ")}`,
    slug: cw.slug,
  };
}

export async function loadRoomDefaults(roomType: string): Promise<string> {
  const { data, error } = await createSupabaseAdmin()
    .from("assets")
    .select("data")
    .eq("category", "room_defaults")
    .eq("slug", roomType)
    .single();

  if (error || !data)
    throw new Error(`Room defaults not found: ${roomType}`);

  return (data.data as { englishFurniture: string }).englishFurniture;
}

// Catégories d'éléments à RETIRER pour ce type de pièce (ex. chambre → sofa,
// coffee_table…). Statique par room type, stocké dans l'asset room_defaults.
export async function loadRoomRemoveCategories(roomType: string): Promise<string[]> {
  const { data } = await createSupabaseAdmin()
    .from("assets")
    .select("data")
    .eq("category", "room_defaults")
    .eq("slug", roomType)
    .single();
  return (data?.data as { removeCategories?: string[] } | undefined)?.removeCategories ?? [];
}

type FurnitureChoices = Record<string, "keep" | "customize" | "replace">;
type FloorChoice = { action: "keep" | "change"; preset?: string; custom?: string };
type WallsChoice = {
  repaint?: string;
  mouldings?: "discreet" | "classic" | "bold";
  frames?: boolean;
};

export type UserChoicesInput = {
  floor?: FloorChoice;
  walls?: WallsChoice;
  furniture?: FurnitureChoices;
  accessories?: string;
  [key: string]: unknown;
};

/**
 * Formate les choix user en lignes USER INSTRUCTIONS.
 * Ne référence jamais ce que Vision a détecté — seulement l'intention user.
 */
export async function formatUserInstructions(
  choices: UserChoicesInput,
): Promise<string> {
  const lines: string[] = [];
  const supabase = createSupabaseAdmin();

  // Floor — always explicit: either change with detail, or hard preserve
  if (choices.floor?.action === "change") {
    let detail = choices.floor.custom;
    if (choices.floor.preset) {
      const { data } = await supabase
        .from("assets")
        .select("data")
        .eq("category", "floor_preset")
        .eq("slug", choices.floor.preset)
        .single();
      if (data) detail = (data.data as FloorPresetData).description;
    }
    lines.push(
      `- Floor: CHANGE the floor to: ${detail ?? "choose what best suits the style"}`,
    );
  } else {
    lines.push(
      "- Floor: DO NOT change the floor. Preserve its material, color, texture, and pattern EXACTLY as seen in the source image.",
    );
  }

  // Walls
  if (choices.walls) {
    const w = choices.walls;
    if (w.repaint) {
      const { data } = await supabase
        .from("assets")
        .select("data")
        .eq("category", "wall_palette")
        .eq("slug", w.repaint)
        .single();
      const palette = data ? (data.data as WallPaletteData) : null;
      lines.push(
        `- Walls: repaint in ${palette?.description ?? w.repaint}${palette ? ` (${palette.hex})` : ""}`,
      );
    }
    if (w.mouldings) {
      lines.push(
        `- Walls: add ${w.mouldings} decorative mouldings (panelling), painted to match the walls.`,
      );
    }
    if (w.frames) {
      lines.push(`- Walls: add framed art (gallery wall style).`);
    }
  }

  // Furniture
  if (choices.furniture) {
    for (const [item, action] of Object.entries(choices.furniture)) {
      if (action === "customize")
        lines.push(`- ${item}: keep but actively restyle to fit the new look`);
      if (action === "replace")
        lines.push(`- ${item}: replace with a style-matching version`);
      // "keep" = défaut, inutile de l'écrire
    }
  }

  // Accessories
  if (choices.accessories === "minimal") {
    lines.push(
      "- Accessories: keep the room focused. Do not add decorative clutter (no extra cushions, no plants).",
    );
  }

  if (lines.length === 0) return "None — use your judgment within the guidance.";
  return lines.join("\n");
}

// Surfaces architecturales : RESTYLE toujours valide, REPLACE jamais (on ne
// « remplace » pas un mur par une pièce différente au même emplacement).
export const ARCH_SURFACE_CATEGORIES = new Set(["wall", "floor", "ceiling"]);

// Petite déco dont les REPLACE sont groupés en une ligne récapitulative en
// mode beta — l'enjeu par pièce est nul et chaque ligne dilue le plan.
const DECOR_GROUP_CATEGORIES = new Set(["decor_object", "frame", "mirror", "plant", "cushion"]);

// Assises : le modèle image « remplace » trop souvent par la même silhouette
// retapissée (banc seventies 2026-07-09 : 2/3 canapés = cousin de l'original).
// On exige un changement de GÉOMÉTRIE sans prescrire de modèle cible (l'aléa
// du rendu reste entier — n'importe quel modèle du style, mais pas la copie).
const SEAT_CATEGORIES = new Set(["sofa", "armchair", "chair", "dining_chair", "bench"]);
const SEAT_REPLACE_SUFFIX =
  " The new piece must ALSO have a visibly different SILHOUETTE (different arm shape, back height, base or overall geometry) — any style-matching model, but never the original shape re-upholstered." +
  " The new piece is a COHERENT real-world product that could exist in a store — NEVER a hybrid keeping parts of the old piece (e.g. the old metal legs under a new rattan back): every part (legs, frame, seat, back) belongs to the SAME new model.";

// Fidélité de catégorie (banc wave3, s09 : « fauteuils » rendus comme des
// chaises de table) : un fauteuil remplacé doit rester un VRAI fauteuil.
const ARMCHAIR_REPLACE_SUFFIX =
  " It must be a REAL lounge armchair — generous padded seat and armrests, made for relaxing — never a dining-style chair.";

// CANAPÉ : la consigne textuelle générique ne suffit pas — le modèle image recopie
// la géométrie de l'original en changeant tissu/capitonnage (bancs 2026-07-09/10 :
// 2/3 canapés identiques retapissés, y compris avec la règle silhouette). On tire
// donc AU SORT un archétype de silhouette INCOMPATIBLE avec l'original (repéré par
// sa description) et on l'impose comme direction : l'aléa demeure (tirage + liberté
// du modèle à l'intérieur de l'archétype), la copie devient impossible. NB : pour
// permettre un vrai changement de forme, la ligne canapé parle de « same area »,
// pas de « same footprint » (une empreinte identique = la même géométrie).
const SOFA_SILHOUETTES: { hint: string; excl: RegExp }[] = [
  { hint: "a STRAIGHT sofa with visible legs and slim arms", excl: /droit|straight/i },
  { hint: "a CURVED, organically rounded sofa", excl: /courb|arrondi|curved|organic/i },
  { hint: "a LOW-SLUNG sofa on a plinth base, no visible legs", excl: /\bbas\b|plinth|low[- ]slung/i },
  { hint: "an L-SHAPED corner sofa with a chaise section", excl: /angle|modul|m[ée]ridienne|chaise|corner|panoramique/i },
];
function sofaSilhouetteDirective(description: string): string {
  const candidates = SOFA_SILHOUETTES.filter((s) => !s.excl.test(description));
  const pick = candidates[Math.floor(Math.random() * candidates.length)] ?? SOFA_SILHOUETTES[0];
  return ` Build the NEW sofa as ${pick.hint}, in the target style — a deliberately DIFFERENT geometry from the current sofa (it only needs to fit roughly the same area of the room, NOT the same footprint).`;
}

// NE JAMAIS citer le look de l'original dans une ligne REPLACE : le modèle image
// le lit comme la description de la CIBLE et le reproduit (banc 2026-07-10 :
// « coussins décoratifs bleus » recopiés deux runs de suite, y compris marqués
// « must DISAPPEAR » — la négation n'existe pas en génération d'image). L'objet
// est désigné par sa catégorie seule ; un repère descriptif COURT (1re proposition
// de la description) n'est gardé que si une autre pièce de MÊME catégorie n'est
// pas remplacée (désambiguïsation nécessaire).
function replaceTargetLabel(
  d: { category: string; description?: string | null },
  ambiguous: boolean,
): string {
  const cat = d.category.replace(/_/g, " ");
  if (!ambiguous) return cat;
  const shortDesc = (d.description ?? "").split(/[,.(]/)[0].trim();
  return shortDesc ? `${cat} (${shortDesc})` : cat;
}

/**
 * Transforme les décisions par élément (après review) en un plan lisible pour
 * les prompts image (génération + itération) : les customisations/remplacements
 * en instructions explicites, plus une ligne compacte pour les "garder" (hors
 * surfaces murales) — la règle d'ancrage seule du prompt de génération ne
 * suffit pas à les protéger (bench 2026-07-10). Retourne "" si rien à dire.
 */
/**
 * Consigne de repli quand le verdict dit « cette surface doit changer » mais qu'AUCUNE
 * action ne lui est attachée (action_label absent — cas courant hors flux DIY).
 *
 * Le repli précédent était « personnaliser la finition pour s'accorder au style » : vague,
 * sans verbe, et en FRANÇAIS au milieu d'un prompt anglais. Le modèle image ne faisait
 * donc rien — d'où des murs jamais repeints alors que le plan demandait bien de les
 * changer (projet t-0D-MCYt, 2026-07-13 : « aucune personnalisation, la couleur ne va pas
 * du tout avec le style »). Un mur qui doit changer doit s'entendre dire REPEINDRE, et
 * dans quelle palette.
 */
function restyleParDefaut(category: string): string {
  if (category === "wall")
    return "repaint it in a colour taken from the style palette — pick the one that most clearly strengthens the style, and never leave it in its current colour";
  if (category === "ceiling")
    return "repaint it in a colour taken from the style palette";
  if (category === "floor")
    return "refinish it so it clearly matches the style";
  return "restyle its finish so that it unmistakably matches the style";
}

export function formatDesignPlan(
  decisions: Array<{
    description?: string;
    category: string;
    mismatch_type: "none" | "surface" | "structural";
    action_slug?: string | null;
    action_label?: string | null;
    action_label_en?: string | null;
    qty?: number | null;
    qty_unit?: string | null;
  }> | null | undefined,
  opts?: {
    // Mode DIY beta : slugs d'actions dont le rendu fidèle est validé.
    // Une customisation (surface) dont l'action n'est PAS renderable est
    // dégradée en REPLACE dans le plan image (comportement standard) — la
    // shopping list, elle, garde bien les fournitures de customisation.
    renderableSlugs?: Set<string>;
  },
): string {
  if (!decisions?.length) return "";

  // Regroupe les éléments identiques (même type d'action + catégorie + description)
  // → UNE ligne avec compteur. Un plan court et sans répétition est bien mieux
  // suivi par le modèle image (ex. 4 chaises identiques = 1 instruction, pas 4).
  // NB (banc DIY beta 2026-07-07) : NE PAS regrouper les RESTYLE de descriptions
  // différentes — la ligne groupée ×2 énumérée dégrade la conformité (0-1/2 vs
  // 1/2 en lignes séparées). Limite modèle : ~1 restyle fiable par catégorie et
  // par rendu ; la 2e cible similaire relève de l'itération (ou d'une future
  // boucle audit→retouche).
  type G = { d: (typeof decisions)[number]; count: number };
  const groups = new Map<string, G>();
  // Mode beta — condensation du plan (banc projet JwnjVV3W : à 19 lignes, le
  // modèle image dégénère en teinture globale / conformité ~40 % ; à ~11 lignes
  // nettes, conformité forte). Deux condensations sans perte d'intention :
  //  - la petite déco (objets, cadres, plantes, coussins) à REMPLACER est
  //    groupée en UNE ligne récapitulative (l'enjeu est nul pièce par pièce) ;
  //  - les murs partageant le même action_label sont groupés en une ligne.
  const beta = Boolean(opts?.renderableSlugs);
  const decorReplacements: string[] = [];
  let decorCount = 0;
  // Les KEEP d'objets (hors surfaces murales — la liberté de style y reste
  // entière) sont énoncés en UNE ligne compacte, flux standard ET beta.
  // Silencieux, ils étaient systématiquement violés (banc nuit 2026-07-10 :
  // tableaux conservés supprimés/remplacés dans 6 sessions sur 8 en beta ;
  // même défaillance observée en standard sur des canapés — projet
  // i1d6E1vlTmNgb2G3ekk9X 2026-07-10).
  const keptDescs: string[] = [];
  {
    const keptCount = new Map<string, number>();
    for (const d of decisions) {
      if (d.mismatch_type !== "none" || ARCH_SURFACE_CATEGORIES.has(d.category)) continue;
      const desc = (d.description ?? d.category).trim().replace(/\s+/g, " ");
      if (desc) keptCount.set(desc, (keptCount.get(desc) ?? 0) + 1);
    }
    for (const [desc, n] of keptCount) keptDescs.push(n > 1 ? `${desc} (×${n})` : desc);
  }

  // Nombre TOTAL d'instances par catégorie (keep inclus) : une ligne REPLACE dont
  // le groupe ne couvre pas toutes les instances de sa catégorie a besoin d'un
  // repère descriptif court pour viser la bonne pièce (cf. replaceTargetLabel).
  const totalCatCount = new Map<string, number>();
  for (const d of decisions) totalCatCount.set(d.category, (totalCatCount.get(d.category) ?? 0) + 1);

  for (const d of decisions) {
    if (d.mismatch_type !== "surface" && d.mismatch_type !== "structural") continue;
    if (beta && d.mismatch_type === "structural" && DECOR_GROUP_CATEGORIES.has(d.category)) {
      decorCount += 1;
      const desc = (d.description ?? d.category).trim().replace(/\s+/g, " ");
      if (desc && !decorReplacements.includes(desc)) decorReplacements.push(desc);
      continue;
    }
    const key =
      beta && d.category === "wall" && d.mismatch_type === "surface"
        ? `${d.mismatch_type}|wall|${(d.action_label ?? "").trim().toLowerCase()}`
        : `${d.mismatch_type}|${d.category}|${(d.description ?? "").trim().toLowerCase()}`;
    const g = groups.get(key);
    if (g) g.count += 1;
    else groups.set(key, { d, count: 1 });
  }

  // RESTYLE d'abord, REPLACE ensuite : les customisations (cœur du flux DIY)
  // en tête de plan sont mieux suivies par le modèle image que noyées entre
  // les remplacements (banc DIY 2026-07-09 : RESTYLE fins ignorés en plan long).
  const restyleLines: string[] = [];
  const replaceLines: string[] = [];
  for (const { d, count } of groups.values()) {
    const many = count > 1;
    // Groupe murs (beta) : libellé générique, pas la description du 1er mur.
    const what =
      beta && d.category === "wall" && many
        ? "the walls (every painted wall)"
        : (d.description?.trim() || d.category).replace(/\s+/g, " ");
    const tag = many && !(beta && d.category === "wall") ? ` (×${count})` : "";
    // Mode beta : une surface dont l'action est CONNUE comme non rendable
    // (ex. housse, poignées) est présentée au modèle image comme un REPLACE
    // (rendu approximatif assumé) — la décision et ses fournitures restent
    // une customisation côté review/shopping. Deux exceptions (bug projet
    // vLkE2sZ5… : « REPLACE Mur ocre / Plafond blanc — do NOT recolor ») :
    //  - action_slug ABSENT (override user sans action) → RESTYLE générique,
    //    comme en flux standard — jamais un REPLACE qui contredit l'intention ;
    //  - surfaces architecturales (mur/sol/plafond) → toujours RESTYLE, la
    //    sémantique REPLACE (« nouvelle pièce, même emplacement ») n'existe pas.
    const isArchSurface = ARCH_SURFACE_CATEGORIES.has(d.category);
    const surfaceRenderable =
      !opts?.renderableSlugs ||
      isArchSurface ||
      d.action_slug == null ||
      opts.renderableSlugs.has(d.action_slug);
    if (d.mismatch_type === "surface" && surfaceRenderable) {
      const qty = d.qty && d.qty_unit ? ` (≈ ${d.qty} ${d.qty_unit})` : "";
      // Beta : le label ANGLAIS du verdict prime pour le prompt image (banc :
      // « Teinter le bois en espresso » 0/4 vs « Stain the wood dark espresso » 2/2).
      const label = (beta ? d.action_label_en : null) ?? d.action_label ?? restyleParDefaut(d.category);
      // « must be clearly visible » : banc nuit 2026-07-10 — les restyles de
      // finition (teinte bois, abat-jour, moulures) étaient souvent ignorés,
      // l'objet restant à l'identique dans le rendu.
      // Repeindre = peinture OPAQUE : le modèle transformait « repeindre » en
      // effet bois teinté (impossible sur un meuble peint — projet réel 1KL1DfGJ).
      const paintClause = /paint|peindre|peinture/i.test(`${d.action_slug ?? ""} ${label}`)
        ? " The finish is opaque PAINT in the stated colour — never exposed wood grain, stain or varnish."
        : "";
      // MUR : l'action couvre TOUS les pans — la détection rend parfois un seul
      // wall_1 pour 3 murs visibles → sans cette clause, le modèle ne peignait
      // qu'un pan (moulures gauche/droite dépareillées, b-s02 2026-07-14).
      const wholeRoomClause = d.category === "wall"
        ? " Apply it to EVERY wall and EVERY run of wainscot/panelling in the room — left, right, back, around openings — one uniform scheme edge to edge; a single unpainted section is a FAILURE."
        : "";
      restyleLines.push(
        `- RESTYLE ${what}${tag}: ${label}${qty}. It stays the SAME object (same shape, size, position, structure) — only this finish changes, and the change must be unmistakably visible, never left looking unchanged.${paintClause}${wholeRoomClause}`,
      );
    } else if (beta) {
      // REPLACE beta : ligne COMPACTE — le boilerplate répété ×N noie le plan
      // (banc JwnjVV3W) ; les règles d'application vivent dans le template.
      replaceLines.push(
        d.category === "sofa"
          ? `- REPLACE the sofa: a clearly different model, same position in the room.${sofaSilhouetteDirective(d.description ?? "")}`
          : `- REPLACE ${many ? `the ${count} ` : "the "}${replaceTargetLabel(d, (totalCatCount.get(d.category) ?? 0) > count)}${many ? "s" : ""}: a clearly different model${many ? ` — all ${count} identical, the SAME new model` : ""}, same footprint and position. Never the original recolored.${SEAT_CATEGORIES.has(d.category) ? SEAT_REPLACE_SUFFIX : ""}${d.category === "armchair" ? ARMCHAIR_REPLACE_SUFFIX : ""}`,
      );
    } else {
      // REPLACE : instruction propre et explicite. On IGNORE volontairement
      // action_label (souvent une suggestion "retapisser/repeindre" héritée du
      // verdict qui CONTREDIT le remplacement et fait halluciner le modèle).
      replaceLines.push(
        d.category === "sofa"
          ? `- REPLACE the sofa: put a clearly different, style-matching sofa at the same position in the room.${sofaSilhouetteDirective(d.description ?? "")}`
          : `- REPLACE ${many ? `the ${count} ` : "the "}${replaceTargetLabel(d, (totalCatCount.get(d.category) ?? 0) > count)}${many ? "s" : ""}: put ${many ? `${count} ` : "a "}clearly different, style-matching ${many ? "pieces" : "piece"} in the same place(s) — same footprint and position. Do NOT reupholster or recolor the original.${SEAT_CATEGORIES.has(d.category) ? SEAT_REPLACE_SUFFIX : ""}${d.category === "armchair" ? ARMCHAIR_REPLACE_SUFFIX : ""}`,
      );
    }
  }

  const lines = [...restyleLines, ...replaceLines];
  if (keptDescs.length > 0) {
    lines.unshift(
      `- KEEP strictly unchanged (same object, same colour, same place): ${keptDescs.slice(0, 8).join("; ")}${keptDescs.length > 8 ? "; …" : ""}. ` +
        `A KEEP item is the SAME PHYSICAL PIECE, reproduced pixel-faithfully: same SILHOUETTE and geometry, same size, same number of seats/modules, same orientation, same colour, same material. ` +
        // Le modèle respectait la lettre (ni recolorisation ni retapissage) en changeant la
        // GÉOMÉTRIE : canapé droit devenu canapé d'ANGLE, la signature de style tirant dans
        // ce sens (« low-slung deep-seated sofas ») — projet WzUohGBEDXyYwlsaJLM2P 2026-07-11.
        `NEVER reshape it toward the target style: a straight sofa NEVER becomes a corner/L-shaped/modular one (and vice-versa), a rectangular table never becomes round, no seat is added or removed. ` +
        `Recolouring, reupholstering, resizing or reshaping a KEEP item is a FAILURE — the style must flow AROUND it, never through it. ` +
        `The ONLY allowed addition on a kept seat: style-matching cushions or a throw laid on it (they tie it into the new style without touching the seat itself).`,
    );
  }
  // Sol KEEP (beta) : silencieux, le style impose son motif (chevrons/damier ×4
  // au banc nuit 2026-07-10) — or un sol non budgété doit rester le sol réel.
  // Les murs restent volontairement libres (la couleur fait partie du wow).
  if (beta && decisions.some((d) => d.category === "floor" && d.mismatch_type === "none")) {
    lines.unshift(
      `- FLOOR: keep the existing floor EXACTLY as in the photo — same material, same colour, same plank/tile size and same laying pattern (do not switch to herringbone, checkerboard or any other pattern).`,
    );
  }

  // Ligne récapitulative de la petite déco NON alignée au style : RETIRÉE, pas
  // remplacée (remaster Alexis 2026-07-10 — la nouvelle déco vient de la mise en
  // scène du style, pas d'un remplacement pièce à pièce qui crée du patchwork).
  if (decorCount > 0) {
    const detail = decorReplacements.slice(0, 4).join("; ");
    lines.push(
      `- REMOVE the small decor that does not fit the style (${decorCount} item${decorCount > 1 ? "s" : ""}: ${detail}${decorReplacements.length > 4 ? "; …" : ""}): take them OUT of the room — do not replace them one-for-one; a bare surface is fine, the style's own staging brings any new decor where the composition needs it.`,
    );
  }

  return lines.join("\n");
}
