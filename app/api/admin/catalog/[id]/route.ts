import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { computeImageEmbedding } from "@/lib/embeddings/jina";

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = (await request.json()) as { partner_tier?: string; primary_image_url?: string };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAdmin() as any;

  // 1) Choix de l'image principale (position 1) → recalcule l'embedding cosine.
  if (body.primary_image_url) {
    let embedding: string;
    try {
      embedding = JSON.stringify(await computeImageEmbedding(body.primary_image_url));
    } catch (e) {
      return NextResponse.json(
        { error: `Recalcul embedding échoué: ${e instanceof Error ? e.message : e}` },
        { status: 502 },
      );
    }
    const { data, error } = await supabase
      .from("partner_products")
      .update({ primary_image_url: body.primary_image_url, embedding, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, primary_image_url")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // 2) Tier partenaire.
  const validTiers = ["strategic", "standard", "discovery"];
  if (!body.partner_tier || !validTiers.includes(body.partner_tier)) {
    return NextResponse.json({ error: "partner_tier invalide" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("partner_products")
    .update({ partner_tier: body.partner_tier, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, name, partner_tier")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
