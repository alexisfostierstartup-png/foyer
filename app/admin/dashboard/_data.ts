import { createSupabaseAdmin } from "@/lib/supabase/server";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DashboardCards = {
  costToday: number;
  cost7d: number;
  cost30d: number;
  avgCostPerProject30d: number;
  projectsGenerated30d: number;
  failureRate30d: number;
};

export type DayCost = {
  day: string; // "YYYY-MM-DD"
  cost: number;
};

export type StepRow = {
  step: string;
  calls: number;
  totalCost: number;
  avgCost: number;
  p50Ms: number | null;
  p95Ms: number | null;
  failureRate: number;
};

export type ProviderRow = {
  provider: string;
  model: string | null;
  calls: number;
  totalCost: number;
  avgCost: number;
  p50Ms: number | null;
  p95Ms: number | null;
  failureRate: number;
};

export type RecentCall = {
  id: string;
  createdAt: string;
  projectId: string | null;
  step: string;
  provider: string;
  model: string | null;
  totalCost: number;
  latencyMs: number | null;
  success: boolean;
  error: string | null;
};

// ── Raw row from ai_calls ─────────────────────────────────────────────────────

type AiCallRow = {
  id: string;
  created_at: string;
  project_id: string | null;
  step: string;
  provider: string;
  model: string | null;
  total_cost: number;
  latency_ms: number | null;
  success: boolean;
  error: string | null;
};

// ── Data loader (JS aggregation — fine for alpha volumes) ─────────────────────

async function fetchRows(days: number): Promise<AiCallRow[]> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await createSupabaseAdmin()
    .from("ai_calls")
    .select("id,created_at,project_id,step,provider,model,total_cost,latency_ms,success,error")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[dashboard] fetchRows error:", error.message);
    return [];
  }
  return (data ?? []) as AiCallRow[];
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.max(0, Math.ceil(sorted.length * p) - 1);
  return sorted[idx];
}

// ── Public query functions ────────────────────────────────────────────────────

export async function getDashboardData(): Promise<{
  cards: DashboardCards;
  byDay: DayCost[];
  byStep: StepRow[];
  byProvider: ProviderRow[];
}> {
  const rows30 = await fetchRows(30);

  const todayCutoff = new Date();
  todayCutoff.setHours(0, 0, 0, 0);
  const cutoff7 = new Date(Date.now() - 7 * 86_400_000);

  const today = rows30.filter((r) => new Date(r.created_at) >= todayCutoff);
  const d7 = rows30.filter((r) => new Date(r.created_at) >= cutoff7);
  const d30 = rows30;

  const sum = (rs: AiCallRow[]) => rs.reduce((s, r) => s + r.total_cost, 0);
  const distinctProjects = (rs: AiCallRow[]) =>
    new Set(rs.map((r) => r.project_id).filter(Boolean)).size;

  const projectsGenerated = new Set(
    d30.filter((r) => r.step === "generation" && r.success && r.project_id).map((r) => r.project_id),
  ).size;

  const failCount30 = d30.filter((r) => !r.success).length;
  const failureRate30d = d30.length ? (failCount30 / d30.length) * 100 : 0;

  const dp30 = distinctProjects(d30);
  const avgCostPerProject30d = dp30 > 0 ? sum(d30) / dp30 : 0;

  // ── By day ──────────────────────────────────────────────────────────────────
  const dayMap = new Map<string, number>();
  for (const r of d30) {
    const day = r.created_at.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + r.total_cost);
  }
  const byDay: DayCost[] = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, cost]) => ({ day, cost }));

  // ── By step ─────────────────────────────────────────────────────────────────
  const stepMap = new Map<string, AiCallRow[]>();
  for (const r of d30) {
    const g = stepMap.get(r.step) ?? [];
    g.push(r);
    stepMap.set(r.step, g);
  }
  const byStep: StepRow[] = Array.from(stepMap.entries())
    .map(([step, rs]) => {
      const latencies = rs
        .map((r) => r.latency_ms)
        .filter((v): v is number => v != null)
        .sort((a, b) => a - b);
      const total = sum(rs);
      const fails = rs.filter((r) => !r.success).length;
      return {
        step,
        calls: rs.length,
        totalCost: total,
        avgCost: rs.length ? total / rs.length : 0,
        p50Ms: percentile(latencies, 0.5),
        p95Ms: percentile(latencies, 0.95),
        failureRate: rs.length ? (fails / rs.length) * 100 : 0,
      };
    })
    .sort((a, b) => b.totalCost - a.totalCost);

  // ── By provider ─────────────────────────────────────────────────────────────
  const provMap = new Map<string, AiCallRow[]>();
  for (const r of d30) {
    const key = `${r.provider}|${r.model ?? ""}`;
    const g = provMap.get(key) ?? [];
    g.push(r);
    provMap.set(key, g);
  }
  const byProvider: ProviderRow[] = Array.from(provMap.entries())
    .map(([key, rs]) => {
      const [provider, model] = key.split("|");
      const latencies = rs
        .map((r) => r.latency_ms)
        .filter((v): v is number => v != null)
        .sort((a, b) => a - b);
      const total = sum(rs);
      const fails = rs.filter((r) => !r.success).length;
      return {
        provider,
        model: model || null,
        calls: rs.length,
        totalCost: total,
        avgCost: rs.length ? total / rs.length : 0,
        p50Ms: percentile(latencies, 0.5),
        p95Ms: percentile(latencies, 0.95),
        failureRate: rs.length ? (fails / rs.length) * 100 : 0,
      };
    })
    .sort((a, b) => b.totalCost - a.totalCost);

  return {
    cards: {
      costToday: sum(today),
      cost7d: sum(d7),
      cost30d: sum(d30),
      avgCostPerProject30d,
      projectsGenerated30d: projectsGenerated,
      failureRate30d,
    },
    byDay,
    byStep,
    byProvider,
  };
}

export async function getRecentCalls(
  filterStep?: string,
  filterProvider?: string,
  filterSuccess?: string,
): Promise<RecentCall[]> {
  const db = createSupabaseAdmin();
  let q = db
    .from("ai_calls")
    .select("id,created_at,project_id,step,provider,model,total_cost,latency_ms,success,error")
    .order("created_at", { ascending: false })
    .limit(100);

  if (filterStep) q = q.eq("step", filterStep);
  if (filterProvider) q = q.eq("provider", filterProvider);
  if (filterSuccess === "ok") q = q.eq("success", true);
  if (filterSuccess === "fail") q = q.eq("success", false);

  const { data, error } = await q;
  if (error || !data) return [];

  return (data as AiCallRow[]).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    projectId: r.project_id,
    step: r.step,
    provider: r.provider,
    model: r.model,
    totalCost: r.total_cost,
    latencyMs: r.latency_ms,
    success: r.success,
    error: r.error,
  }));
}

export async function getAlertData(): Promise<{ threshold: number; avgCost7d: number }> {
  // Threshold: default 0.50 €
  // TODO: load from assets once category='ai_pricing' constraint is extended
  const threshold = 0.5;

  // Avg cost per project last 7d
  const rows7 = await fetchRows(7);
  const totalCost7 = rows7.reduce((s, r) => s + r.total_cost, 0);
  const projects7 = new Set(rows7.map((r) => r.project_id).filter(Boolean)).size;
  const avgCost7d = projects7 > 0 ? totalCost7 / projects7 : 0;

  return { threshold, avgCost7d };
}
