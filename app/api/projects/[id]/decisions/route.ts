import { NextRequest, NextResponse } from "next/server";
import { getProject, updateProject } from "@/lib/storage/projects";
import type { ElementDecision, ElementProfile, MismatchType } from "@/lib/diy/types";
import { getAllDiyActions, getCandidateActions } from "@/lib/diy/rules";
import { resolveElementDecision } from "@/lib/ai/pipeline";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ decisions: project.element_decisions ?? [] });
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json() as { overrides?: Record<string, MismatchType> };
  const overrides = body.overrides ?? {};

  const current = (project.element_decisions ?? []) as ElementDecision[];
  const updated = current.map((d) => {
    if (d.element_id in overrides) {
      // On réinitialise l'action liée à l'ancien verdict : sinon un élément forcé
      // en "customize"/"replace" garderait un action_label périmé (ex. "Conserver
      // …") que formatDesignPlan injecterait tel quel dans le prompt → contradiction
      // et override sans effet. Vidé → formatDesignPlan utilise sa consigne générique.
      return {
        ...d,
        mismatch_type: overrides[d.element_id],
        override: true,
        action_slug: null,
        action_label: null,
        supply_items: null,
        qty: null,
      };
    }
    return d;
  });

  // Mode DIY beta : un override « Personnaliser » sans action produit une ligne
  // RESTYLE vide de sens (« personnaliser la finition… ») que le modèle image
  // n'exécute pas (constaté projet vLkE2sZ5…). On attache la meilleure action
  // candidate déterministe (slug + label + fournitures/quantités résolues) —
  // même fallback que le pipeline applique aux slugs invalides du verdict.
  // Flux standard inchangé (action laissée vide, comportement historique).
  if (project.diyMode === "beta") {
    const profiles = (Array.isArray(project.visionOutput) ? project.visionOutput : []) as ElementProfile[];
    const profileById = new Map(profiles.map((p) => [p.element_id, p]));
    const styleId = project.selectedStyleId;
    if (styleId && profileById.size > 0) {
      const allActions = await getAllDiyActions({ mode: "beta" });
      const actionMap = new Map(allActions.map((a) => [a.slug, a]));
      for (let i = 0; i < updated.length; i++) {
        const d = updated[i];
        if (!(d.element_id in overrides)) continue;
        if (d.mismatch_type !== "surface" || d.action_slug) continue;
        const profile = profileById.get(d.element_id);
        if (!profile) continue;
        const [best] = await getCandidateActions(profile, styleId, { mode: "beta" });
        if (!best) continue; // aucune action applicable → RESTYLE générique (fix formatDesignPlan)
        updated[i] = {
          ...(await resolveElementDecision(
            {
              element_id: d.element_id,
              mismatch_type: "surface",
              action_slug: best.slug,
              action_label: `${best.label} — finition accordée au style`,
              action_label_en: `${best.label_en ?? best.label} — finish matched to the style`,
            },
            profile,
            actionMap,
          )),
          override: true,
        };
      }
    }
  }

  await updateProject(id, { element_decisions: updated });
  return NextResponse.json({ ok: true, decisions: updated });
}
