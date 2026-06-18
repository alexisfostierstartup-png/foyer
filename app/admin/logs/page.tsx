export const dynamic = "force-dynamic";
import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase/server";

type AuditScores = {
  perspectiveMatch?: number;
  roomLayout?: number;
  photoRealism?: number;
  sameRoom?: boolean;
  overallPass?: boolean;
};

type LogRow = {
  id: string;
  created_at: string;
  project_id: string;
  event: string;
  step: string | null;
  provider: string | null;
  duration_ms: number | null;
  render_url: string | null;
  audit_pass: boolean | null;
  audit_scores: AuditScores | null;
  audit_issues: string[] | null;
  metadata: Record<string, unknown> | null;
};

function ScorePill({ label, title, value }: { label: string; title: string; value: number | undefined }) {
  if (value === undefined) return null;
  const ok = value >= 7;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded font-mono cursor-default ${
        ok ? "bg-foyer-sage/15 text-foyer-sage" : "bg-foyer-terra/15 text-foyer-terra"
      }`}
    >
      <span className="opacity-60">{label}</span>
      <span className="font-semibold">{value}/10</span>
    </span>
  );
}

function BoolPill({ label, value }: { label: string; value: boolean | undefined }) {
  if (value === undefined) return null;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded font-mono ${
        value ? "bg-foyer-sage/15 text-foyer-sage" : "bg-foyer-terra/15 text-foyer-terra"
      }`}
    >
      <span className="opacity-60">{label}</span>
      <span>{value ? "✓" : "✗"}</span>
    </span>
  );
}

function EventBadge({ event }: { event: string }) {
  const styles: Record<string, string> = {
    detection: "bg-sky-50 text-sky-700",
    generate: "bg-blue-50 text-blue-700",
    audit: "bg-amber-50 text-amber-700",
    iterate: "bg-violet-50 text-violet-700",
    upload: "bg-foyer-sage/15 text-foyer-sage",
  };
  return (
    <span
      className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${styles[event] ?? "bg-foyer-border text-foyer-muted"}`}
    >
      {event}
    </span>
  );
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

export default async function AdminLogsPage() {
  const { data: logs, error } = await createSupabaseAdmin()
    .from("pipeline_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (logs ?? []) as LogRow[];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-2xl text-foyer-ink">Logs pipeline</h1>
        <p className="text-sm text-foyer-muted mt-1">
          {rows.length} événement{rows.length !== 1 ? "s" : ""} — 200 derniers
        </p>
        {error && (
          <p className="mt-2 text-sm text-foyer-terra">Erreur : {error.message}</p>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-foyer-muted italic">
          Aucun log pour l&apos;instant. Lance une génération pour voir les événements ici.
        </p>
      ) : (
        <div className="rounded-lg border border-foyer-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foyer-border bg-foyer-border/30">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-foyer-muted uppercase tracking-wide w-16">
                  Il y a
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-foyer-muted uppercase tracking-wide">
                  Projet
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-foyer-muted uppercase tracking-wide">
                  Événement
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-foyer-muted uppercase tracking-wide">
                  Step
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-foyer-muted uppercase tracking-wide">
                  Durée
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-foyer-muted uppercase tracking-wide">
                  Scores audit
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-foyer-muted uppercase tracking-wide">
                  Rendu
                </th>
                <th className="px-4 py-2.5 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-foyer-border">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-foyer-border/20 transition-colors group">
                  <td className="px-4 py-3 text-xs text-foyer-muted font-mono">
                    {timeAgo(row.created_at)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-foyer-muted">
                    {row.project_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">
                    <EventBadge event={row.event} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-foyer-muted">
                    {row.step ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-foyer-muted font-mono">
                    {row.duration_ms != null ? `${(row.duration_ms / 1000).toFixed(1)}s` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {row.audit_scores ? (
                      <div className="flex flex-wrap gap-1">
                        <ScorePill label="perspective" title="Angle de caméra identique (score ≥7 = ok)" value={row.audit_scores.perspectiveMatch} />
                        <ScorePill label="layout" title="Structure de la pièce préservée — fenêtres, portes, proportions (score ≥7 = ok)" value={row.audit_scores.roomLayout} />
                        <ScorePill label="réalisme" title="Aspect photoréaliste (score ≥6 = ok)" value={row.audit_scores.photoRealism} />
                        <BoolPill label="room" value={row.audit_scores.sameRoom} />
                        <BoolPill label="pass" value={row.audit_scores.overallPass} />
                        {row.audit_issues && row.audit_issues.length > 0 && (
                          <span
                            className="text-xs text-foyer-terra italic"
                            title={row.audit_issues.join(" · ")}
                          >
                            {row.audit_issues.length} issue{row.audit_issues.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-foyer-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.render_url ? (
                      <a
                        href={row.render_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative inline-block"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={row.render_url}
                          alt="rendu"
                          className="h-10 w-16 object-cover rounded border border-foyer-border group-hover:border-foyer-ink transition-colors"
                        />
                      </a>
                    ) : (
                      <span className="text-xs text-foyer-muted">—</span>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    <Link
                      href={`/admin/logs/${row.id}`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-foyer-muted hover:text-foyer-ink text-xs"
                      title="Voir le détail"
                    >
                      →
                    </Link>
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
