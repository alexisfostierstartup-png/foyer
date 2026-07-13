import { NextResponse, after } from "next/server";
import { getProject, updateProject } from "@/lib/storage/projects";
import { getRoomTypes } from "@/lib/db/assets";
import { precomputeDetection } from "@/lib/ai/pipeline";
import type { UserConstraints, CustomProduct, Project, RoomType } from "@/lib/types";

// La re-détection déclenchée par un changement de pièce tourne dans le budget de la route.
export const maxDuration = 60;

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
    roomType?: string;
  };
  const { customProducts, roomType, ...constraints } = body;
  const patch: Partial<Project> = { userConstraints: constraints as UserConstraints };

  // Le type de pièce était figé à l'upload : le corriger ensuite dans l'écran (« ah non,
  // c'est un salon, pas une chambre ») ne changeait RIEN au projet — l'interface montrait
  // le nouveau choix, la base gardait l'ancien. Or tout en dépend : la vision ne cherche
  // que les catégories de la pièce annoncée, donc en « chambre » ni canapé ni meuble TV
  // n'existent — ils tombent en « other » ou passent à la trappe, et la liste de courses
  // repropose des meubles pourtant conservés (QA 2026-07-13).
  let pieceChangee = false;
  if (typeof roomType === "string" && roomType !== project.roomType) {
    const valides = (await getRoomTypes()).map((r) => r.slug);
    if (valides.includes(roomType)) {
      patch.roomType = roomType as RoomType;
      // La détection déjà faite l'a été avec les catégories de l'ANCIENNE pièce → périmée.
      patch.visionOutput = undefined;
      patch.element_decisions = undefined;
      pieceChangee = true;
    }
  }

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

  // Relance la détection en fond avec les bonnes catégories, comme le fait l'upload.
  if (pieceChangee) after(() => precomputeDetection(id));

  return NextResponse.json({ ok: true });
}
