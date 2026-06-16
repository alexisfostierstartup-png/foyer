import { NextRequest, NextResponse } from "next/server";
import { runAnalysisPipeline } from "@/lib/ai/pipeline";
import { logPipelineError } from "@/lib/ai/logger";
import { isTransientAiError } from "@/lib/ai/retry";

export const maxDuration = 60;

export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  try {
    await runAnalysisPipeline(id);
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
