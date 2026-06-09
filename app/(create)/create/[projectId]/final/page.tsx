import { redirect } from "next/navigation";
import { getProject } from "@/lib/storage/projects";
import { FinalScreen } from "@/components/create/FinalScreen";

export default async function FinalPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProject(projectId);
  if (!project) redirect("/create");
  if (!project.generatedRenderUrl) redirect(`/create/${projectId}`);

  return (
    <FinalScreen
      projectId={project.id}
      beforeUrl={project.basePhotoUrl}
      afterUrl={project.generatedRenderUrl}
      furniture={project.detectedFurniture}
    />
  );
}
