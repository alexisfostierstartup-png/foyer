export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export default async function LogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data, error } = await createSupabaseAdmin()
    .from("pipeline_logs")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) notFound();

  const row = data as Record<string, unknown>;

  function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div className="grid grid-cols-[180px_1fr] gap-4 py-3 border-b border-foyer-border last:border-0">
        <dt className="text-xs font-medium text-foyer-muted uppercase tracking-wide pt-0.5">{label}</dt>
        <dd className="text-sm text-foyer-ink break-all">{children}</dd>
      </div>
    );
  }

  const eventColors: Record<string, string> = {
    detection: "bg-sky-50 text-sky-700",
    generate: "bg-blue-50 text-blue-700",
    audit: "bg-amber-50 text-amber-700",
    iterate: "bg-violet-50 text-violet-700",
    upload: "bg-foyer-sage/15 text-foyer-sage",
    error: "bg-red-50 text-red-700",
  };
  const event = String(row.event ?? "");
  const eventClass = eventColors[event] ?? "bg-foyer-border text-foyer-muted";

  const auditScores = row.audit_scores as Record<string, unknown> | null;
  const metadata = row.metadata as Record<string, unknown> | null;
  const auditIssues = row.audit_issues as string[] | null;

  return (
    <div className="max-w-2xl">
      <div className="mb-8 flex items-center gap-3">
        <Link href="/admin/logs" className="text-foyer-muted hover:text-foyer-ink text-sm transition-colors">
          ← Logs
        </Link>
        <span className="text-foyer-border">·</span>
        <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${eventClass}`}>
          {event}
        </span>
        <span className="font-mono text-xs text-foyer-muted">{String(row.step ?? "—")}</span>
      </div>

      <dl className="rounded-xl border border-foyer-border overflow-hidden divide-y divide-foyer-border">
        <div className="px-6 py-4 bg-foyer-border/20">
          <p className="font-mono text-xs text-foyer-muted">{String(row.id)}</p>
        </div>

        <div className="px-6 divide-y divide-foyer-border">
          <Field label="Date">
            {new Date(String(row.created_at)).toLocaleString("fr-FR", {
              dateStyle: "full",
              timeStyle: "medium",
            })}
          </Field>

          <Field label="Projet">
            <Link
              href={`/create/${row.project_id}`}
              className="font-mono hover:underline text-foyer-ink"
            >
              {String(row.project_id)}
            </Link>
          </Field>

          <Field label="Événement">
            <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${eventClass}`}>
              {event}
            </span>
          </Field>

          <Field label="Step">{String(row.step ?? "—")}</Field>

          <Field label="Provider">{String(row.provider ?? "—")}</Field>

          <Field label="Durée">
            {row.duration_ms != null
              ? `${(Number(row.duration_ms) / 1000).toFixed(2)}s (${Number(row.duration_ms).toLocaleString()} ms)`
              : "—"}
          </Field>

          {row.render_url != null && (
            <Field label="Rendu">
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={String(row.render_url)}
                  alt="rendu"
                  className="h-32 rounded-lg border border-foyer-border object-cover"
                />
                <a
                  href={String(row.render_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block font-mono text-xs text-foyer-muted hover:text-foyer-ink break-all"
                >
                  {String(row.render_url)}
                </a>
              </div>
            </Field>
          )}

          {auditScores && (
            <Field label="Scores audit">
              <pre className="text-xs bg-foyer-border/30 rounded-lg px-4 py-3 overflow-x-auto">
                {JSON.stringify(auditScores, null, 2)}
              </pre>
            </Field>
          )}

          {auditIssues && auditIssues.length > 0 && (
            <Field label="Problèmes audit">
              <ul className="space-y-1">
                {auditIssues.map((issue, i) => (
                  <li key={i} className="flex items-start gap-2 text-foyer-terra">
                    <span className="mt-0.5 shrink-0">·</span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </Field>
          )}

          {row.audit_pass != null && (
            <Field label="Audit pass">
              <span className={row.audit_pass ? "text-foyer-sage font-medium" : "text-foyer-terra font-medium"}>
                {row.audit_pass ? "✓ Oui" : "✗ Non"}
              </span>
            </Field>
          )}

          {metadata && Object.keys(metadata).length > 0 && (
            <Field label="Metadata">
              <pre className="text-xs bg-foyer-border/30 rounded-lg px-4 py-3 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(metadata, null, 2)}
              </pre>
            </Field>
          )}

          {metadata?.error != null && (
            <Field label="Erreur">
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-700 font-mono whitespace-pre-wrap break-all">
                  {String(metadata.error)}
                </p>
                {metadata.stack != null && (
                  <pre className="mt-2 text-xs text-red-500 overflow-x-auto whitespace-pre-wrap break-all opacity-70">
                    {String(metadata.stack)}
                  </pre>
                )}
              </div>
            </Field>
          )}
        </div>
      </dl>
    </div>
  );
}
