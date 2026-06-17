import { NextRequest, NextResponse } from "next/server";
import { runDispositionsPipeline } from "@/lib/ai/pipeline";
import { createClient } from "@/lib/supabase/server";
import { checkAndConsumeCredit } from "@/lib/auth/actions";
import { logPipelineError } from "@/lib/ai/logger";

export const maxDuration = 90;

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  // Même garde-fou crédits que /generate (1 appel image).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const firstFreeUsed = request.cookies.get("foyer_free_used")?.value === "1";

  if (user) {
    const result = await checkAndConsumeCredit(id, user.id);
    if (!result.allowed) {
      return NextResponse.json({ error: "no_credits", paywall: "second_project" }, { status: 402 });
    }
  } else if (firstFreeUsed) {
    return NextResponse.json({ error: "no_credits", paywall: "second_project" }, { status: 402 });
  }

  try {
    const url = await runDispositionsPipeline(id);
    const res = NextResponse.json({ ok: true, projectId: id, url });
    if (!user && !firstFreeUsed) {
      res.cookies.set("foyer_free_used", "1", {
        httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/",
      });
    }
    return res;
  } catch (err) {
    console.error("[generate-dispositions] pipeline error:", err);
    await logPipelineError(id, "dispositions", err);
    return NextResponse.json(
      { error: "On a eu du mal à générer les dispositions. Réessayez." },
      { status: 503 },
    );
  }
}
