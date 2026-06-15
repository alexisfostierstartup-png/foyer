"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { RecentCall } from "./_data";

const STEPS = ["vision_detection","verdict","generation","iteration","audit","repair","embedding","scraping_lbc","matching","other"];
const PROVIDERS = ["gemini_vision","nano_banana","flux_kontext","jina","piloterr"];

function fmtCost(v: number) {
  return v === 0 ? "—" : v < 0.001 ? `$${(v * 1000).toFixed(3)}m` : `$${v.toFixed(4)}`;
}
function fmtMs(v: number | null) {
  if (v == null) return "—";
  return v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}ms`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export function RecentCallsTable({ calls }: { calls: RecentCall[] }) {
  const router = useRouter();
  const params = useSearchParams();

  const step = params.get("step") ?? "";
  const provider = params.get("provider") ?? "";
  const success = params.get("success") ?? "";

  function setFilter(key: string, val: string) {
    const p = new URLSearchParams(params.toString());
    if (val) p.set(key, val); else p.delete(key);
    router.push(`/admin/dashboard?${p.toString()}`);
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={step}
          onChange={(e) => setFilter("step", e.target.value)}
          className="text-xs border border-foyer-border rounded px-2 py-1 bg-white text-foyer-ink"
        >
          <option value="">Tous les steps</option>
          {STEPS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={provider}
          onChange={(e) => setFilter("provider", e.target.value)}
          className="text-xs border border-foyer-border rounded px-2 py-1 bg-white text-foyer-ink"
        >
          <option value="">Tous les providers</option>
          {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={success}
          onChange={(e) => setFilter("success", e.target.value)}
          className="text-xs border border-foyer-border rounded px-2 py-1 bg-white text-foyer-ink"
        >
          <option value="">Tous statuts</option>
          <option value="ok">Succès</option>
          <option value="fail">Échec</option>
        </select>
        {(step || provider || success) && (
          <button
            onClick={() => router.push("/admin/dashboard")}
            className="text-xs text-foyer-muted underline"
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-foyer-border text-foyer-muted text-left">
              <th className="pb-2 pr-3 font-medium">Date</th>
              <th className="pb-2 pr-3 font-medium">Projet</th>
              <th className="pb-2 pr-3 font-medium">Step</th>
              <th className="pb-2 pr-3 font-medium">Provider / modèle</th>
              <th className="pb-2 pr-3 font-medium text-right">Coût</th>
              <th className="pb-2 pr-3 font-medium text-right">Latence</th>
              <th className="pb-2 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {calls.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-foyer-muted">Aucun appel</td>
              </tr>
            )}
            {calls.map((c) => (
              <tr key={c.id} className="border-b border-foyer-border/50 hover:bg-foyer-border/20 group">
                <td className="py-1.5 pr-3 text-foyer-muted">{fmtDate(c.createdAt)}</td>
                <td className="py-1.5 pr-3">
                  {c.projectId ? (
                    <Link
                      href={`/create/${c.projectId}`}
                      className="text-foyer-ink underline hover:text-foyer-terra"
                    >
                      {c.projectId.slice(0, 8)}…
                    </Link>
                  ) : (
                    <span className="text-foyer-muted">—</span>
                  )}
                </td>
                <td className="py-1.5 pr-3">
                  <span className="rounded bg-foyer-ink/10 px-1.5 py-0.5 font-mono">{c.step}</span>
                </td>
                <td className="py-1.5 pr-3">
                  <span className="text-foyer-ink">{c.provider}</span>
                  {c.model && <span className="text-foyer-muted ml-1">/ {c.model}</span>}
                </td>
                <td className="py-1.5 pr-3 text-right font-mono">{fmtCost(c.totalCost)}</td>
                <td className="py-1.5 pr-3 text-right font-mono">{fmtMs(c.latencyMs)}</td>
                <td className="py-1.5">
                  {c.success ? (
                    <span className="text-emerald-600">✓</span>
                  ) : (
                    <span className="text-red-500 cursor-help" title={c.error ?? "unknown"}>✗</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
