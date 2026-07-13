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

export type RoomTypeOption = { slug: string; label: string; furniture: string[] };

// Source UNIQUE des types de pièce : les assets room_defaults. Ajouter une pièce
// = ajouter un asset (slug + label + brief + removeCategories), zéro code.
export async function getRoomTypes(): Promise<RoomTypeOption[]> {
  const { data } = await createSupabaseAdmin()
    .from("assets")
    .select("slug, data")
    .eq("category", "room_defaults")
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []).map((a) => {
    const d = a.data as { label?: string; expectedFurniture?: string[] };
    return { slug: a.slug, label: d.label ?? a.slug, furniture: d.expectedFurniture ?? [] };
  });
}

function mapAmbianceRow(a: { id: string; slug: string; data: unknown }): Style {
  const d = a.data as {
    name: string;
    description: string;
    longDescription?: string;
    palette: string[];
    materials: string[];
    mood: string;
    moodboardUrl?: string;
    images?: string[];
    stable?: boolean;
  };
  return {
    id: a.slug,
    name: d.name,
    description: d.description,
    longDescription: d.longDescription,
    paletteHex: d.palette,
    materials: d.materials,
    mood: d.mood,
    moodboardUrl: d.moodboardUrl ?? `/moodboards/${a.slug}.svg`,
    // Repli sur l'image unique : un style sans liste reste affichable (une seule photo,
    // pas de flèches) plutôt que de casser la carte.
    images: d.images?.length ? d.images : [d.moodboardUrl ?? `/moodboards/${a.slug}.svg`],
    stable: d.stable === true,
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
  // La catégorie ne peut être que REMPLACÉE, jamais AJOUTÉE : une applique murale
  // suppose un point électrique dans le mur — en créer une, on ne peut ni le promettre ni
  // le chiffrer. Ces catégories sont exclues des additions du rendu, même quand le modèle
  // en peint une de plus.
  replace_only?: boolean;
  preserve_behind?: boolean;
  // Mots-clés FR/EN pour le remap déterministe : un élément détecté en "other"
  // dont l'élément/description matche un de ces mots est reclassé vers ce slug.
  keywords?: string[];
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

/**
 * Table de remap déterministe pour les fixtures techniques que la détection
 * range parfois dans "other" (radiateur, chauffe-eau, escalier…). Renvoie les
 * catégories qui portent des `keywords`. La détection réassigne tout profil "other"
 * dont l'élément/description matche un mot-clé.
 */
export async function getCategoryKeywordRemap(): Promise<Array<{ slug: string; keywords: string[] }>> {
  const cats = await getElementCategories().catch(() => [] as ElementCategory[]);
  // Plus de filtre par pièce : un canapé remonté en "other" doit être remappé en `sofa`
  // même dans une chambre — voir getElementCategoryEnum.
  return cats
    .filter((c) => Array.isArray(c.keywords) && c.keywords.length > 0)
    .map((c) => ({ slug: c.slug, keywords: c.keywords! }));
}

export async function getAllowedActionsByCategory(): Promise<Map<string, DecisionAction[]>> {
  const cats = await getElementCategories().catch(() => [] as ElementCategory[]);
  return new Map(
    cats.map((c) => [c.slug, c.allowed_actions ?? ["keep", "customize", "replace"]]),
  );
}

/**
 * Construit le bloc {{categories}} injecté dans vision_detect_extended.
 *
 * TAXONOMIE COMPLÈTE, sans filtre par pièce. On filtrait avant sur `room_types`, si bien
 * qu'en « chambre » les catégories `sofa`, `coffee_table` et `tv_stand` n'existaient tout
 * simplement pas dans le vocabulaire du modèle : un salon déclaré par erreur en chambre
 * voyait son canapé rangé dans le fourre-tout `other`. Conséquences en cascade — on ne
 * pouvait ni le RETIRER (la liste « à retirer » compare des catégories), ni l'ACHETER
 * (pas de catégorie catalogue), ni le compter ; et le plan le clouait en « conservé »,
 * d'où un salon rendu pour une chambre demandée (incident 2026-07-13).
 *
 * On NOMME donc toujours ce qu'on voit. Le type de pièce sert ensuite à décider quoi en
 * faire (cf. room_defaults.removeCategories), jamais à décider si on a le droit de le voir.
 */
export async function getElementCategoryEnum(): Promise<string> {
  const cats = await getElementCategories().catch(() => [] as ElementCategory[]);
  if (cats.length === 0) return FALLBACK_CATEGORY_ENUM;

  // Liste PLATE `slug = libellé` : le slug (gauche du =) est la valeur de
  // `category`. On n'injecte PAS la famille ici (elle ne sert qu'au regroupement
  // UI) pour éviter que le modèle renvoie un nom de famille comme catégorie.
  return cats.map((c) => `- ${c.slug} = ${c.label_fr}`).join("\n");
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
