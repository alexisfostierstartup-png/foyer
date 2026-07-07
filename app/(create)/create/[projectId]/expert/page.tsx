import { redirect } from "next/navigation";
import { getProject } from "@/lib/storage/projects";
import { ExpertScreen } from "@/components/create/ExpertScreen";
import { selectExpertPieces } from "@/lib/ai/expert";
import { ensureFinalAssets } from "@/lib/ai/pipeline";
import type { ShoppingItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

export default async function ExpertPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) redirect("/create");
  // Le rendu expert part de la PHOTO DE BASE (vidée puis meublée), mais il a
  // besoin du matching : celui-ci est piloté par le rendu standard, donc on
  // exige qu'un rendu ait été généré (garantit que le flux a bien tourné).
  if (!project.generatedRenderUrl) redirect(`/create/${projectId}`);

  // Le flux expert saute l'écran /final : on calcule ici la liste shopping (matching)
  // dont le rendu expert a besoin pour connaître les vrais produits à intégrer.
  let shoppingList = (project.shoppingList as ShoppingItem[] | undefined) ?? [];
  if (shoppingList.length === 0) {
    const assets = await ensureFinalAssets(projectId).catch(() => null);
    shoppingList = assets?.shoppingList ?? shoppingList;
  }
  const pieces = selectExpertPieces(shoppingList);

  return (
    <ExpertScreen
      projectId={projectId}
      basePhotoUrl={project.basePhotoUrl}
      fakeUrl={project.generatedRenderUrl}
      initialExpertUrl={project.expertRenderUrl}
      products={pieces.map((p) => ({ category: p.category, name: p.name, imageUrl: p.imageUrl }))}
    />
  );
}
