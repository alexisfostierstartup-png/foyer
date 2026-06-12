import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getJob, getJobRenders } from "@/lib/db/pro";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = await getJob(jobId, user.id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const renders = await getJobRenders(jobId);

  // Fetch property info for display
  const { data: property } = await (await import("@/lib/supabase/server")).createSupabaseAdmin()
    .from("pro_properties")
    .select("address, property_type")
    .eq("id", job.property_id)
    .single();

  return NextResponse.json({
    id: job.id,
    status: job.status,
    total_renders: job.total_renders,
    completed_renders: job.completed_renders,
    failed_renders: job.failed_renders,
    renders,
    pro_properties: property,
  });
}
