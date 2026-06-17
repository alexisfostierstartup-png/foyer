import { NextRequest, NextResponse } from "next/server";
import { getProject, updateProject } from "@/lib/storage/projects";

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

  return NextResponse.json({ ok: true });
}
