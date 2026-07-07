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
  // Le rendu expert reprend la disposition choisie : il faut un rendu de base.
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
      beforeUrl={project.generatedRenderUrl}
      initialExpertUrl={project.expertRenderUrl}
      products={pieces.map((p) => ({ category: p.category, name: p.name, imageUrl: p.imageUrl }))}
    />
  );
}
