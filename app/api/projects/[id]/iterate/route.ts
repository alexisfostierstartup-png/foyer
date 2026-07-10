import { NextResponse, after } from "next/server";
import { precomputeFinalAssets, runIterationPipeline } from "@/lib/ai/pipeline";
import { runExpertIteration } from "@/lib/ai/expert";
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
    // Flux expert : on itère (sol/peinture) sur le RENDU RÉEL (expertRenderUrl),
    // pas le fictif — et la shopping list étant pilotée par les décisions, pas de
    // recompute matching (qui repartirait du rendu fictif).
    const project = await getProject(id);
    if (project?.mode === "expert") {
      await runExpertIteration(id, userRequest.trim());
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
