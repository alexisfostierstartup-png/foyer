"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ProgressBar } from "@/components/create/ProgressBar";
import { StyleCard } from "@/components/create/StyleCard";
import { REVIEW_ENABLED } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Style } from "@/lib/types";

const STEPS = ["Photo", "Style", "Mobilier", "Rendu", "Projet"];

type StyleSelectorProps = {
  projectId: string;
  styles: Style[];
  // Mode expert : parcours court (style → génération directe, pas d'écran review —
  // l'analyse tourne automatiquement pendant la génération).
  expert?: boolean;
};

export function StyleSelector({
  projectId,
  styles,
  expert = false,
}: StyleSelectorProps) {
  const router = useRouter();
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"rendu" | "dispositions" | null>(null);

  // Sans écran review (production), c'est ici qu'on lance : les deux CTA de la review
  // remontent sur cet écran, et la génération déclenche elle-même l'analyse de la pièce.
  const lanceIci = !REVIEW_ENABLED && !expert;

  async function lancer(cible: "rendu" | "dispositions") {
    if (!selectedStyleId) return;
    setSubmitting(cible);
    try {
      const res = await fetch(`/api/projects/${projectId}/style`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleId: selectedStyleId }),
      });
      if (!res.ok) {
        toast.error("Erreur lors de l'enregistrement de l'ambiance");
        setSubmitting(null);
        return;
      }
      if (cible === "dispositions") {
        router.push(`/create/dispositions?projectId=${projectId}`);
        return;
      }
      router.push(
        expert || !REVIEW_ENABLED
          ? `/create/generating?projectId=${projectId}`
          : `/create/${projectId}/review`,
      );
    } catch {
      toast.error("Erreur lors de l'enregistrement de l'ambiance");
      setSubmitting(null);
    }
  }

  // Le drapeau vient de la base (assets.ambiance.data.stable) : le sélecteur ne connaît
  // aucune liste de styles en dur, on en promeut un sans toucher au code.
  const stables = styles.filter((s) => s.stable);
  const beta = styles.filter((s) => !s.stable);

  const grille = (liste: typeof styles) => (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {liste.map((style) => (
        <StyleCard
          key={style.id}
          style={style}
          selected={selectedStyleId === style.id}
          onSelect={() => setSelectedStyleId(style.id)}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-1 flex-col">
      <ProgressBar currentStep={2} labels={STEPS} />

      <main className="mx-auto w-full max-w-[480px] lg:max-w-[960px] flex-1 px-5 pb-28 pt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foyer-sage">
          Style
        </p>
        <h1 className="mt-1 font-serif text-[26px] font-medium leading-tight text-foyer-ink">
          Quelle ambiance ?
        </h1>

        <div
          role="radiogroup"
          aria-label="Ambiances"
          className="mt-6 duration-200 animate-in fade-in"
        >
          {grille(stables)}

          {beta.length > 0 && (
            <div className="mt-10">
              {/* Filets de part et d'autre : le titre séparait mal les deux groupes, on le
                  lisait comme un simple libellé de plus. */}
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-foyer-border" />
                <h2 className="whitespace-nowrap text-center font-serif text-[17px] text-foyer-ink">
                  Beta{" "}
                  <span className="text-[15px] text-foyer-muted">
                    (en cours de finalisation)
                  </span>
                </h2>
                <span className="h-px flex-1 bg-foyer-border" />
              </div>
              <p className="mb-4 mt-2 text-center text-[12px] leading-relaxed text-foyer-muted">
                Vous pouvez les tester, mais notre catalogue est encore incomplet sur
                certaines catégories.
              </p>
              {grille(beta)}
            </div>
          )}
        </div>
      </main>

      <div className="sticky bottom-0 border-t border-foyer-border bg-foyer-cream/95 px-5 py-3 backdrop-blur">
        {/* Le bouton suivait la largeur de l'ÉCRAN, pas celle du contenu : la barre n'était
            pas bornée alors que la liste l'est à 480px. Sur un écran large, il s'étirait
            seul sur toute la page. */}
        <div className="mx-auto flex w-full max-w-[480px] flex-col gap-2.5">
          <button
            type="button"
            disabled={!selectedStyleId || submitting !== null}
            onClick={() => lancer("rendu")}
            className={cn(
              "flex h-[52px] w-full items-center justify-center gap-2 rounded-full font-medium transition-all",
              !selectedStyleId || submitting !== null
                ? "cursor-not-allowed bg-foyer-border text-foyer-muted"
                : "bg-foyer-sage text-white shadow-[0_2px_8px_rgba(107,142,111,0.35)] hover:-translate-y-0.5 hover:bg-foyer-sage/90 hover:shadow-[0_4px_14px_rgba(107,142,111,0.45)]",
            )}
          >
            {submitting === "rendu" ? (
              <>
                <Loader2 className="size-5 animate-spin" aria-hidden />
                Patientez…
              </>
            ) : (
              "Générer le rendu"
            )}
          </button>

          {lanceIci && (
            <button
              type="button"
              disabled={!selectedStyleId || submitting !== null}
              onClick={() => lancer("dispositions")}
              className={cn(
                "flex h-[48px] w-full items-center justify-center gap-2 rounded-full border font-medium transition-colors",
                !selectedStyleId || submitting !== null
                  ? "cursor-not-allowed border-foyer-border text-foyer-muted"
                  : "border-foyer-border text-foyer-ink hover:border-foyer-ink/40 hover:bg-foyer-border/30",
              )}
            >
              {submitting === "dispositions" ? (
                <>
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                  Patientez…
                </>
              ) : (
                <>
                  Lancer 3 dispositions
                  <span className="rounded-full bg-foyer-terra/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-foyer-terra">
                    expert
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
