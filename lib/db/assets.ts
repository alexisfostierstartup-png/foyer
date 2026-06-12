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
