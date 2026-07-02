import { NextResponse, after } from "next/server";
import { getProject } from "@/lib/storage/projects";
import { precomputeFinalAssets } from "@/lib/ai/pipeline";

// Le GET est instantané, mais la relance éventuelle du calcul via after()
// tourne dans le budget de la route.
export const maxDuration = 90;

/**
 * Statut de la liste de courses, pollé par la page /final en mode « préparation ».
 * Si aucun calcul n'est en cours (bail DB expiré — ex. crash ou 503 persistant),
 * on en relance un : le polling s'auto-répare au lieu de tourner à vide.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (project.shoppingList) {
    return NextResponse.json({
      ready: true,
      shoppingList: project.shoppingList,
      scoreFoyer: project.scoreFoyer,
    });
  }

  after(() => precomputeFinalAssets(id, "status"));
  return NextResponse.json({ ready: false });
}
