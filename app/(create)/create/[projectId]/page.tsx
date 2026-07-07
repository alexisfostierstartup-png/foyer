import { redirect } from "next/navigation";
import { getProject } from "@/lib/storage/projects";
import { RenderScreen } from "@/components/create/RenderScreen";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProject(projectId);
  if (!project) redirect("/create");
  if (!project.generatedRenderUrl) redirect(`/create/generating?projectId=${projectId}`);

  // Flux expert : on NE MONTRE PAS le rendu fictif (fake). On file directement au
  // rendu RÉEL (produits + décisions), qui affichera le fake en survol pour la dérive.
  if (project.mode === "expert") redirect(`/create/${projectId}/expert`);

  return (
    <RenderScreen
      projectId={project.id}
      beforeUrl={project.basePhotoUrl}
      afterUrl={project.generatedRenderUrl}
      roomType={project.roomType}
    />
  );
}
