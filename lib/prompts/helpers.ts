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

  const d = data.data as AmbianceData;
  const signature = d.signature?.length
    ? `. signature elements: ${d.signature.join(", ")}`
    : "";

  const colorway = buildColorwayDirective(d.colorways ?? [], opts);

  return {
    styleName: d.name,
    styleMood: `${d.mood}. palette: ${d.palette.join(", ")}. materials: ${d.materials.join(", ")}${signature}${colorway.part}`,
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
const ARCH_SURFACE_CATEGORIES = new Set(["wall", "floor", "ceiling"]);

// Petite déco dont les REPLACE sont groupés en une ligne récapitulative en
// mode beta — l'enjeu par pièce est nul et chaque ligne dilue le plan.
const DECOR_GROUP_CATEGORIES = new Set(["decor_object", "frame", "mirror", "plant", "cushion"]);

/**
 * Transforme les décisions par élément (après review) en un plan lisible pour
 * les prompts image (génération + itération). On n'inclut que les éléments
 * ACTIONNABLES (personnaliser/remplacer) ; les "garder" sont déjà couverts par
 * la règle d'ancrage du prompt de génération. Retourne "" si rien d'actionnable.
 */
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

  const lines: string[] = [];
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
      const label = (beta ? d.action_label_en : null) ?? d.action_label ?? "personnaliser la finition pour s'accorder au style";
      lines.push(
        `- RESTYLE ${what}${tag}: ${label}${qty}. Keep shape, size and position.`,
      );
    } else if (beta) {
      // REPLACE beta : ligne COMPACTE — le boilerplate répété ×N noie le plan
      // (banc JwnjVV3W) ; les règles d'application vivent dans le template.
      lines.push(
        `- REPLACE ${many ? `the ${count} ` : ""}${what}${tag}: a clearly different model${many ? ` — all ${count} identical, the SAME new model` : ""}, same footprint and position. Never the original recolored.`,
      );
    } else {
      // REPLACE : instruction propre et explicite. On IGNORE volontairement
      // action_label (souvent une suggestion "retapisser/repeindre" héritée du
      // verdict qui CONTREDIT le remplacement et fait halluciner le modèle).
      lines.push(
        `- REPLACE ${many ? `the ${count} ` : ""}${what}${tag}: put ${many ? `${count} ` : "a "}clearly different, style-matching ${many ? "pieces" : "piece"} in the same place(s) — same footprint and position. Do NOT reupholster or recolor the original.`,
      );
    }
  }

  // Ligne récapitulative de la petite déco à remplacer (beta).
  if (decorCount > 0) {
    const detail = decorReplacements.slice(0, 4).join("; ");
    lines.push(
      `- REPLACE the small decor as a group (${decorCount} item${decorCount > 1 ? "s" : ""}: ${detail}${decorReplacements.length > 4 ? "; …" : ""}): quiet, style-matching pieces — different objects, never the originals recolored.`,
    );
  }

  return lines.join("\n");
}
