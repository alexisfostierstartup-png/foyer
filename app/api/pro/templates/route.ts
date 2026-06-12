import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/actions";
import { listTemplates, createTemplate } from "@/lib/db/pro";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const templates = await listTemplates(user.id);
  return NextResponse.json(templates);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getProfile(user.id);
  if (profile?.plan !== "pro") return NextResponse.json({ error: "Pro plan required" }, { status: 403 });
  const body = await req.json() as { name: string; description?: string; ambianceSlugs: string[]; customConstraints?: string };
  const template = await createTemplate({ ownerId: user.id, ...body });
  return NextResponse.json(template);
}
