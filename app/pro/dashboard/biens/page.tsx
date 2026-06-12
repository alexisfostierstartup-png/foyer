import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Building2, Archive } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listAllProperties } from "@/lib/db/pro";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  active: "Actif",
  archived: "Archivé",
  sold_rented: "Vendu/Loué",
};

export default async function BiensPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?tab=signin");

  const { status = "active" } = await searchParams;
  const allProperties = await listAllProperties(user.id);
  const filtered = status === "all" ? allProperties : allProperties.filter((p) => p.status === status);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-[24px] font-medium text-foyer-ink">Mes biens</h1>
        <Link
          href="/pro/dashboard/biens/new"
          className="flex items-center gap-1.5 rounded-full bg-foyer-sage px-4 py-2 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(107,142,111,0.3)]"
        >
          <Plus className="size-3.5" />
          Nouveau bien
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-1 rounded-xl border border-foyer-border bg-foyer-cream p-1 w-fit">
        {["active", "archived", "sold_rented"].map((s) => (
          <Link
            key={s}
            href={`?status=${s}`}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
              status === s
                ? "bg-white text-foyer-ink shadow-sm"
                : "text-foyer-muted hover:text-foyer-ink"
            }`}
          >
            {STATUS_LABEL[s]}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-foyer-border bg-foyer-cream px-6 py-16 text-center">
          <Building2 className="mx-auto mb-3 size-8 text-foyer-muted/40" />
          <p className="text-[14px] text-foyer-muted">Aucun bien dans cette catégorie.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-foyer-border bg-foyer-cream">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-foyer-border bg-foyer-cream/60">
                <th className="px-4 py-3 text-left font-semibold text-foyer-muted">Adresse</th>
                <th className="px-4 py-3 text-left font-semibold text-foyer-muted">Type</th>
                <th className="hidden px-4 py-3 text-left font-semibold text-foyer-muted sm:table-cell">Surface</th>
                <th className="hidden px-4 py-3 text-left font-semibold text-foyer-muted md:table-cell">Pièces</th>
                <th className="px-4 py-3 text-left font-semibold text-foyer-muted">Statut</th>
                <th className="px-4 py-3 text-right font-semibold text-foyer-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id} className={i < filtered.length - 1 ? "border-b border-foyer-border" : ""}>
                  <td className="px-4 py-3 font-medium text-foyer-ink">{p.address}</td>
                  <td className="px-4 py-3 capitalize text-foyer-muted">{p.property_type}</td>
                  <td className="hidden px-4 py-3 text-foyer-muted sm:table-cell">
                    {p.surface_m2 ? `${p.surface_m2} m²` : "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-foyer-muted md:table-cell">
                    {(p as unknown as { pro_property_rooms?: Array<{ count: number }> }).pro_property_rooms?.[0]?.count ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      p.status === "active" ? "bg-foyer-sage/15 text-foyer-sage" : "bg-foyer-muted/15 text-foyer-muted"
                    }`}>
                      {STATUS_LABEL[p.status ?? "active"]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/pro/dashboard/biens/${p.id}`} className="text-[12px] text-foyer-muted hover:text-foyer-ink">Voir</Link>
                      <Link
                        href={`/pro/create?propertyId=${p.id}`}
                        className="rounded-full bg-foyer-sage/15 px-2.5 py-1 text-[11px] font-medium text-foyer-sage hover:bg-foyer-sage/25"
                      >
                        Générer
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
