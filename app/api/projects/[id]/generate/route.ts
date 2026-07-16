import { NextRequest, NextResponse, after } from "next/server";
import { precomputeFinalAssets, runGenerationPipeline } from "@/lib/ai/pipeline";
import { createClient } from "@/lib/supabase/server";
import { checkAndConsumeCredit } from "@/lib/auth/actions";
import { logPipelineError } from "@/lib/ai/logger";
import { PAYWALL_DISABLED } from "@/lib/constants";
import { getClientIp, checkRateLimit, RATE_LIMITED_BODY } from "@/lib/security/rateLimit";

export const maxDuration = 300; // plafond Fluid Compute — à 90 s, le calcul liste+pins en prod (vision + Jina froid + matching, parfois >90 s) était tué en plein vol et bouclait (QA Alexis 2026-07-17)

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
  // Gemini refuse d'éditer une image contenant un visage humain identifiable
  // (le refus arrive en texte dans la réponse, cf. nanoBanana.ts "Model said: ...").
  // Message dédié qui explique la VRAIE cause plutôt que l'erreur générique
  // "on a eu du mal…" — sinon le user ne comprend pas qu'il n'a pas respecté
  // la consigne « aucune personne dans la photo » (retour Alexis 2026-07-16).
  if (/\b(person|people|human|face|individual|portrait|likeness|identifiable|child|minor)\b/i.test(msg)) {
    return {
      message:
        "Impossible de générer votre rendu : un visage humain a été détecté sur la photo, et notre technologie ne peut pas transformer une image contenant une personne réelle. Reprenez une photo sans personne visible — ni en vrai, ni à l'écran (télé, cadre photo…) — et réessayez.",
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

  // Rate limit par IP : garde-fou anti-abus de génération (coût Gemini) pour les
  // requêtes non authentifiées, en complément du gating crédit.
  if (!(await checkRateLimit(getClientIp(request), "generate", 20))) {
    return NextResponse.json(RATE_LIMITED_BODY, { status: 429 });
  }

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
