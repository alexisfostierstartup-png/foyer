import { createSupabaseAdmin } from "@/lib/supabase/server";
import { invalidatePricingCache } from "@/lib/ai/pricing";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { data, error } = await createSupabaseAdmin()
      .from("ai_pricing")
      .insert({
        provider: body.provider,
        model: body.model || null,
        per_1m_input_tokens: body.per_1m_input_tokens ?? null,
        per_1m_output_tokens: body.per_1m_output_tokens ?? null,
        per_image_in: body.per_image_in ?? null,
        per_image_out: body.per_image_out ?? null,
        per_request: body.per_request ?? null,
        per_1k_embeddings: body.per_1k_embeddings ?? null,
        notes: body.notes || null,
        is_active: body.is_active ?? true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    invalidatePricingCache();
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
