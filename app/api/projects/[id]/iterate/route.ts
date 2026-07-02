import { NextResponse, after } from "next/server";
import { precomputeFinalAssets, runIterationPipeline } from "@/lib/ai/pipeline";
import { logPipelineError } from "@/lib/ai/logger";

export const maxDuration = 90;

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const { userRequest } = (await request.json()) as { userRequest: string };

  if (!userRequest?.trim()) {
    return NextResponse.json({ error: "userRequest manquant" }, { status: 400 });
  }

  try {
    await runIterationPipeline(id, userRequest.trim());
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
