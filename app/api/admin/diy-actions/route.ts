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

// Champs insérables (aligné sur la whitelist du PATCH [id] + slug à la création).
// Évite le mass-assignment (colonnes internes id/created_at/… non écrasables).
const INSERTABLE_FIELDS = [
  "slug", "label", "label_en", "applies_to_categories",
  "requires", "excludes", "qty_formula", "qty_unit",
  "style_affinity", "supplies_template", "is_active",
];

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const row: Record<string, unknown> = {};
  for (const key of INSERTABLE_FIELDS) {
    if (key in body) row[key] = body[key];
  }
  if (!row.slug) {
    return NextResponse.json({ error: "slug requis" }, { status: 400 });
  }

  const { data, error } = await createSupabaseAdmin()
    .from("diy_actions")
    // row est filtré par INSERTABLE_FIELDS + slug garanti ci-dessus ; cast car le
    // type d'insert généré exige des champs que la whitelist rend optionnels.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(row as any)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ action: data }, { status: 201 });
}
