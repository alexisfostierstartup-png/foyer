import { NextResponse } from "next/server";
import { getProject, updateProject } from "@/lib/storage/projects";

export const maxDuration = 30;

// α-5 stub — waits 3s, keeps the existing render.
// Will be replaced by real Nano Banana iteration pipeline in α-6.
function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  }
  if (!project.generatedRenderUrl) {
    return NextResponse.json({ error: "Aucun rendu à itérer" }, { status: 400 });
  }

  const { userRequest } = (await request.json()) as { userRequest: string };
  if (!userRequest?.trim()) {
    return NextResponse.json({ error: "userRequest manquant" }, { status: 400 });
  }

  await sleep(3000);

  // For now, keep the same render URL.
  // In α-6, this will call generateWowRender with the iteration context.
  await updateProject(id, {
    // no render change in stub
  });

  return NextResponse.json({ ok: true, projectId: id });
}
