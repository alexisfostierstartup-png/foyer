export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { DiyActionEditorForm } from "@/components/admin/DiyActionEditorForm";
import type { DiyAction } from "@/lib/diy/types";

export default async function DiyActionEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data } = await createSupabaseAdmin()
    .from("diy_actions")
    .select("*")
    .eq("id", id)
    .single();

  if (!data) notFound();

  return (
    <div>
      <Link
        href="/admin/diy-actions"
        className="inline-flex items-center gap-1.5 text-sm text-foyer-muted hover:text-foyer-ink mb-6 transition-colors"
      >
        <ChevronLeft size={16} />
        Actions DIY
      </Link>
      <h1 className="font-serif text-2xl text-foyer-ink mb-6">{data.label}</h1>
      <DiyActionEditorForm action={data as DiyAction} />
    </div>
  );
}
