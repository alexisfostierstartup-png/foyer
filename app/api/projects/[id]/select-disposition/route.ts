import { NextRequest, NextResponse, after } from "next/server";
import { getProject, updateProject } from "@/lib/storage/projects";
import { precomputeFinalAssets } from "@/lib/ai/pipeline";

// Le POST lui-même est instantané, mais le précalcul shopping déclenché via after()
// tourne dans le budget de la route → même maxDuration que generate/iterate.
export const maxDuration = 90;

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { url } = (await request.json()) as { url?: string };
  // Sécurité : on n'accepte qu'une des dispositions réellement générées.
  if (!url || !(project.dispositionsRenderUrls ?? []).includes(url)) {
    return NextResponse.json({ error: "invalid_disposition" }, { status: 400 });
  }

  // La disposition choisie devient le rendu courant. On réinitialise les
  // artefacts dérivés (shopping/audit) pour qu'ils soient recalculés dessus.
  await updateProject(id, {
    generatedRenderUrl: url,
    firstRenderUrl: url,
    iterationCount: 0,
    applicationAudit: undefined,
    reconciledPlan: undefined,
    builtShoppingList: undefined,
    shoppingList: undefined,
    scoreFoyer: undefined,
    alterations: undefined,
  });

  // La disposition choisie est le rendu courant → précalcul shopping en fond
  // pendant que le user la regarde/itère (levier perf 1).
  after(() => precomputeFinalAssets(id, "select-disposition"));

  return NextResponse.json({ ok: true });
}
