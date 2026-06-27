import { NextResponse } from "next/server";
import { syncMerchantProducts } from "@/lib/shopping/sync";

// Appelé chaque lundi à 3h00 UTC via Vercel Cron (vercel.json)
// Authentifié par CRON_SECRET header

const MERCHANTS = ["manomano", "castorama", "la_redoute"] as const;

export async function GET(request: Request) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "");
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const merchant of MERCHANTS) {
    try {
      console.log(`[cron:sync-partners] Syncing ${merchant}…`);
      results[merchant] = await syncMerchantProducts(merchant, { testLimit: undefined });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron:sync-partners] ${merchant} failed:`, msg);
      results[merchant] = { error: msg };
      errors.push(`${merchant}: ${msg}`);
    }
  }

  if (errors.length > 0) {
    console.error("[cron:sync-partners] Errors:", errors);
  }

  return NextResponse.json({
    ok: errors.length === 0,
    results,
    syncedAt: new Date().toISOString(),
    ...(errors.length > 0 ? { errors } : {}),
  });
}
