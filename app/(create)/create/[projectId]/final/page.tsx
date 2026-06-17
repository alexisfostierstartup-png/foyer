import { redirect } from "next/navigation";
import { getProject } from "@/lib/storage/projects";
import { FinalScreen } from "@/components/create/FinalScreen";
import { ensureFinalAssets } from "@/lib/ai/pipeline";

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

  // Renvoie la liste fraîchement calculée → on l'utilise directement, sans
  // dépendre d'une relecture DB qui peut être en retard (réplique) et afficher
  // une liste vide au 1er chargement.
  const assets = await ensureFinalAssets(projectId);

  const updated = await getProject(projectId);

  return (
    <FinalScreen
      projectId={projectId}
      beforeUrl={updated!.basePhotoUrl}
      afterUrl={updated!.generatedRenderUrl!}
      shoppingList={assets?.shoppingList ?? updated?.shoppingList ?? []}
      scoreFoyer={assets?.scoreFoyer ?? updated?.scoreFoyer}
      visionOutput={updated?.visionOutput}
      alterations={updated?.alterations}
      liveEditsUsed={updated?.live_edits_used ?? 0}
    />
  );
}
