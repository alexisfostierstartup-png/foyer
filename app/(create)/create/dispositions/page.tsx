import { redirect } from "next/navigation";
import { getProject } from "@/lib/storage/projects";
import { DispositionsScreen } from "@/components/create/DispositionsScreen";

export default async function DispositionsPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  if (!projectId) redirect("/create");

  const project = await getProject(projectId);
  if (!project) redirect("/create");
  if (!project.selectedStyleId) redirect(`/create/style?projectId=${projectId}`);

  // Si déjà généré, on réaffiche sans relancer d'appel.
  return (
    <DispositionsScreen
      projectId={projectId}
      initialUrls={project.dispositionsRenderUrls}
    />
  );
}
