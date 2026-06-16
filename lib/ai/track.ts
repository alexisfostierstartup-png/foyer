import { createSupabaseAdmin } from "@/lib/supabase/server";
import { computeCost } from "./pricing";
import type { UsageMetadata } from "./types";

export type AiCallStep =
  | "vision_detection"
  | "verdict"
  | "generation"
  | "iteration"
  | "audit"
  | "repair"
  | "embedding"
  | "scraping_lbc"
  | "matching"
  | "other";

export type TrackingConfig = {
  step: AiCallStep;
  projectId?: string | null;
  iterationId?: string | null;
  provider: string;
  requestPayload?: unknown;
};

type TrackableResult = {
  durationMs: number;
  modelUsed?: string;
  usage?: UsageMetadata;
  responsePayload?: unknown;
};

export async function withTracking<T extends TrackableResult>(
  config: TrackingConfig,
  fn: () => Promise<T>,
): Promise<T> {
  let result: T | undefined;
  let success = true;
  let errorMsg: string | undefined;

  try {
    result = await fn();
    return result;
  } catch (err) {
    success = false;
    errorMsg = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    // Best-effort: never crash the pipeline over a tracking failure
    void insertCall(config, result, success, errorMsg);
  }
}

async function insertCall(
  config: TrackingConfig,
  result: TrackableResult | undefined,
  success: boolean,
  error: string | undefined,
): Promise<void> {
  try {
    const usage = result?.usage;
    const model = result?.modelUsed ?? null;
    const totalCost = await computeCost({
      provider: config.provider,
      model,
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      imagesIn: usage?.imagesIn,
      imagesOut: usage?.imagesOut,
    });

    await createSupabaseAdmin().from("ai_calls").insert({
      project_id: config.projectId ?? null,
      iteration_id: config.iterationId ?? null,
      step: config.step,
      provider: config.provider,
      model,
      input_tokens: usage?.inputTokens ?? null,
      output_tokens: usage?.outputTokens ?? null,
      images_in: usage?.imagesIn ?? 0,
      images_out: usage?.imagesOut ?? 0,
      total_cost: totalCost,
      latency_ms: result?.durationMs ?? null,
      success,
      error: error ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      request_payload: config.requestPayload != null ? (config.requestPayload as any) : null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response_payload: result?.responsePayload != null ? (result.responsePayload as any) : null,
    });
  } catch (err) {
    console.error("[track] failed to insert ai_call:", err instanceof Error ? err.message : err);
  }
}
