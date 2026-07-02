import { NextRequest, NextResponse, after } from "next/server";
import { precomputeFinalAssets, runGenerationPipeline } from "@/lib/ai/pipeline";
import { createClient } from "@/lib/supabase/server";
import { checkAndConsumeCredit } from "@/lib/auth/actions";
import { logPipelineError } from "@/lib/ai/logger";
import { PAYWALL_DISABLED } from "@/lib/constants";

export const maxDuration = 90;

function userMessage(err: unknown): { message: string; status: number } {
  const msg = err instanceof Error ? err.message : String(err);
  if (/quota|429|too many requests/i.test(msg)) {
    return {
      message:
        "Quota Gemini dépassé — la génération d'image nécessite un plan payant.",
      status: 429,
    };
  }
  if (/quality|floue|sombre/i.test(msg)) {
    return {
      message:
        "On dirait que la photo est un peu floue ou sombre. Pouvez-vous en prendre une autre ?",
      status: 400,
    };
  }
  return {
    message: "On a eu du mal à générer un beau rendu. Réessayez ou changez la photo.",
    status: 503,
  };
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  // Credit check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const anonId = request.cookies.get("foyer_anon_id")?.value;
  const firstFreeUsed = request.cookies.get("foyer_free_used")?.value === "1";

  if (!PAYWALL_DISABLED) {
    if (user) {
      const result = await checkAndConsumeCredit(id, user.id);
      if (!result.allowed) {
        return NextResponse.json({ error: "no_credits", paywall: "second_project" }, { status: 402 });
      }
    } else {
      // Anonymous: first render is free
      if (firstFreeUsed) {
        return NextResponse.json({ error: "no_credits", paywall: "second_project" }, { status: 402 });
      }
    }
  }

  try {
    await runGenerationPipeline(id);

    // Précalcul shopping en fond pendant que le user regarde son rendu → l'étape
    // liste de courses est perçue ~0 s (levier perf 1).
    after(() => precomputeFinalAssets(id, "generate"));

    const res = NextResponse.json({ ok: true, projectId: id });

    // Mark first free as used for anonymous users
    if (!user && !firstFreeUsed) {
      res.cookies.set("foyer_free_used", "1", {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365, // 1 year
        path: "/",
      });
    }

    return res;
  } catch (err) {
    console.error("[generate] pipeline error:", err);
    await logPipelineError(id, "generate", err);
    const { message, status } = userMessage(err);
    return NextResponse.json({ error: message }, { status });
  }
}
