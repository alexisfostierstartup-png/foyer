import { NextRequest, NextResponse } from "next/server";
import { runExpertRenderPipeline } from "@/lib/ai/expert";
import { logPipelineError } from "@/lib/ai/logger";
import { isTransientAiError } from "@/lib/ai/retry";
import { getClientIp, checkRateLimit, RATE_LIMITED_BODY } from "@/lib/security/rateLimit";

export const maxDuration = 90;

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  // Rate limit par IP : appel image payant (NB2), route sans auth.
  if (!(await checkRateLimit(getClientIp(request), "generate", 20))) {
    return NextResponse.json(RATE_LIMITED_BODY, { status: 429 });
  }

  try {
    const url = await runExpertRenderPipeline(id);
    return NextResponse.json({ ok: true, projectId: id, expertRenderUrl: url });
  } catch (err) {
    console.error("[expert-render] error:", err);
    await logPipelineError(id, "expert-render", err);
    const msg = err instanceof Error ? err.message : String(err);
    // Erreurs "métier" (pas de photo / pas de meuble) → 400, message tel quel.
    if (/photo de base|gros meuble|Project not found/.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const message = isTransientAiError(err)
      ? "Le service IA est très demandé. Réessayez dans quelques instants."
      : "Le rendu expert a échoué. Réessayez.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
