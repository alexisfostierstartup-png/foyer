import { NextRequest, NextResponse } from "next/server";
import { runAnalysisPipeline } from "@/lib/ai/pipeline";
import { getProject } from "@/lib/storage/projects";
import { logPipelineError } from "@/lib/ai/logger";
import { isTransientAiError } from "@/lib/ai/retry";
import { getClientIp, checkRateLimit, RATE_LIMITED_BODY } from "@/lib/security/rateLimit";

export const maxDuration = 60;

export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  // Rate limit par IP : 2 appels vision Gemini par analyse, route sans auth.
  if (!(await checkRateLimit(getClientIp(_request), "analyze", 40))) {
    return NextResponse.json(RATE_LIMITED_BODY, { status: 429 });
  }

  // Résolution verdict (A/B perf) : query param direct, sinon cookie collant
  // foyer_vres (posé par le middleware quand ?vres=… est vu dans le flux), sinon
  // défaut env. Query > cookie > env.
  const vres =
    _request.nextUrl.searchParams.get("vres") ?? _request.cookies.get("foyer_vres")?.value;
  const verdictResolution = vres === "medium" ? "medium" : vres === "high" ? "high" : undefined;

  // IDEMPOTENCE — le projet a déjà ses décisions : on ne rejoue RIEN.
  //
  // Sans ce verrou, un simple re-montage de l'écran (rechargement, retour arrière,
  // hot-reload en dev) relançait l'analyse ; or runAnalysisPipeline applique
  // CLEAR_FINALIZE, qui EFFACE dispositionsRenderUrls — c'est-à-dire le verrou
  // d'idempotence de runDispositionsPipeline. Résultat : 3 dispositions payantes
  // regénérées pour rien (incident 2026-07-13, projet O0DNBvO — 6 renders au lieu de 3).
  // Le garde-fou vit ICI, côté serveur : les écrans ne peuvent pas se coordonner entre
  // deux montages, la base si.
  //
  // ?force=1 pour re-analyser volontairement (changement de pièce, mise au point).
  const force = _request.nextUrl.searchParams.get("force") === "1";
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  }
  if (!force && (project.element_decisions?.length ?? 0) > 0) {
    return NextResponse.json({ ok: true, projectId: id, skipped: true });
  }

  try {
    await runAnalysisPipeline(id, { verdictResolution });
    return NextResponse.json({ ok: true, projectId: id });
  } catch (err) {
    console.error("[analyze] pipeline error:", err);
    await logPipelineError(id, "analyze", err);
    // Message propre, jamais l'erreur brute du provider IA.
    const message = isTransientAiError(err)
      ? "Le service IA est très demandé en ce moment. Réessayez dans quelques instants."
      : "L'analyse de la pièce a échoué. Réessayez ou changez la photo.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
