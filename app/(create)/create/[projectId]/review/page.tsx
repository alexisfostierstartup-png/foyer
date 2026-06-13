import { redirect } from "next/navigation";
import { getProject } from "@/lib/storage/projects";
import { ReviewScreen } from "@/components/create/ReviewScreen";
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

  return (
    <ReviewScreen
      projectId={projectId}
      initialDecisions={(project.element_decisions as ElementDecision[] | undefined) ?? null}
    />
  );
}
