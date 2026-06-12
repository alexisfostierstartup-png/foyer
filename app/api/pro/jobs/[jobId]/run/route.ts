import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import {
  getJobPublic,
  getPendingRenders,
  updateRender,
  updateJobStatus,
} from "@/lib/db/pro";
import { runProRenderPipeline } from "@/lib/ai/pro-pipeline";

export const maxDuration = 60;

const BATCH_SIZE = 5;

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await ctx.params;

  // Basic internal auth check
  const internalKey = request.headers.get("x-internal-key");
  const expectedKey = process.env.ADMIN_SESSION_TOKEN;
  if (!internalKey || internalKey !== expectedKey) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const job = await getJobPublic(jobId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (job.status === "completed") {
    return NextResponse.json({ ok: true, status: "already_completed" });
  }

  // Mark job as running
  await updateJobStatus(jobId, {
    status: "running",
    started_at: job.started_at ?? new Date().toISOString(),
  });

  const pending = await getPendingRenders(jobId);
  if (pending.length === 0) {
    await updateJobStatus(jobId, {
      status: "completed",
      completed_at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, processed: 0 });
  }

  // Process in batches of BATCH_SIZE
  const batch = pending.slice(0, BATCH_SIZE);
  let completed = job.completed_renders ?? 0;
  let failed = job.failed_renders ?? 0;

  const results = await Promise.allSettled(
    batch.map(async (render) => {
      await updateRender(render.id, { status: "running" });
      try {
        const result = await runProRenderPipeline({
          renderId: render.id,
          sourcePhotoUrl: render.source_photo_url,
          ambianceSlug: render.ambiance_slug,
          roomType: (render as { pro_property_rooms?: { room_type?: string } }).pro_property_rooms?.room_type ?? "salon",
          globalConstraints: job.global_constraints,
        });
        await updateRender(render.id, {
          status: "completed",
          render_url: result.renderUrl,
          alterations: result.alterations,
          completed_at: new Date().toISOString(),
        });
        completed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        await updateRender(render.id, {
          status: "failed",
          error_message: msg,
          completed_at: new Date().toISOString(),
        });
        failed++;
      }
    }),
  );

  // Update job progress
  const remaining = pending.length - batch.length;
  const newStatus = remaining === 0 ? "completed" : "running";

  await updateJobStatus(jobId, {
    status: newStatus,
    completed_renders: completed,
    failed_renders: failed,
    ...(newStatus === "completed" ? { completed_at: new Date().toISOString() } : {}),
  });

  // If there are more pending renders, self-invoke for the next batch
  if (remaining > 0) {
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    fetch(`${origin}/api/pro/jobs/${jobId}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": process.env.ADMIN_SESSION_TOKEN ?? "",
      },
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    processed: batch.length,
    completed,
    failed,
    remaining,
    status: newStatus,
  });
}
