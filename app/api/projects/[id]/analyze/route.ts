import { NextRequest, NextResponse } from "next/server";
import { runAnalysisPipeline } from "@/lib/ai/pipeline";
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
