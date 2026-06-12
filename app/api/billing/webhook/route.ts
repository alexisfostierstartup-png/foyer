import { NextRequest, NextResponse } from "next/server";

// Stub Stripe webhook — returns 200 so the webhook endpoint validates.
// Real Stripe integration will be added when the app goes live.
export async function POST(request: NextRequest) {
  // In production: verify signature with STRIPE_WEBHOOK_SECRET and handle events
  // await stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  const body = await request.text();
  console.log("[webhook] received stripe event (stub):", body.slice(0, 200));
  return NextResponse.json({ received: true });
}
