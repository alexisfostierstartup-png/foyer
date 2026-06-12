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

  return (
    <RenderScreen
      projectId={project.id}
      beforeUrl={project.basePhotoUrl}
      afterUrl={project.generatedRenderUrl}
      roomType={project.roomType}
    />
  );
}
