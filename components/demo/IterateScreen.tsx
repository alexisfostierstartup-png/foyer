"use client";

import { useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { PrimaryButton, DemoImage } from "@/components/demo/primitives";

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
    options: ["Plus clair", "Plus foncé", "Moins en chevron"],
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

export function IterateScreen({ onApply }: { onApply: () => void }) {
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  function toggleOption(catId: string, option: string) {
    setSelections((prev) => {
      const cur = prev[catId] ?? [];
      const next = cur.includes(option)
        ? cur.filter((o) => o !== option)
        : [...cur, option];
      return { ...prev, [catId]: next };
    });
  }

  return (
    <div className="flex flex-1 flex-col pb-24">
      <h1 className="font-serif text-[26px] font-medium leading-tight tracking-[-0.02em] text-foyer-ink">
        Qu&apos;aimeriez-vous changer ?
      </h1>

      <div className="mt-5">
        <DemoImage src="/demo/render1.png" alt="Rendu actuel" label="render1" />
      </div>

      <div className="mt-5 divide-y divide-foyer-border overflow-hidden rounded-2xl border border-foyer-border bg-white">
        {CATEGORIES.map((cat) => {
          const open = openCat === cat.id;
          const count = selections[cat.id]?.length ?? 0;
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
                    <span className="flex size-5 items-center justify-center rounded-full bg-foyer-terra text-[11px] font-medium text-white">
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
                  <input
                    type="text"
                    value={notes[cat.id] ?? ""}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [cat.id]: e.target.value }))
                    }
                    placeholder={`Précisez pour ${cat.label.toLowerCase()}…`}
                    className="mt-3 w-full rounded-xl border border-foyer-border bg-white px-3 py-2 text-base text-foyer-ink outline-none placeholder:text-foyer-muted focus:border-foyer-terra"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 mt-6 -mx-5 border-t border-foyer-border bg-foyer-cream/95 px-5 py-3 backdrop-blur">
        <PrimaryButton onClick={onApply}>
          <Sparkles className="size-5" aria-hidden />
          Appliquer
        </PrimaryButton>
      </div>
    </div>
  );
}
