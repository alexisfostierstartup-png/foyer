export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase/server";

type AiCall = {
  id: string;
  created_at: string;
  step: string;
  provider: string;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  images_in: number;
  images_out: number;
  total_cost: number;
  latency_ms: number | null;
  success: boolean;
  error: string | null;
  request_payload: unknown;
  response_payload: unknown;
};

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

  // Fetch ai_calls for this project (all, ordered by time — user correlates by step+ts)
  const { data: aiCalls } = await createSupabaseAdmin()
    .from("ai_calls")
    .select("id,created_at,step,provider,model,input_tokens,output_tokens,images_in,images_out,total_cost,latency_ms,success,error,request_payload,response_payload")
    .eq("project_id", row.project_id as string)
    .order("created_at", { ascending: false })
    .limit(50);

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

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  }
  function fmtMs(v: number | null) {
    if (v == null) return "—";
    return v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}ms`;
  }
  function fmtCost(usd: number) {
    const v = usd * 0.92;
    return v < 0.001 ? `${(v * 1000).toFixed(3)} m€` : `${v.toFixed(4)} €`;
  }

  const calls = (aiCalls ?? []) as AiCall[];

  return (
    <div>
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

      {/* ── Pipeline log entry ── */}
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

      {/* ── AI Calls pour ce projet ── */}
      {calls.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-medium text-foyer-ink mb-4">
            Appels IA — projet{" "}
            <span className="font-mono text-foyer-muted">{String(row.project_id).slice(0, 8)}…</span>
            <span className="ml-2 text-foyer-muted font-normal">({calls.length})</span>
          </h2>

          <div className="space-y-3">
            {calls.map((c) => (
              <details
                key={c.id}
                className="rounded-xl border border-foyer-border overflow-hidden group"
              >
                {/* ── Summary row ── */}
                <summary className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-foyer-border/20 transition-colors list-none select-none">
                  {/* expand chevron */}
                  <span className="text-foyer-muted text-xs transition-transform group-open:rotate-90">▶</span>

                  {/* status dot */}
                  <span className={`w-2 h-2 rounded-full shrink-0 ${c.success ? "bg-emerald-500" : "bg-red-500"}`} />

                  {/* timestamp */}
                  <span className="text-xs text-foyer-muted font-mono w-32 shrink-0">
                    {fmtDate(c.created_at)}
                  </span>

                  {/* step badge */}
                  <span className="rounded bg-foyer-ink/10 px-2 py-0.5 text-xs font-mono text-foyer-ink">
                    {c.step}
                  </span>

                  {/* provider */}
                  <span className="text-xs text-foyer-muted">
                    {c.provider}{c.model ? ` / ${c.model}` : ""}
                  </span>

                  {/* spacer */}
                  <span className="flex-1" />

                  {/* cost + latency */}
                  <span className="text-xs font-mono text-foyer-ink">{fmtCost(c.total_cost)}</span>
                  <span className="text-xs text-foyer-muted w-16 text-right">{fmtMs(c.latency_ms)}</span>

                  {/* tokens */}
                  {(c.input_tokens != null || c.output_tokens != null) && (
                    <span className="text-xs text-foyer-muted font-mono w-28 text-right">
                      {c.input_tokens ?? 0} in / {c.output_tokens ?? 0} out
                    </span>
                  )}

                  {/* error hint */}
                  {!c.success && c.error && (
                    <span className="text-xs text-red-500 truncate max-w-[200px]" title={c.error}>
                      {c.error}
                    </span>
                  )}
                </summary>

                {/* ── Expanded payload/response ── */}
                <div className="border-t border-foyer-border divide-y divide-foyer-border/60">
                  {/* Request payload */}
                  <div className="px-5 py-4">
                    <p className="text-xs font-medium text-foyer-muted uppercase tracking-wide mb-2">
                      Payload envoyé
                    </p>
                    {c.request_payload != null ? (
                      <pre className="text-xs bg-foyer-border/20 rounded-lg px-4 py-3 overflow-x-auto whitespace-pre-wrap break-all max-h-80 overflow-y-auto">
                        {JSON.stringify(c.request_payload, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-xs text-foyer-muted italic">
                        Aucun payload — appel antérieur à cette fonctionnalité
                      </p>
                    )}
                  </div>

                  {/* Response payload */}
                  <div className="px-5 py-4">
                    <p className="text-xs font-medium text-foyer-muted uppercase tracking-wide mb-2">
                      Réponse reçue
                    </p>
                    {c.response_payload != null ? (
                      <pre className="text-xs bg-foyer-border/20 rounded-lg px-4 py-3 overflow-x-auto whitespace-pre-wrap break-all max-h-80 overflow-y-auto">
                        {JSON.stringify(c.response_payload, null, 2)}
                      </pre>
                    ) : c.step === "generation" || c.step === "iteration" ? (
                      <p className="text-xs text-foyer-muted italic">
                        Réponse = image binaire, non stockée
                      </p>
                    ) : (
                      <p className="text-xs text-foyer-muted italic">
                        Aucune réponse — appel antérieur à cette fonctionnalité
                      </p>
                    )}
                  </div>

                  {/* Error detail if failed */}
                  {!c.success && c.error && (
                    <div className="px-5 py-4">
                      <p className="text-xs font-medium text-foyer-muted uppercase tracking-wide mb-2">Erreur</p>
                      <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                        <p className="text-sm text-red-700 font-mono whitespace-pre-wrap break-all">{c.error}</p>
                      </div>
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
