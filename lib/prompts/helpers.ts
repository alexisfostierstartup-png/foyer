import { createSupabaseAdmin } from "@/lib/supabase/server";
import type {
  AmbianceData,
  FloorPresetData,
  WallPaletteData,
} from "@/lib/db/database.types";

export async function loadStyleContext(
  styleId: string,
): Promise<{ styleName: string; styleMood: string }> {
  const { data, error } = await createSupabaseAdmin()
    .from("assets")
    .select("data")
    .eq("category", "ambiance")
    .eq("slug", styleId)
    .single();

  if (error || !data) throw new Error(`Style not found: ${styleId}`);

  const d = data.data as AmbianceData;
  return {
    styleName: d.name,
    styleMood: `${d.mood}. palette: ${d.palette.join(", ")}. materials: ${d.materials.join(", ")}`,
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
    action_label?: string | null;
    qty?: number | null;
    qty_unit?: string | null;
  }> | null | undefined,
): string {
  if (!decisions?.length) return "";

  // Regroupe les éléments identiques (même type d'action + catégorie + description)
  // → UNE ligne avec compteur. Un plan court et sans répétition est bien mieux
  // suivi par le modèle image (ex. 4 chaises identiques = 1 instruction, pas 4).
  type G = { d: (typeof decisions)[number]; count: number };
  const groups = new Map<string, G>();
  for (const d of decisions) {
    if (d.mismatch_type !== "surface" && d.mismatch_type !== "structural") continue;
    const key = `${d.mismatch_type}|${d.category}|${(d.description ?? "").trim().toLowerCase()}`;
    const g = groups.get(key);
    if (g) g.count += 1;
    else groups.set(key, { d, count: 1 });
  }

  const lines: string[] = [];
  for (const { d, count } of groups.values()) {
    const what = (d.description?.trim() || d.category).replace(/\s+/g, " ");
    const many = count > 1;
    const tag = many ? ` (×${count})` : "";
    if (d.mismatch_type === "surface") {
      const qty = d.qty && d.qty_unit ? ` (≈ ${d.qty} ${d.qty_unit})` : "";
      lines.push(
        `- RESTYLE ${what}${tag}: ${d.action_label ?? "personnaliser la finition pour s'accorder au style"}${qty}. Keep shape, size and position.`,
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
  return lines.join("\n");
}
