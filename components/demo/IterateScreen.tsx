"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { PrimaryButton, DemoImage } from "@/components/demo/primitives";

const CHIPS = [
  "Sol plus clair",
  "Sol moins en chevron",
  "Ajouter un fauteuil",
  "Murs plus chauds",
];

export function IterateScreen({ onApply }: { onApply: () => void }) {
  const [active, setActive] = useState<string[]>([]);
  const [note, setNote] = useState("");

  function toggle(chip: string) {
    setActive((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip],
    );
  }

  return (
    <div className="flex flex-1 flex-col pb-24">
      <h1 className="font-serif text-[26px] font-medium leading-tight tracking-[-0.02em] text-foyer-ink">
        Qu&apos;aimeriez-vous changer ?
      </h1>

      <div className="mt-5">
        <DemoImage src="/demo/render1.png" alt="Rendu actuel" label="render1" />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {CHIPS.map((chip) => {
          const on = active.includes(chip);
          return (
            <button
              key={chip}
              type="button"
              onClick={() => toggle(chip)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm transition-colors",
                on
                  ? "border-2 border-foyer-ink bg-foyer-ink/5 text-foyer-ink"
                  : "border border-foyer-border text-foyer-muted hover:text-foyer-ink",
              )}
            >
              {chip}
            </button>
          );
        })}
      </div>

      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Décrivez ce que vous voulez changer…"
        className="mt-3 w-full rounded-xl border border-foyer-border bg-white px-4 py-3 text-[15px] text-foyer-ink outline-none placeholder:text-foyer-muted focus:border-foyer-terra"
      />

      <div className="sticky bottom-0 mt-6 -mx-5 border-t border-foyer-border bg-foyer-cream/95 px-5 py-3 backdrop-blur">
        <PrimaryButton onClick={onApply}>
          <Sparkles className="size-5" aria-hidden />
          Appliquer
        </PrimaryButton>
      </div>
    </div>
  );
}
