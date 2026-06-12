export const dynamic = "force-dynamic";
import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { Plus } from "lucide-react";

const PURPOSES = ["generation", "iteration", "vision", "detection", "audit", "alterations", "shopping"] as const;

export default async function AdminPromptsPage() {
  const { data: prompts } = await createSupabaseAdmin()
    .from("prompts")
    .select("*")
    .order("purpose")
    .order("slug");

  const grouped = PURPOSES.reduce(
    (acc, p) => {
      acc[p] = (prompts ?? []).filter((pr) => pr.purpose === p);
      return acc;
    },
    {} as Record<string, typeof prompts>,
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-foyer-ink">Prompts</h1>
          <p className="text-sm text-foyer-muted mt-1">
            {prompts?.length ?? 0} prompt{prompts?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/admin/prompts/new"
          className="flex items-center gap-2 rounded-lg bg-foyer-ink text-foyer-cream px-4 py-2.5 text-sm font-medium hover:bg-foyer-ink/90 transition-colors"
        >
          <Plus size={16} />
          Nouveau prompt
        </Link>
      </div>

      <div className="space-y-8">
        {PURPOSES.map((purpose) => {
          const list = grouped[purpose] ?? [];
          return (
            <section key={purpose}>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="font-medium text-sm text-foyer-ink capitalize">
                  {purpose}
                </h2>
                <span className="text-xs text-foyer-muted">
                  {list.length}
                </span>
              </div>

              {list.length === 0 ? (
                <p className="text-sm text-foyer-muted italic pl-1">
                  Aucun prompt pour ce type.
                </p>
              ) : (
                <div className="rounded-lg border border-foyer-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-foyer-border bg-foyer-border/30">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-foyer-muted uppercase tracking-wide">
                          Slug
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-foyer-muted uppercase tracking-wide">
                          Provider
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-foyer-muted uppercase tracking-wide">
                          Conditions
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-foyer-muted uppercase tracking-wide">
                          v
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-foyer-muted uppercase tracking-wide">
                          Statut
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-foyer-border">
                      {list.map((prompt) => (
                        <tr key={prompt.id} className="hover:bg-foyer-border/20 transition-colors">
                          <td className="px-4 py-3">
                            <Link
                              href={`/admin/prompts/${prompt.id}`}
                              className="font-mono text-xs text-foyer-sage hover:underline"
                            >
                              {prompt.slug}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-xs text-foyer-muted font-mono">
                            {prompt.provider}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-foyer-muted">
                            {Object.keys(
                              (prompt.conditions as Record<string, unknown>) ?? {},
                            ).length === 0
                              ? "—"
                              : JSON.stringify(prompt.conditions)}
                          </td>
                          <td className="px-4 py-3 text-xs text-foyer-muted">
                            {prompt.version}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block text-xs px-2 py-0.5 rounded-full ${
                                prompt.is_active
                                  ? "bg-foyer-sage/15 text-foyer-sage"
                                  : "bg-foyer-border text-foyer-muted"
                              }`}
                            >
                              {prompt.is_active ? "actif" : "inactif"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
