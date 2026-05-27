import { redirect } from "next/navigation";
import { getProject } from "@/lib/storage/projects";
import { StyleSelector } from "@/components/create/StyleSelector";
import stylesData from "@/data/styles.json";
import type { Style } from "@/lib/types";

const STYLES = stylesData as Style[];

export default async function StylePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  if (!projectId) redirect("/create");

  const project = await getProject(projectId);
  if (!project) redirect("/create");

  return (
    <StyleSelector
      projectId={project.id}
      roomType={project.roomType}
      basePhotoUrl={project.basePhotoUrl}
      styles={STYLES}
    />
  );
}
