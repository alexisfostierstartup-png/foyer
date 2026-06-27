import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProject, updateProject } from "@/lib/storage/projects";
import { ensureFinalAssets } from "@/lib/ai/pipeline";
import { PAYWALL_DISABLED } from "@/lib/constants";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  // ?full=1 → recalcule AUSSI l'analyse vision (Gemini). Par défaut : re-rank seul — on GARDE
  // renderAnalysis en cache → seulement matching Jina + scoring (~0 appel Gemini, bien plus rapide).
  const full = new URL(req.url).searchParams.get("full") === "1";

  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // En test (paywall désactivé) on autorise le refresh anonyme. Sinon : auth + ownership.
  if (!PAYWALL_DISABLED) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (project.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Reset de la liste (toujours) ; le cache vision (renderAnalysis) n'est purgé qu'en mode full.
  await updateProject(id, {
    shoppingList: undefined,
    scoreFoyer: undefined,
    builtShoppingList: undefined,
    ...(full ? { renderAnalysis: undefined } : {}),
  });
  const assets = await ensureFinalAssets(id);

  return NextResponse.json({
    shoppingList: assets?.shoppingList ?? [],
    scoreFoyer: assets?.scoreFoyer,
  });
}
