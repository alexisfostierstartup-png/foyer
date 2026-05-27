import { cn } from "@/lib/utils";

type ProgressBarProps = {
  currentStep: 1 | 2 | 3 | 4 | 5;
  labels: string[];
};

export function ProgressBar({ currentStep, labels }: ProgressBarProps) {
  return (
    <header className="sticky top-0 z-10 h-[60px] border-b border-foyer-border bg-foyer-cream/90 px-4 backdrop-blur">
      <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-1.5">
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
                  state === "current" && "bg-foyer-terra",
                  state === "done" && "bg-foyer-water",
                  state === "todo" && "bg-foyer-border",
                )}
              />
            );
          })}
        </div>
        <p className="text-xs text-foyer-muted">
          Étape {currentStep} sur {labels.length} — {labels[currentStep - 1]}
        </p>
      </div>
    </header>
  );
}
