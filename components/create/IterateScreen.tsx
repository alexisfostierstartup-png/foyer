"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressBar } from "@/components/create/ProgressBar";

const STEPS = ["Photo", "Style", "Mobilier", "Rendu", "Projet"];

type Category = { id: string; label: string; options: string[] };

const CATEGORIES: Category[] = [
  {
    id: "meubles",
    label: "Meubles",
    options: ["Ajouter un fauteuil", "Enlever un meuble", "Canapé plus grand"],
  },
  {
    id: "sol",
    label: "Sol",
    options: ["Plus clair", "Plus foncé", "Changer le revêtement"],
  },
  {
    id: "murs",
    label: "Murs",
    options: ["Plus chauds", "Plus clairs", "Ajouter des moulures"],
  },
  {
    id: "plafond",
    label: "Plafond",
    options: ["Plus lumineux", "Poutres apparentes", "Blanc pur"],
  },
  {
    id: "eclairage",
    label: "Éclairage",
    options: ["Plus chaleureux", "Ajouter une lampe", "Lumière naturelle"],
  },
  {
    id: "accessoires",
    label: "Accessoires",
    options: ["Plus de plantes", "Moins chargé", "Ajouter des coussins"],
  },
];

function buildUserRequest(
  selections: Record<string, string[]>,
  notes: Record<string, string>,
): string {
  const parts: string[] = [];
  for (const cat of CATEGORIES) {
    const chips = selections[cat.id] ?? [];
    const note = notes[cat.id]?.trim() ?? "";
    if (chips.length === 0 && !note) continue;
    const line = [chips.join(", "), note].filter(Boolean).join(". ");
    parts.push(`${cat.label}: ${line}`);
  }
  return parts.join(". ");
}

type Props = { projectId: string; currentRenderUrl: string };

export function IterateScreen({ projectId, currentRenderUrl }: Props) {
  const router = useRouter();
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function toggleOption(catId: string, option: string) {
    setSelections((prev) => {
      const cur = prev[catId] ?? [];
      const next = cur.includes(option)
        ? cur.filter((o) => o !== option)
        : [...cur, option];
      return { ...prev, [catId]: next };
    });
  }

  const userRequest = buildUserRequest(selections, notes);
  const hasChanges = userRequest.length > 0;

  async function handleApply() {
    if (!hasChanges) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/iterate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userRequest }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? "L'itération a échoué. Réessayez.");
        setLoading(false);
        return;
      }
      router.push(`/create/${projectId}/final`);
    } catch {
      toast.error("L'itération a échoué. Réessayez.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <ProgressBar currentStep={4} labels={STEPS} />

      <main className="mx-auto w-full max-w-[480px] flex-1 px-5 pb-28 pt-6">
        <h1 className="font-serif text-[26px] font-medium leading-tight tracking-[-0.02em] text-foyer-ink">
          Qu&apos;aimeriez-vous changer&nbsp;?
        </h1>

        <div className="mt-5 overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentRenderUrl}
            alt="Rendu actuel"
            className="w-full object-cover"
          />
        </div>

        <div className="mt-5 divide-y divide-foyer-border overflow-hidden rounded-2xl border border-foyer-border bg-white">
          {CATEGORIES.map((cat) => {
            const open = openCat === cat.id;
            const count =
              (selections[cat.id]?.length ?? 0) +
              (notes[cat.id]?.trim() ? 1 : 0);
            return (
              <div key={cat.id}>
                <button
                  type="button"
                  onClick={() => setOpenCat(open ? null : cat.id)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between px-4 py-3.5 text-left"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-foyer-ink">{cat.label}</span>
                    {count > 0 && (
                      <span className="flex size-5 items-center justify-center rounded-full bg-foyer-sage text-[11px] font-medium text-white">
                        {count}
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 text-foyer-muted transition-transform",
                      open && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>

                {open && (
                  <div className="px-4 pb-4">
                    <div className="flex flex-wrap gap-2">
                      {cat.options.map((opt) => {
                        const on = selections[cat.id]?.includes(opt) ?? false;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => toggleOption(cat.id, opt)}
                            className={cn(
                              "rounded-full px-3 py-1.5 text-sm transition-colors",
                              on
                                ? "border-2 border-foyer-ink bg-foyer-ink/5 text-foyer-ink"
                                : "border border-foyer-border text-foyer-muted hover:text-foyer-ink",
                            )}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    <textarea
                      value={notes[cat.id] ?? ""}
                      onChange={(e) =>
                        setNotes((prev) => ({ ...prev, [cat.id]: e.target.value }))
                      }
                      placeholder={`Précisez pour ${cat.label.toLowerCase()}…`}
                      rows={2}
                      className="mt-3 w-full resize-none rounded-xl border border-foyer-border bg-foyer-cream px-3 py-2.5 text-sm text-foyer-ink outline-none placeholder:text-foyer-muted focus:border-foyer-ink"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-foyer-border bg-foyer-cream/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto max-w-[480px]">
          <button
            type="button"
            disabled={!hasChanges || loading}
            onClick={handleApply}
            className={cn(
              "flex h-[52px] w-full items-center justify-center gap-2 rounded-full font-medium transition-all",
              !hasChanges || loading
                ? "bg-foyer-border text-foyer-muted"
                : "bg-foyer-sage text-white shadow-[0_2px_8px_rgba(107,142,111,0.35)] hover:-translate-y-0.5",
            )}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Retouche en cours…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Appliquer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
