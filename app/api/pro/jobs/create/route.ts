import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/actions";
import { createJob, createRenders, getRooms } from "@/lib/db/pro";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getProfile(user.id);
  if (profile?.plan !== "pro") return NextResponse.json({ error: "Pro plan required" }, { status: 403 });

  const body = await req.json() as {
    propertyId: string;
    roomIds: string[];
    ambianceSlugs: string[];
    mode: string;
    globalConstraints?: string;
  };

  const job = await createJob({
    propertyId: body.propertyId,
    userId: user.id,
    mode: body.mode,
    roomIds: body.roomIds,
    ambianceSlugs: body.ambianceSlugs,
    globalConstraints: body.globalConstraints,
  });

  // Pre-create render rows
  const rooms = await getRooms(body.propertyId);
  const selectedRooms = rooms.filter((r) => body.roomIds.includes(r.id));
  const renders = selectedRooms.flatMap((room) =>
    body.ambianceSlugs.map((ambiance) => ({
      jobId: job.id,
      roomId: room.id,
      ambianceSlug: ambiance,
      sourcePhotoUrl: room.primary_photo_url ?? "",
    })),
  );
  await createRenders(renders);

  // Fire-and-forget background runner
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  fetch(`${baseUrl}/api/pro/jobs/${job.id}/run`, {
    method: "POST",
    headers: { "x-internal-key": process.env.INTERNAL_API_KEY ?? "foyer-internal" },
  }).catch(() => {});

  return NextResponse.json({ jobId: job.id });
}
