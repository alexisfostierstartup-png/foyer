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

  return (
    <FinalScreen
      projectId={projectId}
      beforeUrl={project.basePhotoUrl}
      afterUrl={project.generatedRenderUrl!}
      shoppingList={project.shoppingList ?? []}
      scoreFoyer={project.scoreFoyer}
      visionOutput={project.visionOutput}
      alterations={project.alterations}
      liveEditsUsed={project.live_edits_used ?? 0}
      pendingList={pendingList}
    />
  );
}
