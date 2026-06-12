import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listProperties } from "@/lib/db/pro";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const properties = await listProperties(user.id);
  return NextResponse.json(properties);
}
