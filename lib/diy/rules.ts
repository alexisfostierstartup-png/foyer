import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { DiyAction, ElementProfile } from "./types";

function matchesRequires(
  requires: DiyAction["requires"],
  profile: ElementProfile,
): boolean {
  if (requires.material_family && requires.material_family.length > 0) {
    if (!requires.material_family.includes(profile.material_family)) return false;
  }
  if (requires.surface_features && requires.surface_features.length > 0) {
    const hasAny = requires.surface_features.some((f) =>
      profile.surface_features.includes(f),
    );
    if (!hasAny) return false;
  }
  if (requires.condition && requires.condition.length > 0) {
    if (!requires.condition.includes(profile.condition)) return false;
  }
  return true;
}

function matchesExcludes(
  excludes: DiyAction["excludes"],
  profile: ElementProfile,
): boolean {
  if (excludes.material_family && excludes.material_family.length > 0) {
    if (excludes.material_family.includes(profile.material_family)) return true;
  }
  if (excludes.surface_features && excludes.surface_features.length > 0) {
    const hasAny = excludes.surface_features.some((f) =>
      profile.surface_features.includes(f),
    );
    if (hasAny) return true;
  }
  if (excludes.condition && excludes.condition.length > 0) {
    if (excludes.condition.includes(profile.condition)) return true;
  }
  return false;
}

export async function getCandidateActions(
  profile: ElementProfile,
  styleId: string,
): Promise<DiyAction[]> {
  const { data, error } = await createSupabaseAdmin()
    .from("diy_actions")
    .select("*")
    .eq("is_active", true)
    .contains("applies_to_categories", [profile.category]);

  if (error) {
    console.error("[diy/rules] getCandidateActions error:", error);
    return [];
  }

  const rows = (data ?? []) as DiyAction[];

  return rows
    .filter(
      (action) =>
        matchesRequires(action.requires, profile) &&
        !matchesExcludes(action.excludes, profile),
    )
    .sort((a, b) => {
      const scoreA = (a.style_affinity[styleId] ?? 0) as number;
      const scoreB = (b.style_affinity[styleId] ?? 0) as number;
      return scoreB - scoreA;
    })
    .slice(0, 10);
}
