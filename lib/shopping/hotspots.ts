import type { Project, RenderAnalysis } from "@/lib/types";

export type ResolvedHotspots = {
  bboxById: RenderAnalysis["bboxById"] | null;
  // Point d'ancrage par élément (posé SUR l'objet) — prime sur le centre de la bbox.
  anchorById: RenderAnalysis["anchorById"] | null;
  items: RenderAnalysis["items"] | null;
};

const EMPTY: ResolvedHotspots = { bboxById: null, anchorById: null, items: null };

/**
 * Bboxes + squelette d'items à poser sur le rendu AFFICHÉ.
 *
 * Le rendu affiché n'est pas toujours celui qui a été analysé : en expert on
 * montre `expertRenderUrl`, alors que l'analyse porte sur `generatedRenderUrl`
 * (le fake). Comparer bêtement les deux URL rendait `bboxById` null sur TOUT
 * projet expert — bboxes bien présentes en base, jetées à l'affichage, zéro pin
 * (QA Alexis 2026-07-11). Le rendu expert étant DÉRIVÉ du fake par swap sur
 * place (même composition, ratio verrouillé sur le fake dans swapOnFake), les
 * bboxes du fake y restent valides : on les accepte.
 *
 * Une ITÉRATION, elle, produit un rendu qui n'est ni le fake ni son dérivé : les
 * positions ne valent plus rien, on ne pose aucun pin plutôt que de les poser au
 * mauvais endroit.
 *
 * Un seul point de vérité : la page /final et la route /shopping-status
 * dupliquaient ce test, donc le bug vivait en double.
 */
export function resolveHotspots(project: Project): ResolvedHotspots {
  const analysis = project.renderAnalysis;
  if (!analysis) return EMPTY;

  const displayed =
    project.mode === "expert" && project.expertRenderUrl
      ? project.expertRenderUrl
      : project.generatedRenderUrl;

  const matchesDisplayed = analysis.renderUrl === displayed;
  const derivedFromAnalyzedFake =
    project.mode === "expert" && analysis.renderUrl === project.generatedRenderUrl;

  if (!matchesDisplayed && !derivedFromAnalyzedFake) return EMPTY;

  return {
    bboxById: analysis.bboxById,
    anchorById: analysis.anchorById ?? null,
    items: analysis.items ?? null,
  };
}
