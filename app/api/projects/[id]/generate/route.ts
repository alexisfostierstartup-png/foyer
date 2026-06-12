import { NextResponse } from "next/server";
import { runGenerationPipeline } from "@/lib/ai/pipeline";

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
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  try {
    await runGenerationPipeline(id);
    return NextResponse.json({ ok: true, projectId: id });
  } catch (err) {
    console.error("[generate] pipeline error:", err);
    const { message, status } = userMessage(err);
    return NextResponse.json({ error: message }, { status });
  }
}
