export const dynamic = "force-dynamic";
import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase/server";

const CATEGORIES = [
  {
    slug: "ambiance",
    label: "Ambiances",
    description: "Styles déco avec palette, matériaux et mood.",
  },
  {
    slug: "room_defaults",
    label: "Defaults pièce",
    description: "Meubles attendus par type de pièce (en anglais).",
  },
  {
    slug: "floor_preset",
    label: "Presets sol",
    description: "Options de revêtement de sol prédéfinies.",
  },
  {
    slug: "wall_palette",
    label: "Palettes murales",
    description: "Couleurs de peinture murale avec code hex.",
  },
  {
    slug: "element_category",
    label: "Catégories d'éléments",
    description: "Taxonomie de détection : familles → types précis (TV, table basse, plafonnier…).",
  },
];

export default async function AdminAssetsPage() {
  const supabase = createSupabaseAdmin();

  const counts = await Promise.all(
    CATEGORIES.map(async (cat) => {
      const { count } = await supabase
        .from("assets")
        .select("id", { count: "exact", head: true })
        .eq("category", cat.slug);
      return count ?? 0;
    }),
  );

  return (
    <div>
      <h1 className="font-serif text-2xl text-foyer-ink mb-8">Assets</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CATEGORIES.map((cat, idx) => (
          <Link
            key={cat.slug}
            href={`/admin/assets/${cat.slug}`}
            className="group rounded-xl border border-foyer-border p-5 hover:border-foyer-ink/30 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between mb-2">
              <h2 className="font-medium text-foyer-ink group-hover:text-foyer-sage transition-colors">
                {cat.label}
              </h2>
              <span className="text-2xl font-serif text-foyer-muted">
                {counts[idx]}
              </span>
            </div>
            <p className="text-sm text-foyer-muted">{cat.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
