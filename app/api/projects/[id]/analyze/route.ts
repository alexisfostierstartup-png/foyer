import { NextRequest, NextResponse } from "next/server";
import { runAnalysisPipeline } from "@/lib/ai/pipeline";
import { logPipelineError } from "@/lib/ai/logger";

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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 503 },
    );
  }
}
