import { redirect } from "next/navigation";
import { getProject } from "@/lib/storage/projects";
import { GeneratingScreen } from "@/components/create/GeneratingScreen";

export default async function GeneratingPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  if (!projectId) redirect("/create");

  const project = await getProject(projectId);
  if (!project) redirect("/create");
  if (!project.selectedStyleId) redirect(`/create/style?projectId=${projectId}`);
  if (project.generatedRenderUrl) redirect(`/create/${projectId}`);

  return <GeneratingScreen projectId={projectId} />;
}
