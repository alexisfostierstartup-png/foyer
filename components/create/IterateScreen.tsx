"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { ProgressBar } from "@/components/create/ProgressBar";
import { cn } from "@/lib/utils";

const STEPS = ["Photo", "Style", "Mobilier", "Rendu", "Projet"];

const CHIPS = [
  "Plus de lumière naturelle",
  "Couleurs plus chaudes",
  "Style plus minimaliste",
  "Plus de verdure",
  "Meubles plus modernes",
  "Ambiance plus cosy",
];

type Props = { projectId: string };

export function IterateScreen({ projectId }: Props) {
  const router = useRouter();
  const [request, setRequest] = useState("");
  const [loading, setLoading] = useState(false);

  function addChip(chip: string) {
    setRequest((prev) =>
      prev ? `${prev.trim()} — ${chip.toLowerCase()}` : chip,
    );
  }

  async function handleApply() {
    if (!request.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/iterate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userRequest: request.trim() }),
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foyer-sage">
          Affiner
        </p>
        <h1 className="mt-1 font-serif text-[26px] font-medium leading-tight text-foyer-ink">
          Qu&apos;est-ce que vous souhaitez modifier ?
        </h1>
        <p className="mt-3 text-[15px] text-foyer-muted">
          Décrivez librement. On régénère le rendu selon vos retours.
        </p>

        {/* Suggestion chips */}
        <div className="mt-6 flex flex-wrap gap-2">
          {CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => addChip(chip)}
              className="rounded-full border border-foyer-border px-3.5 py-1.5 text-sm text-foyer-muted transition-colors hover:border-foyer-sage hover:bg-foyer-sage/5 hover:text-foyer-sage"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Textarea */}
        <div className="mt-5">
          <textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder="Ex: j'aimerais des tons plus chauds et un canapé en velours vert..."
            rows={5}
            className="w-full resize-none rounded-2xl border border-foyer-border bg-white px-4 py-3.5 text-sm text-foyer-ink outline-none placeholder:text-foyer-muted focus:border-foyer-ink"
          />
        </div>
      </main>

      {/* Sticky footer */}
      <div className="fixed bottom-0 inset-x-0 border-t border-foyer-border bg-foyer-cream/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto max-w-[480px]">
          <button
            type="button"
            disabled={!request.trim() || loading}
            onClick={handleApply}
            className={cn(
              "flex h-[52px] w-full items-center justify-center gap-2 rounded-full font-medium transition-all",
              !request.trim() || loading
                ? "bg-foyer-border text-foyer-muted"
                : "bg-foyer-sage text-white shadow-[0_2px_8px_rgba(107,142,111,0.35)] hover:-translate-y-0.5",
            )}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Génération en cours…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Appliquer les modifications
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
