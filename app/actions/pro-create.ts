"use server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/actions";
import { createJob, createRenders, getRooms } from "@/lib/db/pro";
import { headers } from "next/headers";

export async function createProJob(input: {
  propertyId: string;
  roomIds: string[];
  ambianceSlugs: string[];
  mode: "standard" | "reconstruction_3d" | "before_after_sale";
  globalConstraints?: string;
}): Promise<{ jobId: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const profile = await getProfile(user.id);
  if (profile?.plan !== "pro") throw new Error("Pro plan required");

  // Create the job row
  const job = await createJob({
    propertyId: input.propertyId,
    userId: user.id,
    mode: input.mode,
    roomIds: input.roomIds,
    ambianceSlugs: input.ambianceSlugs,
    globalConstraints: input.globalConstraints,
  });

  // Fetch rooms to get source photos
  const rooms = await getRooms(input.propertyId);
  const selectedRooms = rooms.filter((r) => input.roomIds.includes(r.id));

  // Create render rows (one per room × ambiance combination)
  const renderInputs = [];
  for (const room of selectedRooms) {
    if (!room.primary_photo_url) continue;
    for (const ambianceSlug of input.ambianceSlugs) {
      renderInputs.push({
        jobId: job.id,
        roomId: room.id,
        ambianceSlug,
        sourcePhotoUrl: room.primary_photo_url,
      });
    }
  }

  if (renderInputs.length > 0) {
    await createRenders(renderInputs);
  }

  // Fire-and-forget: trigger the run endpoint
  const hdrs = await headers();
  const origin = hdrs.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  fetch(`${origin}/api/pro/jobs/${job.id}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-key": process.env.ADMIN_SESSION_TOKEN ?? "" },
  }).catch(() => {});

  return { jobId: job.id };
}
