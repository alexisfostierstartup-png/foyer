import { NextResponse, after } from "next/server";
import { precomputeFinalAssets, ensureFinalAssets, runIterationPipeline } from "@/lib/ai/pipeline";
import { runExpertIteration, reintegrateExpertAdditions, reintegrateExpertSurfaces } from "@/lib/ai/expert";
import { getProject } from "@/lib/storage/projects";
import { logPipelineError } from "@/lib/ai/logger";
import { getClientIp, checkRateLimit, RATE_LIMITED_BODY } from "@/lib/security/rateLimit";

export const maxDuration = 90;

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  // Rate limit par IP : les itérations déclenchent une génération d'image (coût
  // Gemini) et la route n'a pas d'auth → seul garde-fou anti-abus anonyme.
  if (!(await checkRateLimit(getClientIp(request), "iterate", 25))) {
    return NextResponse.json(RATE_LIMITED_BODY, { status: 429 });
  }

  const { userRequest, targetElementIds, targetLabel } = (await request.json()) as {
    userRequest: string;
    // Tap-to-target : élément désigné sur le rendu (libération précise du verrou).
    targetElementIds?: string[];
    targetLabel?: string;
  };

  if (!userRequest?.trim()) {
    return NextResponse.json({ error: "userRequest manquant" }, { status: 400 });
  }
  const target =
    Array.isArray(targetElementIds) && targetElementIds.length > 0 && targetElementIds.every((t) => typeof t === "string" && t.length < 64)
      ? { targetElementIds: targetElementIds.slice(0, 8), targetLabel: typeof targetLabel === "string" ? targetLabel.slice(0, 80) : undefined }
      : undefined;

  try {
    // Flux expert : on itère sur le RENDU RÉEL (expertRenderUrl), pas le fictif.
    // Puis on RÉINTÈGRE les meubles que l'itération a pu ajouter : sans ça, une
    // demande du type « ajoute une table et des chaises » produisait des meubles
    // fictifs, absents de la liste et donc inachetables (QA Alexis 2026-07-12).
    // En tâche de fond : l'utilisateur voit son rendu tout de suite, la liste et
    // les vrais produits arrivent derrière (/final polle déjà /shopping-status).
    const project = await getProject(id);
    if (project?.mode === "expert") {
      // `target` était perdu ici : le tap-to-target ne servait qu'au flux standard.
      await runExpertIteration(id, userRequest.trim(), target);
      after(async () => {
        // MOBILIER ajouté par l'itération → matché et incrusté (vrais produits).
        await reintegrateExpertAdditions(id).catch((e) => logPipelineError(id, "expert-reintegrate", e));
        // SURFACES (sol, murs) modifiées par l'itération → lignes d'achat. Le rendu
        // reste celui de l'itération (le sol y est inventé), mais il devient
        // ACHETABLE : sans ça, « change le sol » donnait une image superbe et un sol
        // invendable. Aucune image régénérée ici, seulement deux appels vision.
        await reintegrateExpertSurfaces(id).catch((e) => logPipelineError(id, "expert-surfaces", e));
        // RECALCUL FORCÉ, même recette que le swap : le rendu affiché a changé
        // (IT_N) mais ensureFinalAssets sans force voyait « une liste existe » et
        // s'arrêtait là — analyse/pins restaient estampillés sur l'ANCIEN rendu
        // expert, plus aucun pin à l'écran (-3TxWNN, QA Alexis 2026-07-16). Après
        // les réintégrations (qui peuvent régénérer le rendu), on réaligne tout
        // sur renduAffiche ; les produits intégrés survivent (épinglage).
        await ensureFinalAssets(id, { force: true }).catch((e) => logPipelineError(id, "expert-iterate-recompute", e));
      });
      return NextResponse.json({ ok: true, projectId: id });
    }

    await runIterationPipeline(id, userRequest.trim(), target);
    // Recalcul shopping en fond sur le nouveau rendu (levier perf 1). Une itération
    // suivante déclenche son propre calcul ; l'ancien ne persiste pas (anti-staleness).
    after(() => precomputeFinalAssets(id, "iterate"));
    return NextResponse.json({ ok: true, projectId: id });
  } catch (err) {
    console.error("[iterate] pipeline error:", err);
    await logPipelineError(id, "iterate", err);
    const msg = err instanceof Error ? err.message : String(err);

    if (/quota|429|too many requests/i.test(msg)) {
      return NextResponse.json(
        { error: "Quota Gemini dépassé." },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "Problème lors de l'itération. Réessayez." },
      { status: 503 },
    );
  }
}
