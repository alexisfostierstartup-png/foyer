import { redirect } from "next/navigation";
import { getProject } from "@/lib/storage/projects";
import { ReviewScreen } from "@/components/create/ReviewScreen";
import { getAllowedActionsByCategory } from "@/lib/db/assets";
import type { ElementDecision } from "@/lib/diy/types";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProject(projectId);
  if (!project) redirect("/create");
  if (!project.selectedStyleId) redirect(`/create/style?projectId=${projectId}`);
  if (project.generatedRenderUrl) redirect(`/create/${projectId}`);

  // Actions autorisées par catégorie → la review ne propose que des actions
  // pertinentes (ex. assise = garder/remplacer, fenêtre = garder).
  const allowedByCategory = Object.fromEntries(await getAllowedActionsByCategory());

  return (
    <ReviewScreen
      projectId={projectId}
      initialDecisions={(project.element_decisions as ElementDecision[] | undefined) ?? null}
      allowedByCategory={allowedByCategory}
    />
  );
}
