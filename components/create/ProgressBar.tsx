import Link from "next/link";
import { cn } from "@/lib/utils";

type ProgressBarProps = {
  currentStep: 1 | 2 | 3 | 4 | 5;
  labels: string[];
};

export function ProgressBar({ currentStep, labels }: ProgressBarProps) {
  return (
    // z-40 : passe AU-DESSUS de la couche des pins du rendu (z-30, RenderHotspots) —
    // sinon la box « Notre sélection » d'un pin proche du haut de l'image déborde
    // sur ce header sticky au lieu de rester dessous (bug QA 2026-07-16).
    <header className="sticky top-0 z-40 border-b border-foyer-border bg-foyer-cream/95 backdrop-blur">
      <div className="flex items-center justify-between px-5 py-3">
        {/* Même logo que la landing : le parcours affichait encore « Foyer » en toutes
            lettres, alors que la marque est Héra. */}
        <Link href="/" className="flex items-center gap-2" aria-label="Héra">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/v2/brand/hera-logo-mark-bold.png" alt="" className="h-6 w-auto" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/v2/brand/hera-wordmark-regular-alpha.png"
            alt="Héra"
            className="h-5 w-auto"
          />
        </Link>
      </div>
      <div className="px-5 pb-3">
        <div className="flex items-center gap-1.5">
          {labels.map((label, i) => {
            const step = i + 1;
            const state =
              step < currentStep
                ? "done"
                : step === currentStep
                  ? "current"
                  : "todo";
            return (
              <span
                key={label}
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  state === "current" && "bg-foyer-sage",
                  state === "done" && "bg-foyer-mousse",
                  state === "todo" && "bg-foyer-border",
                )}
              />
            );
          })}
        </div>
        <p className="mt-1.5 text-[12px] text-foyer-muted">
          Étape {currentStep} sur {labels.length} — {labels[currentStep - 1]}
        </p>
      </div>
    </header>
  );
}
