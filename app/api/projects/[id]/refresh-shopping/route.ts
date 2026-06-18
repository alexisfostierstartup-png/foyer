import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProject, updateProject } from "@/lib/storage/projects";
import { ensureFinalAssets } from "@/lib/ai/pipeline";

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

  // Reset puis recalcul via la même logique que la page finale (décisions gate +
  // confirmation visuelle sur le rendu courant).
  await updateProject(id, { shoppingList: undefined, scoreFoyer: undefined, builtShoppingList: undefined });
  const assets = await ensureFinalAssets(id);

  return NextResponse.json({
    shoppingList: assets?.shoppingList ?? [],
    scoreFoyer: assets?.scoreFoyer,
  });
}
