import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProject, updateProject } from "@/lib/storage/projects";
import { extractAlterations, matchAndSaveShoppingList } from "@/lib/ai/pipeline";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (project.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Reset list ET alterations → re-diff AVANT/APRÈS sur le rendu COURANT,
  // puis re-match. Garantit une liste exacte vis-à-vis du rendu actuel.
  await updateProject(id, { shoppingList: undefined, scoreFoyer: undefined, alterations: undefined });
  await extractAlterations(id);
  await matchAndSaveShoppingList(id);

  const updated = await getProject(id);
  return NextResponse.json({
    shoppingList: updated?.shoppingList ?? [],
    scoreFoyer: updated?.scoreFoyer,
  });
}
