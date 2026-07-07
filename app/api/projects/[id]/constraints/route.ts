import { NextResponse } from "next/server";
import { getProject, updateProject } from "@/lib/storage/projects";
import type { UserConstraints, CustomProduct, Project } from "@/lib/types";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  }

  const body = (await request.json()) as UserConstraints & {
    customProducts?: Record<string, CustomProduct>;
  };
  const { customProducts, ...constraints } = body;
  const patch: Partial<Project> = { userConstraints: constraints as UserConstraints };

  // Flux expert : produits fournis dès l'upload (par catégorie). imageUrl http(s) obligatoire.
  if (customProducts && typeof customProducts === "object") {
    const clean: Record<string, CustomProduct> = {};
    for (const [k, v] of Object.entries(customProducts)) {
      if (v && typeof v.imageUrl === "string" && /^https?:\/\//.test(v.imageUrl)) {
        clean[k] = { imageUrl: v.imageUrl, name: v.name ?? null, price: v.price ?? null, url: v.url ?? null, merchant: v.merchant ?? null };
      }
    }
    if (Object.keys(clean).length) patch.customProducts = clean;
  }

  await updateProject(id, patch);
  return NextResponse.json({ ok: true });
}
