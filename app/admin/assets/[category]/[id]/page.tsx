export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { AssetEditorForm } from "@/components/admin/AssetEditorForm";

const CATEGORY_LABELS: Record<string, string> = {
  ambiance: "Ambiances",
  room_defaults: "Defaults pièce",
  floor_preset: "Presets sol",
  wall_palette: "Palettes murales",
  element_category: "Catégories d'éléments",
};

export default async function AssetEditorPage({
  params,
}: {
  params: Promise<{ category: string; id: string }>;
}) {
  const { category, id } = await params;

  if (!CATEGORY_LABELS[category]) notFound();
  const categoryLabel = CATEGORY_LABELS[category];

  const { data: asset } = await createSupabaseAdmin()
    .from("assets")
    .select("*")
    .eq("id", id)
    .eq("category", category)
    .single();

  if (!asset) notFound();

  return (
    <div>
      <Link
        href={`/admin/assets/${category}`}
        className="inline-flex items-center gap-1.5 text-sm text-foyer-muted hover:text-foyer-ink mb-6 transition-colors"
      >
        <ChevronLeft size={16} />
        {categoryLabel}
      </Link>

      <AssetEditorForm
        assetId={asset.id}
        category={category}
        categoryLabel={categoryLabel}
        defaultValues={{
          slug: asset.slug,
          category: asset.category,
          notes: asset.notes ?? "",
          sort_order: asset.sort_order ?? 0,
          is_active: asset.is_active,
          data: (asset.data ?? {}) as Record<string, unknown>,
        }}
      />
    </div>
  );
}
