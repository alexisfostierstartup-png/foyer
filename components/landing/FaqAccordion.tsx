"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

type FaqItem = { question: string; answer: string };

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="overflow-hidden rounded-2xl border border-foyer-border">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.question} className={i > 0 ? "border-t border-foyer-border" : ""}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
            >
              <span className="text-[16px] font-semibold text-foyer-ink">
                {item.question}
              </span>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foyer-border/60 text-foyer-muted">
                {isOpen ? (
                  <Minus className="size-3.5" aria-hidden />
                ) : (
                  <Plus className="size-3.5" aria-hidden />
                )}
              </span>
            </button>
            {isOpen && (
              <p className="px-6 pb-6 text-[15px] leading-relaxed text-foyer-muted">
                {item.answer}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
