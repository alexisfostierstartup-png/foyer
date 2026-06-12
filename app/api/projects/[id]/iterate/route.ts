import { NextResponse } from "next/server";
import { runIterationPipeline } from "@/lib/ai/pipeline";

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
    return NextResponse.json({ ok: true, projectId: id });
  } catch (err) {
    console.error("[iterate] pipeline error:", err);
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
