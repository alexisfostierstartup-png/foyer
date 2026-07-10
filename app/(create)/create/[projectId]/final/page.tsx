import { redirect } from "next/navigation";
import { after } from "next/server";
import { getProject } from "@/lib/storage/projects";
import { FinalScreen } from "@/components/create/FinalScreen";
import { precomputeFinalAssets } from "@/lib/ai/pipeline";

export const maxDuration = 90;

export default async function FinalPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProject(projectId);
  if (!project) redirect("/create");
  if (!project.generatedRenderUrl) redirect(`/create/${projectId}`);

  // La page ne BLOQUE plus sur le calcul de la liste (30-50 s de page blanche) :
  //  - liste en cache (précalcul de fond terminé) → rendu complet immédiat ;
  //  - sinon → rendu immédiat en mode « préparation » : le calcul continue/part
  //    en fond (bail DB anti-doublon) et FinalScreen polle /shopping-status
  //    jusqu'à l'arrivée de la liste.
  const pendingList = !project.shoppingList;
  if (pendingList) {
    after(() => precomputeFinalAssets(projectId, "final-page"));
  }

  // Expert : la liste de courses montre le rendu RÉEL (produits intégrés), pas le fictif.
  const displayRenderUrl =
    project.mode === "expert" && project.expertRenderUrl
      ? project.expertRenderUrl
      : project.generatedRenderUrl!;

  // Hotspots (dots sur le rendu) : bboxes de l'audit — seulement si l'analyse
  // correspond au rendu AFFICHÉ (une itération invalide les anciennes positions).
  const bboxById =
    project.renderAnalysis && project.renderAnalysis.renderUrl === displayRenderUrl
      ? project.renderAnalysis.bboxById
      : null;

  return (
    <FinalScreen
      projectId={projectId}
      beforeUrl={project.basePhotoUrl}
      afterUrl={displayRenderUrl}
      shoppingList={project.shoppingList ?? []}
      scoreFoyer={project.scoreFoyer}
      visionOutput={project.visionOutput}
      alterations={project.alterations}
      liveEditsUsed={project.live_edits_used ?? 0}
      pendingList={pendingList}
      expertMode={project.mode === "expert"}
      fakeRenderUrl={project.mode === "expert" && project.expertRenderUrl ? project.generatedRenderUrl : null}
      diyBeta={project.diyMode === "beta"}
      bboxById={bboxById}
      productOverrides={project.productOverrides ?? null}
      customProducts={project.customProducts ?? null}
    />
  );
}
