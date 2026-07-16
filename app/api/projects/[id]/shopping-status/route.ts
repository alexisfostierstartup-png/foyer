import { NextResponse, after } from "next/server";
import { getProject } from "@/lib/storage/projects";
import { precomputeFinalAssets } from "@/lib/ai/pipeline";
import { resolveHotspots } from "@/lib/shopping/hotspots";

// Le GET est instantané, mais la relance éventuelle du calcul via after()
// tourne dans le budget de la route. 300 s (plafond Fluid Compute) : à 90 s, le
// calcul complet en prod (vision + Jina froid + matching) était TUÉ en plein vol
// puis relancé par le poll suivant, indéfiniment — « la liste met 2 minutes puis
// rien », pins jamais réparés (qepJGfvc, QA Alexis 2026-07-17).
export const maxDuration = 300;

/**
 * Statut de la liste de courses, pollé par la page /final en mode « préparation ».
 * Si aucun calcul n'est en cours (bail DB expiré — ex. crash ou 503 persistant),
 * on en relance un : le polling s'auto-répare au lieu de tourner à vide.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // ANALYSE (phase A) dès qu'elle existe pour le rendu affiché : les pins
  // (bboxes + squelette d'items) s'affichent PENDANT le matching, et surtout
  // SANS recharger la page — la prop serveur bboxById est figée d'avant le
  // calcul (pins invisibles même liste prête, QA Alexis 2026-07-11).
  const hotspots = resolveHotspots(project);
  const analysis = hotspots.bboxById ? hotspots : null;

  if (project.shoppingList) {
    // AUTO-GUÉRISON DES PINS : liste présente mais analyse absente/périmée pour le
    // rendu affiché (recalcul post-swap mort avec la lambda). ensureFinalAssets
    // sait la refaire depuis le 3c737d9 — mais AUCUN déclencheur ne l'appelait
    // quand la liste existait : ready=true court-circuitait tout, pins morts pour
    // toujours (qepJGfvc, QA Alexis 2026-07-17). Le poll répare désormais ici.
    if (!analysis) after(() => precomputeFinalAssets(id, "status-heal"));
    return NextResponse.json({
      ready: true,
      shoppingList: project.shoppingList,
      scoreFoyer: project.scoreFoyer,
      analysis,
    });
  }

  after(() => precomputeFinalAssets(id, "status"));
  return NextResponse.json({ ready: false, analysis });
}
