import { Suspense } from "react";
import { getDashboardData, getRecentCalls, getAlertData } from "./_data";
import { BarChart } from "./_BarChart";
import { RecentCallsTable } from "./_RecentCallsTable";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCost(v: number, decimals = 4) {
  return `$${v.toFixed(decimals)}`;
}
function fmtPct(v: number) {
  return `${v.toFixed(1)} %`;
}
function fmtMs(v: number | null) {
  if (v == null) return "—";
  return v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-foyer-border bg-white px-5 py-4">
      <p className="text-xs text-foyer-muted mb-1">{label}</p>
      <p className="text-2xl font-serif text-foyer-ink">{value}</p>
      {sub && <p className="text-xs text-foyer-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function StatTable({
  rows,
  labelKey,
}: {
  rows: Array<{
    totalCost: number;
    avgCost: number;
    calls: number;
    p50Ms: number | null;
    p95Ms: number | null;
    failureRate: number;
    [k: string]: unknown;
  }>;
  labelKey: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-foyer-muted py-4">Aucune donnée</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-foyer-border text-foyer-muted text-left">
            <th className="pb-2 pr-4 font-medium">{labelKey}</th>
            <th className="pb-2 pr-4 font-medium text-right">Appels</th>
            <th className="pb-2 pr-4 font-medium text-right">Coût total</th>
            <th className="pb-2 pr-4 font-medium text-right">Coût moy.</th>
            <th className="pb-2 pr-4 font-medium text-right">p50</th>
            <th className="pb-2 pr-4 font-medium text-right">p95</th>
            <th className="pb-2 font-medium text-right">Taux échec</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-foyer-border/50">
              <td className="py-1.5 pr-4 font-mono">{String(r[labelKey])}</td>
              <td className="py-1.5 pr-4 text-right">{r.calls}</td>
              <td className="py-1.5 pr-4 text-right font-mono">{fmtCost(r.totalCost)}</td>
              <td className="py-1.5 pr-4 text-right font-mono">{fmtCost(r.avgCost)}</td>
              <td className="py-1.5 pr-4 text-right">{fmtMs(r.p50Ms)}</td>
              <td className="py-1.5 pr-4 text-right">{fmtMs(r.p95Ms)}</td>
              <td className={`py-1.5 text-right ${r.failureRate > 5 ? "text-red-500 font-medium" : ""}`}>
                {fmtPct(r.failureRate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Props = {
  searchParams: Promise<{ step?: string; provider?: string; success?: string }>;
};

export default async function DashboardPage({ searchParams }: Props) {
  const sp = await searchParams;

  const [{ cards, byDay, byStep, byProvider }, recentCalls, alert] = await Promise.all([
    getDashboardData(),
    getRecentCalls(sp.step, sp.provider, sp.success),
    getAlertData(),
  ]);

  const alertActive = alert.avgCost7d > alert.threshold;

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-2xl text-foyer-ink">Dashboard coûts IA</h1>

      {/* Alert banner */}
      {alertActive && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-5 py-3 flex items-start gap-3">
          <span className="text-red-500 text-lg mt-0.5">⚠</span>
          <div>
            <p className="text-sm font-medium text-red-700">
              Coût moyen par projet (7 j) : {fmtCost(alert.avgCost7d)} — dépasse le seuil de {fmtCost(alert.threshold)}
            </p>
            <p className="text-xs text-red-500 mt-0.5">
              Configurable via Assets › ai_pricing › cost_alert_threshold
            </p>
          </div>
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card label="Coût aujourd'hui" value={fmtCost(cards.costToday)} />
        <Card label="Coût 7 jours" value={fmtCost(cards.cost7d)} />
        <Card label="Coût 30 jours" value={fmtCost(cards.cost30d)} />
        <Card
          label="Coût moyen / projet (30 j)"
          value={fmtCost(cards.avgCostPerProject30d)}
          sub={`${cards.projectsGenerated30d} projets générés`}
        />
        <Card
          label="Taux d'échec (30 j)"
          value={fmtPct(cards.failureRate30d)}
        />
      </div>

      {/* Bar chart */}
      <section>
        <h2 className="text-sm font-medium text-foyer-ink mb-3">Coût / jour — 30 jours</h2>
        <div className="rounded-lg border border-foyer-border bg-white p-4">
          <BarChart data={byDay} />
        </div>
      </section>

      {/* By step */}
      <section>
        <h2 className="text-sm font-medium text-foyer-ink mb-3">Répartition par step — 30 jours</h2>
        <div className="rounded-lg border border-foyer-border bg-white p-4">
          <StatTable
            rows={byStep.map((r) => ({ ...r, step: r.step }))}
            labelKey="step"
          />
        </div>
      </section>

      {/* By provider */}
      <section>
        <h2 className="text-sm font-medium text-foyer-ink mb-3">Répartition par provider — 30 jours</h2>
        <div className="rounded-lg border border-foyer-border bg-white p-4">
          <StatTable
            rows={byProvider.map((r) => ({
              ...r,
              provider: r.model ? `${r.provider} / ${r.model}` : r.provider,
            }))}
            labelKey="provider"
          />
        </div>
      </section>

      {/* Recent calls */}
      <section>
        <h2 className="text-sm font-medium text-foyer-ink mb-3">
          Derniers appels{" "}
          <span className="text-foyer-muted font-normal">(100 max)</span>
        </h2>
        <div className="rounded-lg border border-foyer-border bg-white p-4">
          <Suspense fallback={<p className="text-sm text-foyer-muted">Chargement…</p>}>
            <RecentCallsTable calls={recentCalls} />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
