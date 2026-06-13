import { NextRequest, NextResponse } from "next/server";
import { getProject, updateProject } from "@/lib/storage/projects";
import type { ElementDecision, MismatchType } from "@/lib/diy/types";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ decisions: project.element_decisions ?? [] });
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json() as { overrides?: Record<string, MismatchType> };
  const overrides = body.overrides ?? {};

  const current = (project.element_decisions ?? []) as ElementDecision[];
  const updated = current.map((d) => {
    if (d.element_id in overrides) {
      return { ...d, mismatch_type: overrides[d.element_id], override: true };
    }
    return d;
  });

  await updateProject(id, { element_decisions: updated });
  return NextResponse.json({ ok: true, decisions: updated });
}
