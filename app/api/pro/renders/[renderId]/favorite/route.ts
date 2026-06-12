import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: Request, { params }: { params: Promise<{ renderId: string }> }) {
  const { renderId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { is_favorite } = (await req.json()) as { is_favorite: boolean };
  const admin = createSupabaseAdmin();
  await admin.from("pro_renders").update({ is_favorite }).eq("id", renderId);
  return NextResponse.json({ ok: true });
}
