/**
 * Comparaison de chaînes en temps constant (pur JS → compatible edge runtime,
 * où node:crypto.timingSafeEqual n'est pas garanti). Évite les oracles de timing
 * sur les secrets partagés (token de session admin, mot de passe admin).
 */
export function safeEqual(a: string | undefined | null, b: string | undefined | null): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
