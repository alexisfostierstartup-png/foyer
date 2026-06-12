import { createSupabaseAdmin } from "@/lib/supabase/server";

export type AuditScores = {
  perspectiveMatch?: number;
  roomLayout?: number;
  photoRealism?: number;
  sameRoom?: boolean;
  overallPass?: boolean;
};

type LogEntry = {
  project_id: string;
  event: "detection" | "generate" | "audit" | "iterate" | "upload";
  step?: string;
  provider?: string;
  duration_ms?: number;
  render_url?: string;
  audit_pass?: boolean;
  audit_scores?: AuditScores;
  audit_issues?: string[];
  metadata?: Record<string, unknown> | null;
};

export async function logPipelineEvent(entry: LogEntry): Promise<void> {
  try {
    const supabase = createSupabaseAdmin();
    await supabase.from("pipeline_logs").insert({
      ...entry,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      audit_scores: (entry.audit_scores ?? null) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      audit_issues: (entry.audit_issues ?? null) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: (entry.metadata ?? null) as any,
    });
  } catch (err) {
    // Never crash the pipeline over a logging failure
    console.error("[logger] failed to write pipeline log:", err);
  }
}
