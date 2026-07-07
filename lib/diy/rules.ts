import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { DiyAction, DiyMode, ElementProfile } from "./types";

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

// Options du flux DIY beta (?diy=beta). Absentes = flux standard inchangé.
export type DiyActionOptions = {
  mode?: DiyMode;
  // Niveau bricoleur max de l'user (mode beta). Défaut 1 = néophyte.
  maxLevel?: number;
};

export async function getAllDiyActions(opts?: DiyActionOptions): Promise<DiyAction[]> {
  const query = createSupabaseAdmin().from("diy_actions").select("*");
  const { data, error } =
    opts?.mode === "beta"
      ? await query.or("is_active.eq.true,beta.eq.true")
      : await query.eq("is_active", true);

  if (error) {
    console.error("[diy/rules] getAllDiyActions error:", error);
    return [];
  }
  return (data ?? []) as DiyAction[];
}

/**
 * Catégories effectives d'une action : en mode beta, les beta_categories sont
 * mergées ; le flux standard ne voit que applies_to_categories.
 */
export function effectiveCategories(action: DiyAction, mode: DiyMode): string[] {
  if (mode !== "beta") return action.applies_to_categories;
  return [...action.applies_to_categories, ...(action.beta_categories ?? [])];
}

/**
 * Filtrage des candidats — pur (testable), appliqué après la requête.
 * Standard : catégorie + requires/excludes + tri affinité (comportement
 * historique inchangé). Beta, en plus : merge beta_categories, filtre
 * level ≤ maxLevel, exclusion dure style_affinity < 0.
 */
export function filterCandidateActions(
  rows: DiyAction[],
  profile: ElementProfile,
  styleId: string,
  opts?: DiyActionOptions,
): DiyAction[] {
  const beta = opts?.mode === "beta";
  const maxLevel = opts?.maxLevel ?? 1;

  return rows
    .filter((action) => effectiveCategories(action, opts?.mode).includes(profile.category))
    .filter(
      (action) =>
        matchesRequires(action.requires, profile) &&
        !matchesExcludes(action.excludes, profile),
    )
    .filter((action) => {
      if (!beta) return true;
      if ((action.level ?? 1) > maxLevel) return false;
      // Exclusion dure par style : affinité négative = jamais candidat.
      if (((action.style_affinity[styleId] ?? 0) as number) < 0) return false;
      return true;
    })
    .sort((a, b) => {
      const scoreA = (a.style_affinity[styleId] ?? 0) as number;
      const scoreB = (b.style_affinity[styleId] ?? 0) as number;
      return scoreB - scoreA;
    })
    .slice(0, 10);
}

/**
 * Slugs des actions dont le rendu image fidèle est validé (renderable=true),
 * actions beta incluses. Utilisé par formatDesignPlan en mode beta pour
 * décider RESTYLE visible vs dégradation en REPLACE.
 */
export async function getRenderableActionSlugs(): Promise<Set<string>> {
  const { data, error } = await createSupabaseAdmin()
    .from("diy_actions")
    .select("slug")
    .eq("renderable", true);
  if (error) {
    console.error("[diy/rules] getRenderableActionSlugs error:", error);
    return new Set();
  }
  return new Set((data ?? []).map((r) => (r as { slug: string }).slug));
}

export async function getCandidateActions(
  profile: ElementProfile,
  styleId: string,
  opts?: DiyActionOptions,
): Promise<DiyAction[]> {
  // Standard : requête historique inchangée (filtre catégorie en SQL).
  // Beta : le match catégorie doit couvrir applies_to_categories ∪
  // beta_categories → fetch élargi puis filtrage en JS (table petite).
  const base = createSupabaseAdmin().from("diy_actions").select("*");
  const { data, error } =
    opts?.mode === "beta"
      ? await base.or("is_active.eq.true,beta.eq.true")
      : await base.eq("is_active", true).contains("applies_to_categories", [profile.category]);

  if (error) {
    console.error("[diy/rules] getCandidateActions error:", error);
    return [];
  }

  return filterCandidateActions((data ?? []) as DiyAction[], profile, styleId, opts);
}
