import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ item_id: string }> },
) {
  const { item_id } = await ctx.params;
  const dest = new URL(req.url).searchParams.get("dest");

  let redirectUrl = dest ?? "/";

  // Récupère l'affiliate_url si l'item est un partner product
  if (item_id && item_id !== "lbc" && item_id !== "mock") {
    try {
      const supabase = createSupabaseAdmin();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("partner_products")
        .select("affiliate_url, product_url")
        .eq("id", item_id)
        .single();

      if (data?.affiliate_url) redirectUrl = data.affiliate_url;
      else if (data?.product_url) redirectUrl = data.product_url;
    } catch {
      // ignore — fallback sur dest
    }
  }

  if (!redirectUrl || redirectUrl === "/") {
    return NextResponse.json({ error: "No destination" }, { status: 400 });
  }

  // Log click (simple, en attendant α-14 withTracking)
  try {
    const supabase = createSupabaseAdmin();
    await supabase.from("pipeline_logs").insert({
      project_id: "click_tracking",
      event: "product_click",
      step: item_id,
      metadata: { dest: redirectUrl, referer: req.headers.get("referer") },
    });
  } catch {
    // non-bloquant
  }

  return NextResponse.redirect(redirectUrl);
}
