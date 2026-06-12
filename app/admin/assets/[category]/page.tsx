export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Plus } from "lucide-react";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { ColorSwatch } from "@/components/admin/ColorSwatch";

const CATEGORY_LABELS: Record<string, string> = {
  ambiance: "Ambiances",
  room_defaults: "Defaults pièce",
  floor_preset: "Presets sol",
  wall_palette: "Palettes murales",
};

function getLabel(category: string, data: Record<string, unknown>): string {
  if (category === "ambiance") return String(data.name ?? "—");
  if (category === "room_defaults") return "—";
  return String(data.label ?? "—");
}

export default async function AssetCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;

  if (!CATEGORY_LABELS[category]) notFound();

  const { data: assets } = await createSupabaseAdmin()
    .from("assets")
    .select("*")
    .eq("category", category)
    .order("sort_order", { ascending: true });

  return (
    <div>
      <Link
        href="/admin/assets"
        className="inline-flex items-center gap-1.5 text-sm text-foyer-muted hover:text-foyer-ink mb-6 transition-colors"
      >
        <ChevronLeft size={16} />
        Assets
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-foyer-ink">
            {CATEGORY_LABELS[category]}
          </h1>
          <p className="text-sm text-foyer-muted mt-1">
            {assets?.length ?? 0} asset{assets?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href={`/admin/assets/${category}/new`}
          className="flex items-center gap-2 rounded-lg bg-foyer-ink text-foyer-cream px-4 py-2.5 text-sm font-medium hover:bg-foyer-ink/90 transition-colors"
        >
          <Plus size={16} />
          Nouvel asset
        </Link>
      </div>

      {(!assets || assets.length === 0) ? (
        <p className="text-sm text-foyer-muted italic">Aucun asset.</p>
      ) : (
        <div className="rounded-lg border border-foyer-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foyer-border bg-foyer-border/30">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-foyer-muted uppercase tracking-wide">
                  Slug
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-foyer-muted uppercase tracking-wide">
                  Label
                </th>
                {category === "wall_palette" && (
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-foyer-muted uppercase tracking-wide">
                    Couleur
                  </th>
                )}
                <th className="px-4 py-2.5 text-left text-xs font-medium text-foyer-muted uppercase tracking-wide">
                  Ordre
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-foyer-muted uppercase tracking-wide">
                  Statut
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foyer-border">
              {assets.map((asset) => {
                const data = (asset.data ?? {}) as Record<string, unknown>;
                return (
                  <tr key={asset.id} className="hover:bg-foyer-border/20 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/assets/${category}/${asset.id}`}
                        className="font-mono text-xs text-foyer-sage hover:underline"
                      >
                        {asset.slug}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-foyer-ink">
                      {getLabel(category, data)}
                    </td>
                    {category === "wall_palette" && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ColorSwatch hex={String(data.hex ?? "#000")} />
                          <span className="text-xs font-mono text-foyer-muted">
                            {String(data.hex ?? "—")}
                          </span>
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-xs text-foyer-muted">
                      {asset.sort_order ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block text-xs px-2 py-0.5 rounded-full ${
                          asset.is_active
                            ? "bg-foyer-sage/15 text-foyer-sage"
                            : "bg-foyer-border text-foyer-muted"
                        }`}
                      >
                        {asset.is_active ? "actif" : "inactif"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
