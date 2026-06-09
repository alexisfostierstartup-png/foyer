import Link from "next/link";
import { cn } from "@/lib/utils";

type ProgressBarProps = {
  currentStep: 1 | 2 | 3 | 4 | 5;
  labels: string[];
};

export function ProgressBar({ currentStep, labels }: ProgressBarProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-foyer-border bg-foyer-cream/95 backdrop-blur">
      <div className="flex items-center justify-between px-5 py-3">
        <Link
          href="/"
          className="font-serif text-xl tracking-tight text-foyer-ink"
        >
          Foyer
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
