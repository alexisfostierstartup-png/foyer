import { NextResponse } from "next/server";
import { syncMerchantProducts } from "@/lib/shopping/sync";

export async function POST(request: Request) {
  const body = (await request.json()) as { merchant?: string };
  const merchant = body.merchant;

  const supported = ["manomano", "castorama", "la_redoute"] as const;
  if (merchant && !supported.includes(merchant as (typeof supported)[number])) {
    return NextResponse.json({ error: "Merchant non supporté" }, { status: 400 });
  }

  const merchants = merchant ? [merchant] : [...supported];

  const results: Record<string, unknown> = {};
  for (const m of merchants) {
    try {
      results[m] = await syncMerchantProducts(m, { testLimit: 100 });
    } catch (err) {
      results[m] = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  return NextResponse.json({ results });
}
