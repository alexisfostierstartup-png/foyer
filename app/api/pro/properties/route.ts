import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/actions";
import { createProperty, createRoom } from "@/lib/db/pro";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getProfile(user.id);
  if (profile?.plan !== "pro") return NextResponse.json({ error: "Pro plan required" }, { status: 403 });

  const body = await req.json() as {
    address: string;
    propertyType: string;
    surfaceM2?: number;
    notes?: string;
    rooms?: Array<{ name: string; roomType: string; primaryPhotoUrl?: string; sortOrder?: number }>;
  };

  const property = await createProperty({
    ownerId: user.id,
    address: body.address,
    propertyType: body.propertyType,
    surfaceM2: body.surfaceM2,
    notes: body.notes,
  });

  if (body.rooms?.length) {
    await Promise.all(
      body.rooms.map((r) =>
        createRoom({
          propertyId: property.id,
          name: r.name,
          roomType: r.roomType,
          primaryPhotoUrl: r.primaryPhotoUrl,
          sortOrder: r.sortOrder ?? 0,
        }),
      ),
    );
  }

  return NextResponse.json({ propertyId: property.id });
}
