import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Building2, Zap, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getWallet } from "@/lib/auth/actions";
import { getProStats, listProperties, listRecentJobs } from "@/lib/db/pro";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  running: "En cours",
  completed: "Terminé",
  failed: "Erreur",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-foyer-muted/20 text-foyer-muted",
  running: "bg-blue-100 text-blue-700",
  completed: "bg-foyer-sage/15 text-foyer-sage",
  failed: "bg-red-100 text-red-600",
};

export default async function ProDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?tab=signin");

  const [profile, stats, recentProperties, recentJobs] = await Promise.all([
    getProfile(user.id),
    getProStats(user.id),
    listProperties(user.id),
    listRecentJobs(user.id, 5),
  ]);

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-[26px] font-medium text-foyer-ink">Dashboard</h1>
          <p className="text-[13px] text-foyer-muted">
            Bonjour, {profile?.display_name ?? user.email?.split("@")[0]}
          </p>
        </div>
        <Link
          href="/pro/dashboard/biens/new"
          className="flex items-center gap-1.5 rounded-full bg-foyer-sage px-4 py-2 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(107,142,111,0.3)] transition-all hover:-translate-y-0.5"
        >
          <Plus className="size-3.5" />
          Nouveau bien
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-foyer-border bg-foyer-cream p-5">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-foyer-muted" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foyer-muted">
              Biens actifs
            </p>
          </div>
          <p className="mt-2 font-serif text-[32px] text-foyer-ink">{stats.activeProperties}</p>
        </div>
        <div className="rounded-2xl border border-foyer-border bg-foyer-cream p-5">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-foyer-muted" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foyer-muted">
              Rendus ce mois
            </p>
          </div>
          <p className="mt-2 font-serif text-[32px] text-foyer-ink">{stats.rendersThisMonth}</p>
        </div>
        <div className="col-span-2 rounded-2xl border border-foyer-sage/30 bg-foyer-sage/8 p-5 lg:col-span-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foyer-sage">
            Abonnement Pro
          </p>
          <p className="mt-2 text-[14px] font-medium text-foyer-ink">Actif</p>
          {profile?.current_period_end && (
            <p className="mt-0.5 text-[12px] text-foyer-muted">
              Renouvellement le{" "}
              {new Date(profile.current_period_end).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
              })}
            </p>
          )}
        </div>
      </div>

      {/* Recent properties */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-foyer-muted">
            Biens récents
          </h2>
          <Link href="/pro/dashboard/biens" className="flex items-center gap-1 text-[12px] text-foyer-muted hover:text-foyer-ink">
            Voir tous <ArrowRight className="size-3" />
          </Link>
        </div>

        {recentProperties.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-foyer-border bg-foyer-cream px-6 py-10 text-center">
            <p className="text-[14px] text-foyer-muted">Aucun bien — créez-en un pour commencer.</p>
            <Link
              href="/pro/dashboard/biens/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-foyer-sage px-4 py-2 text-[13px] font-medium text-white"
            >
              <Plus className="size-3.5" />
              Créer un bien
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-foyer-border bg-foyer-cream">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-foyer-border bg-foyer-cream/50">
                  <th className="px-4 py-3 text-left font-semibold text-foyer-muted">Adresse</th>
                  <th className="px-4 py-3 text-left font-semibold text-foyer-muted">Type</th>
                  <th className="hidden px-4 py-3 text-left font-semibold text-foyer-muted sm:table-cell">Pièces</th>
                  <th className="px-4 py-3 text-right font-semibold text-foyer-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentProperties.slice(0, 5).map((p, i) => (
                  <tr key={p.id} className={i < recentProperties.length - 1 ? "border-b border-foyer-border" : ""}>
                    <td className="px-4 py-3 font-medium text-foyer-ink">{p.address}</td>
                    <td className="px-4 py-3 capitalize text-foyer-muted">{p.property_type}</td>
                    <td className="hidden px-4 py-3 text-foyer-muted sm:table-cell">
                      {(p as unknown as { pro_property_rooms?: Array<{ count: number }> }).pro_property_rooms?.[0]?.count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/pro/dashboard/biens/${p.id}`} className="text-foyer-muted hover:text-foyer-ink">Voir</Link>
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

      {/* Recent jobs */}
      {recentJobs.length > 0 && (
        <div>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-foyer-muted">
            Jobs récents
          </h2>
          <div className="overflow-hidden rounded-2xl border border-foyer-border bg-foyer-cream">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-foyer-border bg-foyer-cream/50">
                  <th className="px-4 py-3 text-left font-semibold text-foyer-muted">Bien</th>
                  <th className="px-4 py-3 text-left font-semibold text-foyer-muted">Rendus</th>
                  <th className="px-4 py-3 text-left font-semibold text-foyer-muted">Statut</th>
                  <th className="px-4 py-3 text-right font-semibold text-foyer-muted">Voir</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((j, i) => (
                  <tr key={j.id} className={i < recentJobs.length - 1 ? "border-b border-foyer-border" : ""}>
                    <td className="px-4 py-3 text-foyer-ink">
                      {(j as unknown as { pro_properties?: { address?: string } }).pro_properties?.address ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-foyer-muted">
                      {j.completed_renders}/{j.total_renders}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[j.status] ?? STATUS_COLORS.pending}`}>
                        {STATUS_LABELS[j.status] ?? j.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/pro/dashboard/jobs/${j.id}`} className="text-foyer-muted hover:text-foyer-ink">
                        <ArrowRight className="ml-auto size-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
