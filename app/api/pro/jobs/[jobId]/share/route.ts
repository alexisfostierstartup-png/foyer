import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getJob, createShareLink } from "@/lib/db/pro";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = await getJob(jobId, user.id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const link = await createShareLink(jobId);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return NextResponse.json({ url: `${appUrl}/pro/share/${link.slug}`, slug: link.slug });
}
