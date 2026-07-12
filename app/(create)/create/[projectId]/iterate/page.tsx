import { redirect } from "next/navigation";
import { getProject } from "@/lib/storage/projects";
import { IterateScreen } from "@/components/create/IterateScreen";

export default async function IteratePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ target?: string; label?: string }>;
}) {
  const { projectId } = await params;
  const { target, label } = await searchParams;

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
      target={target && label ? { elementId: target, label } : null}
    />
  );
}
