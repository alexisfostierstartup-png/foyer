export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { getProject } from "@/lib/storage/projects";
import { StyleSelector } from "@/components/create/StyleSelector";
import { getAmbiances } from "@/lib/db/assets";

export default async function StylePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  if (!projectId) redirect("/create");

  const project = await getProject(projectId);
  if (!project) redirect("/create");

  const styles = await getAmbiances();

  return (
    <StyleSelector
      projectId={project.id}
      roomType={project.roomType}
      basePhotoUrl={project.basePhotoUrl}
      styles={styles}
    />
  );
}
