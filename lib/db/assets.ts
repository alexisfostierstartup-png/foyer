import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { Style } from "@/lib/types";

export type FloorPreset = { slug: string; label: string };

export async function getFloorPresets(): Promise<FloorPreset[]> {
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from("assets")
    .select("slug, data")
    .eq("category", "floor_preset")
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []).map((a) => ({
    slug: a.slug,
    label: (a.data as { label: string }).label,
  }));
}

export async function getRoomDefaults(): Promise<Record<string, string[]>> {
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from("assets")
    .select("slug, data")
    .eq("category", "room_defaults")
    .eq("is_active", true)
    .order("sort_order");
  const result: Record<string, string[]> = {};
  for (const a of data ?? []) {
    const d = a.data as { expectedFurniture?: string[] };
    result[a.slug] = d.expectedFurniture ?? [];
  }
  return result;
}

function mapAmbianceRow(a: { id: string; slug: string; data: unknown }): Style {
  const d = a.data as {
    name: string;
    description: string;
    palette: string[];
    materials: string[];
    mood: string;
  };
  return {
    id: a.slug,
    name: d.name,
    description: d.description,
    paletteHex: d.palette,
    materials: d.materials,
    mood: d.mood,
    moodboardUrl: `/moodboards/${a.slug}.svg`,
  };
}

export async function getAmbiances(): Promise<Style[]> {
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from("assets")
    .select("id, slug, data")
    .eq("category", "ambiance")
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []).map(mapAmbianceRow);
}

// ─── Taxonomie d'éléments (source unique des catégories de détection) ────────

export type DecisionAction = "keep" | "customize" | "replace";

export type ElementCategory = {
  slug: string;
  label_fr: string;
  label_en: string;
  family: string;
  room_types: string[];
  movable: boolean;
  diy_eligible: boolean;
  catalog_category: string | null;
  // Actions proposées en review pour cette catégorie (défaut : les 3).
  allowed_actions?: DecisionAction[];
  fixed_lightpoint?: boolean;
  preserve_behind?: boolean;
};

// Repli si la table assets ne renvoie rien (DB vide / erreur) → la détection ne
// casse jamais. Liste plate équivalente à l'ancien enum hardcodé.
const FALLBACK_CATEGORY_ENUM =
  "- sofa, armchair, chair, bed, wardrobe, dresser, bookshelf, tv_stand, coffee_table, side_table, nightstand, shelf, floor, wall, ceiling, window, door, headboard, bench, rug, lamp, plant, other";

export async function getElementCategories(): Promise<ElementCategory[]> {
  const { data } = await createSupabaseAdmin()
    .from("assets")
    .select("slug, data")
    .eq("category", "element_category")
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []).map((a) => ({
    slug: a.slug,
    ...(a.data as Omit<ElementCategory, "slug">),
  }));
}

export async function getAllowedActionsByCategory(): Promise<Map<string, DecisionAction[]>> {
  const cats = await getElementCategories().catch(() => [] as ElementCategory[]);
  return new Map(
    cats.map((c) => [c.slug, c.allowed_actions ?? ["keep", "customize", "replace"]]),
  );
}

/**
 * Construit le bloc {{categories}} injecté dans vision_detect_extended : familles
 * → types précis, filtré par type de pièce. Repli sur l'ancien enum si vide.
 */
export async function getElementCategoryEnum(roomType?: string): Promise<string> {
  const cats = await getElementCategories().catch(() => [] as ElementCategory[]);
  const filtered = cats.filter(
    (c) => !roomType || !c.room_types?.length || c.room_types.includes(roomType),
  );
  if (filtered.length === 0) return FALLBACK_CATEGORY_ENUM;

  // Liste PLATE `slug = libellé` : le slug (gauche du =) est la valeur de
  // `category`. On n'injecte PAS la famille ici (elle ne sert qu'au regroupement
  // UI) pour éviter que le modèle renvoie un nom de famille comme catégorie.
  return filtered.map((c) => `- ${c.slug} = ${c.label_fr}`).join("\n");
}

export async function getAmbianceById(slugOrId: string): Promise<Style | null> {
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from("assets")
    .select("id, slug, data")
    .eq("category", "ambiance")
    .eq("is_active", true)
    .eq("slug", slugOrId)
    .maybeSingle();
  return data ? mapAmbianceRow(data) : null;
}
