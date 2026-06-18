import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category");
  const search = searchParams.get("search");

  let query = createSupabaseAdmin()
    .from("diy_actions")
    .select("*")
    .order("slug", { ascending: true });

  if (category) {
    query = query.contains("applies_to_categories", [category]);
  }
  if (search) {
    query = query.ilike("label", `%${search}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ actions: data });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { data, error } = await createSupabaseAdmin()
    .from("diy_actions")
    .insert(body)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ action: data }, { status: 201 });
}
