import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { nanoid } from "nanoid";

export type CheckoutType =
  | "credits_starter"
  | "credits_standard"
  | "credits_volume"
  | "expert_monthly";

const CREDIT_AMOUNTS: Record<CheckoutType, number> = {
  credits_starter: 3,
  credits_standard: 15,
  credits_volume: 40,
  expert_monthly: 0,
};

const PRICES: Record<CheckoutType, string> = {
  credits_starter: "4,99€",
  credits_standard: "14,99€",
  credits_volume: "29,99€",
  expert_monthly: "15€/mois",
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    type: CheckoutType;
    successUrl?: string;
    cancelUrl?: string;
  };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { type, successUrl, cancelUrl } = body;
  const fakeSessionId = `fake_${nanoid(12)}`;

  // Build local success URL (fake Stripe redirect)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const baseSuccessUrl = successUrl ?? `${appUrl}/billing/success`;
  const sep = baseSuccessUrl.includes("?") ? "&" : "?";
  const url = `${baseSuccessUrl}${sep}type=${type}&session_id=${fakeSessionId}&user_id=${user.id}`;

  console.log(`[billing] fake checkout session for user=${user.id} type=${type} price=${PRICES[type]}`);

  return NextResponse.json({ url, sessionId: fakeSessionId });
}
