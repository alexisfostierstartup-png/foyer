// Stub pour α-14 — les appels Jina/Piloterr passent par ici.
// α-14 remplacera ce stub par un vrai logging vers ai_calls.
export async function withTracking<T>(
  _step: string,
  fn: () => Promise<T>,
  _meta?: Record<string, unknown>,
): Promise<T> {
  return fn();
}
