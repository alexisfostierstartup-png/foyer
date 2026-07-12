import { redirect } from "next/navigation";
import { getProject } from "@/lib/storage/projects";
import { getRoomTypes } from "@/lib/db/assets";
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

  // Libellé FR = source de vérité room_defaults (data-driven, cf. picker de pièce) —
  // remplace un binaire chambre/salon qui affichait "Voilà votre salon" pour tout
  // roomType hors "chambre" (bug pour chambre_parentale/chambre_enfant).
  const roomTypes = await getRoomTypes();
  const roomLabel = roomTypes.find((r) => r.slug === project.roomType)?.label.toLowerCase() ?? "pièce";

  return (
    <RenderScreen
      projectId={project.id}
      beforeUrl={project.basePhotoUrl}
      afterUrl={project.generatedRenderUrl}
      roomLabel={roomLabel}
    />
  );
}
