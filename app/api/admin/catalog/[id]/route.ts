import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = (await request.json()) as { partner_tier?: string };

  const validTiers = ["strategic", "standard", "discovery"];
  if (!body.partner_tier || !validTiers.includes(body.partner_tier)) {
    return NextResponse.json({ error: "partner_tier invalide" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("partner_products")
    .update({ partner_tier: body.partner_tier, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, name, partner_tier")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
