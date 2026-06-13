"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ElementDecision } from "@/lib/diy/types";

const MISMATCH_LABELS: Record<string, string> = {
  none: "Garder",
  surface: "Personnaliser",
  structural: "Remplacer",
};

const MISMATCH_COLORS: Record<string, string> = {
  none: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
  surface: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
  structural: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
};

const MISMATCH_ACTIVE: Record<string, string> = {
  none: "bg-emerald-600 text-white border-emerald-600",
  surface: "bg-amber-500 text-white border-amber-500",
  structural: "bg-red-500 text-white border-red-500",
};

type OverrideMap = Record<string, ElementDecision["mismatch_type"]>;

type Props = {
  projectId: string;
  initialDecisions?: ElementDecision[] | null;
};

export function ReviewScreen({ projectId, initialDecisions }: Props) {
  const router = useRouter();
  const [decisions, setDecisions] = useState<ElementDecision[]>(
    initialDecisions ?? [],
  );
  const [overrides, setOverrides] = useState<OverrideMap>({});
  const [loading, setLoading] = useState(!initialDecisions);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialDecisions) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/analyze`, {
          method: "POST",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? "Analyse échouée");
        }
        const data = await res.json() as { ok: boolean };
        if (!data.ok) throw new Error("Analyse échouée");
        const projRes = await fetch(`/api/projects/${projectId}/decisions`);
        if (projRes.ok) {
          const projData = await projRes.json() as { decisions?: ElementDecision[] };
          setDecisions(projData.decisions ?? []);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur inattendue");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, initialDecisions]);

  function toggle(elementId: string, value: ElementDecision["mismatch_type"]) {
    const original = decisions.find((d) => d.element_id === elementId);
    if (!original) return;
    setOverrides((prev) => {
      const current = prev[elementId] ?? original.mismatch_type;
      if (current === value) {
        const next = { ...prev };
        delete next[elementId];
        return next;
      }
      if (value === original.mismatch_type) {
        const next = { ...prev };
        delete next[elementId];
        return next;
      }
      return { ...prev, [elementId]: value };
    });
  }

  async function handleGenerate(applyOverrides: boolean) {
    if (applyOverrides && Object.keys(overrides).length > 0) {
      await fetch(`/api/projects/${projectId}/decisions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides }),
      });
    }
    router.push(`/create/generating?projectId=${projectId}`);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6">
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-foyer-terra animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <p className="text-foyer-muted text-sm">Analyse de votre pièce en cours…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-red-600 text-sm">{error}</p>
        <button
          onClick={() => handleGenerate(false)}
          className="px-6 py-3 bg-foyer-ink text-foyer-cream rounded-xl text-sm"
        >
          Générer quand même
        </button>
      </div>
    );
  }

  const hasOverrides = Object.keys(overrides).length > 0;

  return (
    <div className="min-h-screen bg-foyer-cream flex flex-col">
      <div className="max-w-2xl mx-auto w-full px-4 py-8 pb-32">
        <h1 className="font-serif text-2xl text-foyer-ink mb-2">
          Voici ce qu'on va faire
        </h1>
        <p className="text-foyer-muted text-sm mb-8">
          Ajustez si besoin, ou générez directement.
        </p>

        {decisions.length === 0 ? (
          <p className="text-foyer-muted text-sm text-center py-12">
            Aucun élément détecté.
          </p>
        ) : (
          <div className="space-y-3">
            {decisions.map((d) => {
              const current = overrides[d.element_id] ?? d.mismatch_type;
              const isOverridden = d.element_id in overrides;

              return (
                <div
                  key={d.element_id}
                  className={`rounded-xl border p-4 transition-all ${
                    isOverridden ? "border-foyer-terra/30 bg-foyer-terra/5" : "border-foyer-border bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-sm font-medium text-foyer-ink capitalize">
                        {d.category.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-foyer-muted line-clamp-2">
                        {d.description}
                      </p>
                      {d.action_label && current === "surface" && (
                        <p className="text-xs text-foyer-terra mt-1">
                          {d.action_label}
                          {d.qty && d.qty_unit ? ` — ${d.qty} ${d.qty_unit}` : ""}
                        </p>
                      )}
                    </div>
                    {isOverridden && (
                      <span className="text-[10px] text-foyer-terra bg-foyer-terra/10 px-2 py-0.5 rounded-full shrink-0">
                        modifié
                      </span>
                    )}
                  </div>

                  <div className="flex gap-1.5 flex-wrap">
                    {(["none", "surface", "structural"] as const).map((type) => {
                      const active = current === type;
                      return (
                        <button
                          key={type}
                          onClick={() => toggle(d.element_id, type)}
                          className={`px-3 py-1 text-xs rounded-lg border transition-all ${
                            active ? MISMATCH_ACTIVE[type] : MISMATCH_COLORS[type]
                          }`}
                        >
                          {MISMATCH_LABELS[type]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 inset-x-0 bg-foyer-cream/95 backdrop-blur-sm border-t border-foyer-border px-4 py-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-2.5">
          <button
            onClick={() => handleGenerate(false)}
            className="w-full py-3.5 bg-foyer-ink text-foyer-cream rounded-xl text-sm font-medium"
          >
            Générer directement
          </button>
          {hasOverrides && (
            <button
              onClick={() => handleGenerate(true)}
              className="w-full py-3 border border-foyer-terra text-foyer-terra rounded-xl text-sm"
            >
              Générer avec mes modifications ({Object.keys(overrides).length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
