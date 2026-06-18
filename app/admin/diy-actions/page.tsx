export const dynamic = "force-dynamic";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { DiyActionsAdmin } from "@/components/admin/DiyActionsAdmin";
import type { DiyAction } from "@/lib/diy/types";

export default async function DiyActionsPage() {
  const { data } = await createSupabaseAdmin()
    .from("diy_actions")
    .select("*")
    .order("slug", { ascending: true });

  return <DiyActionsAdmin actions={(data ?? []) as DiyAction[]} />;
}
