import { NextResponse } from "next/server";
import { getProject, updateProject } from "@/lib/storage/projects";
import stylesData from "@/data/styles.json";

const STYLE_IDS = new Set((stylesData as { slug: string }[]).map((s) => s.slug));

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  let body: { styleId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const styleId = body.styleId;
  if (typeof styleId !== "string" || !STYLE_IDS.has(styleId)) {
    return NextResponse.json({ error: "Ambiance inconnue" }, { status: 400 });
  }

  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  }

  await updateProject(id, { selectedStyleId: styleId });
  return NextResponse.json({ ok: true });
}
