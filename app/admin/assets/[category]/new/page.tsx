import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AssetEditorForm } from "@/components/admin/AssetEditorForm";

const CATEGORY_LABELS: Record<string, string> = {
  ambiance: "Ambiances",
  room_defaults: "Defaults pièce",
  floor_preset: "Presets sol",
  wall_palette: "Palettes murales",
};

export default async function NewAssetPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;

  if (!CATEGORY_LABELS[category]) notFound();
  const categoryLabel = CATEGORY_LABELS[category];

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
        category={category}
        categoryLabel={categoryLabel}
        defaultValues={{ category, is_active: true, sort_order: 0 }}
      />
    </div>
  );
}
