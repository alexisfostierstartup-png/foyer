import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { DbPrompt } from "@/lib/db/database.types";
import type { ResolveContext, ResolvedPrompt } from "./types";

/**
 * Sélectionne le prompt actif le plus spécifique pour un slug donné.
 * Score = nombre de clés dans `conditions` qui matchent le contexte.
 * Un prompt avec conditions={} matche toujours (score 0, fallback générique).
 */
async function selectPrompt(
  slug: string,
  ctx: ResolveContext,
): Promise<DbPrompt> {
  const { data, error } = await createSupabaseAdmin()
    .from("prompts")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true);

  if (error) throw error;
  if (!data || data.length === 0)
    throw new Error(`No active prompt found for slug: ${slug}`);

  type Scored = { prompt: DbPrompt; specificity: number };
  const candidates: Scored[] = [];

  for (const p of data as DbPrompt[]) {
    const conds = (p.conditions ?? {}) as Record<string, unknown>;
    const condKeys = Object.keys(conds);

    let mismatch = false;
    for (const k of condKeys) {
      if (ctx[k] !== conds[k]) {
        mismatch = true;
        break;
      }
    }
    if (mismatch) continue;

    candidates.push({ prompt: p, specificity: condKeys.length });
  }

  if (candidates.length === 0)
    throw new Error(
      `No prompt matches the context for slug: ${slug}. Context keys: ${Object.keys(ctx).join(", ")}`,
    );

  // Plus spécifique d'abord, à égalité version la plus récente
  candidates.sort(
    (a, b) =>
      b.specificity - a.specificity || b.prompt.version - a.prompt.version,
  );

  return candidates[0].prompt;
}

function substitute(
  template: string,
  ctx: ResolveContext,
): { resolved: string; missing: string[]; used: string[] } {
  const used = new Set<string>();
  const missing = new Set<string>();

  const resolved = template.replace(/\{\{(\w+)\}\}/g, (_, varName: string) => {
    const val = ctx[varName];
    if (val !== undefined && val !== null) {
      used.add(varName);
      return String(val);
    }
    missing.add(varName);
    return `{{${varName}}}`;
  });

  return { resolved, missing: [...missing], used: [...used] };
}

/**
 * Point d'entrée principal : sélectionne et résout un prompt.
 *
 * @param slug  ex: 'gen_wow_generic', 'iterate_generic'
 * @param ctx   variables à substituer dans le template
 * @param opts.strict  si true (défaut), throw quand des variables manquent
 */
export async function resolvePrompt(
  slug: string,
  ctx: ResolveContext,
  opts: { strict?: boolean } = {},
): Promise<ResolvedPrompt> {
  const strict = opts.strict ?? true;

  const prompt = await selectPrompt(slug, ctx);
  const { resolved, missing, used } = substitute(prompt.template, ctx);

  if (strict && missing.length > 0) {
    throw new Error(
      `Missing variables for prompt "${slug}": ${missing.join(", ")}`,
    );
  }

  return {
    prompt,
    resolvedTemplate: resolved,
    missingVariables: missing,
    usedVariables: used,
  };
}
