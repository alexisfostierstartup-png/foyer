export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { PromptEditorForm } from "@/components/admin/PromptEditorForm";
import type { PromptVersion } from "@/components/admin/VersionsList";

export default async function EditPromptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = createSupabaseAdmin();

  const { data: prompt } = await supabase
    .from("prompts")
    .select("*")
    .eq("id", id)
    .single();

  if (!prompt) notFound();

  const { data: rawVersions } = await supabase
    .from("prompt_versions")
    .select("*")
    .eq("prompt_id", id)
    .order("version", { ascending: false });

  const versions: PromptVersion[] = (rawVersions ?? []).map((v) => ({
    id: v.id,
    version: v.version,
    saved_at: v.saved_at,
    template: v.template,
    conditions: (v.conditions as Record<string, unknown>) ?? {},
    provider: v.provider,
    notes: v.notes,
  }));

  return (
    <div>
      <Link
        href="/admin/prompts"
        className="inline-flex items-center gap-1.5 text-sm text-foyer-muted hover:text-foyer-ink mb-6 transition-colors"
      >
        <ChevronLeft size={16} />
        Prompts
      </Link>

      <PromptEditorForm
        promptId={prompt.id}
        currentVersion={prompt.version}
        versions={versions}
        defaultValues={{
          slug: prompt.slug,
          purpose: prompt.purpose,
          provider: prompt.provider,
          conditions: (prompt.conditions as Record<string, unknown>) ?? {},
          template: prompt.template,
          notes: prompt.notes ?? "",
          is_active: prompt.is_active,
        }}
      />
    </div>
  );
}
