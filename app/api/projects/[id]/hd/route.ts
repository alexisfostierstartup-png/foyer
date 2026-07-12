import { NextResponse } from "next/server";
import { renderHd } from "@/lib/ai/expert";
import { logPipelineError } from "@/lib/ai/logger";
import { isTransientAiError } from "@/lib/ai/retry";
import { getClientIp, checkRateLimit, RATE_LIMITED_BODY } from "@/lib/security/rateLimit";

export const maxDuration = 120;

/**
 * Tirage HD (4K) du rendu fini, pour téléchargement.
 *
 * L'image est écrite sous un nom DISTINCT et n'écrase pas le rendu du projet : NB2 est
 * génératif, un upscale peut déformer un détail, et saveRender réécrit toujours le même
 * chemin sans historique. On renvoie une URL, l'utilisateur télécharge — son projet ne
 * bouge pas.
 *
 * Coût : 0,16 $ l'appel (4K = 2× le tarif de base). D'où le rate limit serré.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  if (!(await checkRateLimit(getClientIp(request), "hd", 10))) {
    return NextResponse.json(RATE_LIMITED_BODY, { status: 429 });
  }

  try {
    const url = await renderHd(id);
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    console.error("[hd] error:", err);
    await logPipelineError(id, "hd", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (/Pas de rendu|Project not found/.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json(
      {
        error: isTransientAiError(err)
          ? "Le service est très demandé. Réessayez dans quelques instants."
          : "Le tirage HD a échoué. Réessayez.",
      },
      { status: 503 },
    );
  }
}
