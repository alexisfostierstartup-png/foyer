import { redirect } from "next/navigation";
import { getProject } from "@/lib/storage/projects";
import { IterateScreen } from "@/components/create/IterateScreen";

export default async function IteratePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProject(projectId);
  if (!project) redirect("/create");
  if (!project.generatedRenderUrl) redirect(`/create/${projectId}`);

  // Expert : on itère sur le rendu RÉEL (produits intégrés), pas le fictif.
  const isExpert = project.mode === "expert";
  const currentRenderUrl =
    isExpert && project.expertRenderUrl ? project.expertRenderUrl : project.generatedRenderUrl;

  return (
    <IterateScreen
      projectId={projectId}
      currentRenderUrl={currentRenderUrl}
      expert={isExpert}
    />
  );
}
