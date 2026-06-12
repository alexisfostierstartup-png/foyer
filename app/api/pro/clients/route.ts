import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/actions";
import { listClients, createClient } from "@/lib/db/pro";

export async function GET() {
  const supabase = await createSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const clients = await listClients(user.id);
  return NextResponse.json(clients);
}

export async function POST(req: Request) {
  const supabase = await createSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getProfile(user.id);
  if (profile?.plan !== "pro") return NextResponse.json({ error: "Pro plan required" }, { status: 403 });
  const body = await req.json() as { name: string; email?: string; phone?: string; notes?: string };
  const client = await createClient({ ownerId: user.id, ...body });
  return NextResponse.json(client);
}
