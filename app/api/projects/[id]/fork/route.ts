import { NextResponse } from "next/server";
import { forkProject } from "@/lib/storage/fork";
import { getClientIp, checkRateLimit, RATE_LIMITED_BODY } from "@/lib/security/rateLimit";

export const maxDuration = 60;

/**
 * Duplique un projet en copie de travail et renvoie l'id de la copie.
 *
 * Sert au CTA « Modifier ce projet » des dossiers pro : les projets qui y sont illustrés
 * sont des MASTERS montrés au client, ils ne doivent jamais bouger. On ouvre donc le
 * parcours d'édition sur une copie (dossier de stockage distinct, images dupliquées).
 *
 * Aucune génération IA ici : ça ne coûte qu'une copie de fichiers.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  if (!(await checkRateLimit(getClientIp(request), "fork", 30))) {
    return NextResponse.json(RATE_LIMITED_BODY, { status: 429 });
  }

  try {
    const copieId = await forkProject(id);
    return NextResponse.json({ id: copieId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "erreur inconnue";
    console.error("[fork]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
