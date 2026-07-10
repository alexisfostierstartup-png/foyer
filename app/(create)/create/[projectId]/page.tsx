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

  // Parcours expert COURT (2026-07-09) : plus d'écran intermédiaire — la liste
  // shoppable (/final) est l'écran terminal et affiche le rendu expert.
  if (project.mode === "expert") redirect(`/create/${projectId}/final`);

  return (
    <RenderScreen
      projectId={project.id}
      beforeUrl={project.basePhotoUrl}
      afterUrl={project.generatedRenderUrl}
      roomType={project.roomType}
    />
  );
}
