import { NextResponse } from "next/server";
import { getProject, updateProject } from "@/lib/storage/projects";
import { getAmbianceById } from "@/lib/db/assets";

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
  // Valide contre la MÊME source que le sélecteur (assets ambiance actifs en DB)
  // — la whitelist statique data/styles.json driftait à chaque rename DB
  // (bug campagne-francaise 2026-07-10 : visible dans l'UI, refusé ici en 400).
  const style =
    typeof styleId === "string" ? await getAmbianceById(styleId) : null;
  if (!style) {
    return NextResponse.json({ error: "Ambiance inconnue" }, { status: 400 });
  }

  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  }

  await updateProject(id, { selectedStyleId: styleId as string });
  return NextResponse.json({ ok: true });
}
