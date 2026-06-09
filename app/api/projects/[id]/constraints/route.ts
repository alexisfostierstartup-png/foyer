import { NextResponse } from "next/server";
import { getProject, updateProject } from "@/lib/storage/projects";
import type { UserConstraints } from "@/lib/types";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  }

  const body = (await request.json()) as UserConstraints;
  await updateProject(id, { userConstraints: body });

  return NextResponse.json({ ok: true });
}
