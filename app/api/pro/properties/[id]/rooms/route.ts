import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRooms } from "@/lib/db/pro";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rooms = await getRooms(id);
  return NextResponse.json(rooms);
}
