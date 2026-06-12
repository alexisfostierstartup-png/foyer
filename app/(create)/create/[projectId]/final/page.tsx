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

  await ensureFinalAssets(projectId);

  const updated = await getProject(projectId);

  return (
    <FinalScreen
      projectId={projectId}
      afterUrl={updated!.generatedRenderUrl!}
      shoppingList={updated?.shoppingList ?? []}
      scoreFoyer={updated?.scoreFoyer}
      visionOutput={updated?.visionOutput}
      alterations={updated?.alterations}
    />
  );
}
