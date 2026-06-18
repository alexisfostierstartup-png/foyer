export const dynamic = "force-dynamic";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { AiPricingAdmin } from "@/components/admin/AiPricingAdmin";

export default async function AiPricingPage() {
  const { data } = await createSupabaseAdmin()
    .from("ai_pricing")
    .select("*")
    .order("provider")
    .order("model");

  return <AiPricingAdmin rows={data ?? []} />;
}
