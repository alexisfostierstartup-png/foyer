import { NextRequest, NextResponse, after } from "next/server";
import { getProject, updateProject } from "@/lib/storage/projects";
import { precomputeFinalAssets, CLEAR_FINALIZE } from "@/lib/ai/pipeline";

// Le POST lui-même est instantané, mais le précalcul shopping déclenché via after()
// tourne dans le budget de la route → même maxDuration que generate/iterate.
export const maxDuration = 300; // plafond Fluid Compute — à 90 s, le calcul liste+pins en prod (vision + Jina froid + matching, parfois >90 s) était tué en plein vol et bouclait (QA Alexis 2026-07-17)

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { url } = (await request.json()) as { url?: string };
  // Sécurité : on n'accepte qu'une des dispositions réellement générées.
  if (!url || !(project.dispositionsRenderUrls ?? []).includes(url)) {
    return NextResponse.json({ error: "invalid_disposition" }, { status: 400 });
  }

  // La disposition choisie devient le rendu courant. On réinitialise les
  // artefacts dérivés (shopping/audit) via CLEAR_FINALIZE (source unique — évite
  // la dérive si un champ dérivé est ajouté au reset côté pipeline).
  await updateProject(id, {
    generatedRenderUrl: url,
    firstRenderUrl: url,
    iterationCount: 0,
    ...CLEAR_FINALIZE,
    // …SAUF les dispositions : CLEAR_FINALIZE est pensé pour un NOUVEAU rendu, qui
    // les invalide. Ici le rendu choisi EST l'une d'elles — le trio reste valide.
    // L'effacer cassait le verrou d'idempotence : flèche retour du navigateur →
    // page dispositions → 3 régénérations payantes pour revoir les mêmes choix
    // (QA Alexis 2026-07-16, projet ND5qBys). Revenir en arrière doit RÉAFFICHER.
    dispositionsRenderUrls: project.dispositionsRenderUrls,
  });

  // La disposition choisie est le rendu courant → précalcul shopping en fond
  // pendant que le user la regarde/itère (levier perf 1).
  after(() => precomputeFinalAssets(id, "select-disposition"));

  return NextResponse.json({ ok: true });
}
