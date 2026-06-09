import { NextResponse } from "next/server";
import { getProject, updateProject } from "@/lib/storage/projects";
import type { DetectedFurniture } from "@/lib/types";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  }

  const { furniture } = (await request.json()) as { furniture: DetectedFurniture[] };
  await updateProject(id, { detectedFurniture: furniture });

  return NextResponse.json({ ok: true });
}
