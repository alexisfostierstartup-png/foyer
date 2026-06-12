import { redirect } from "next/navigation";
import { BarChart2, TrendingUp, Image, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProStats, listAllProperties, listRecentJobs } from "@/lib/db/pro";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?tab=signin");

  const [stats, allProperties, recentJobs] = await Promise.all([
    getProStats(user.id),
    listAllProperties(user.id),
    listRecentJobs(user.id, 20),
  ]);

  const totalProperties = allProperties.length;
  const completedJobs = recentJobs.filter((j) => j.status === "completed").length;
  const totalRendersAllTime = recentJobs.reduce((sum, j) => sum + (j.completed_renders ?? 0), 0);

  const statCards = [
    { label: "Biens actifs", value: stats.activeProperties, icon: Building2 },
    { label: "Rendus ce mois", value: stats.rendersThisMonth, icon: Image },
    { label: "Biens total", value: totalProperties, icon: TrendingUp },
    { label: "Rendus total (20 derniers jobs)", value: totalRendersAllTime, icon: BarChart2 },
  ];

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="font-serif text-[24px] font-medium text-foyer-ink">Statistiques</h1>
        <p className="text-[13px] text-foyer-muted">Aperçu de votre activité</p>
      </div>

      {/* Stats grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-foyer-border bg-foyer-cream p-5">
            <div className="flex items-center gap-2">
              <Icon className="size-4 text-foyer-muted" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foyer-muted">{label}</p>
            </div>
            <p className="mt-2 font-serif text-[32px] text-foyer-ink">{value}</p>
          </div>
        ))}
      </div>

      {/* Jobs breakdown */}
      <div>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-foyer-muted">
          Derniers jobs ({recentJobs.length})
        </h2>
        {recentJobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-foyer-border bg-foyer-cream py-12 text-center">
            <p className="text-[14px] text-foyer-muted">Aucun job lancé pour l'instant.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {recentJobs.map((job) => {
              const pct = job.total_renders > 0 ? (job.completed_renders / job.total_renders) * 100 : 0;
              return (
                <div key={job.id} className="flex items-center gap-4 rounded-xl border border-foyer-border bg-foyer-cream px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foyer-ink">
                      {(job as unknown as { pro_properties?: { address?: string } }).pro_properties?.address ?? "Bien"}
                    </p>
                    <p className="text-[11px] text-foyer-muted">
                      {new Date(job.created_at!).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[12px] text-foyer-muted">{job.completed_renders}/{job.total_renders}</p>
                    <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-foyer-border">
                      <div className="h-full rounded-full bg-foyer-sage" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
