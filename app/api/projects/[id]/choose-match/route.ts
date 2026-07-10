import { NextResponse } from "next/server";
import { getProject, updateProject } from "@/lib/storage/projects";
import type { ShoppingItem } from "@/lib/types";

// Choix utilisateur d'un produit parmi les matches d'une ligne (hotspot /final) :
// le produit choisi devient matches[0] — AUCUN recalcul, simple réordonnancement,
// persisté sur shoppingList ET lockedShoppingList (le choix survit au verrou).
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const { elementId, matchIdx } = (await request.json()) as { elementId?: string; matchIdx?: number };
  if (typeof elementId !== "string" || !Number.isInteger(matchIdx) || matchIdx! < 0 || matchIdx! > 15) {
    return NextResponse.json({ error: "elementId/matchIdx invalides" }, { status: 400 });
  }

  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });

  const reorder = (list: ShoppingItem[] | null | undefined): ShoppingItem[] | null => {
    if (!list?.length) return list ?? null;
    return list.map((it) => {
      if (it.elementId !== elementId || !it.matches || matchIdx! >= it.matches.length) return it;
      const chosen = it.matches[matchIdx!];
      return { ...it, matches: [chosen, ...it.matches.filter((_, i) => i !== matchIdx)] };
    });
  };

  await updateProject(id, {
    shoppingList: reorder(project.shoppingList) ?? undefined,
    lockedShoppingList: reorder(project.lockedShoppingList),
  });
  return NextResponse.json({ ok: true });
}
