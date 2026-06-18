import { createSupabaseAdmin } from "@/lib/supabase/server";
import { invalidatePricingCache } from "@/lib/ai/pricing";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: any = { updated_at: new Date().toISOString() };
    const fields = [
      "provider","model","per_1m_input_tokens","per_1m_output_tokens",
      "per_image_in","per_image_out","per_request","per_1k_embeddings",
      "notes","is_active",
    ] as const;
    for (const f of fields) {
      if (f in body) update[f] = body[f] === "" ? null : body[f];
    }

    const { data, error } = await createSupabaseAdmin()
      .from("ai_pricing")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    invalidatePricingCache();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { error } = await createSupabaseAdmin().from("ai_pricing").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  invalidatePricingCache();
  return new Response(null, { status: 204 });
}
