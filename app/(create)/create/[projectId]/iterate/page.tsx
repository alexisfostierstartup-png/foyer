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

  return <IterateScreen projectId={projectId} />;
}
