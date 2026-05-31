"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

type FaqItem = { question: string; answer: string };

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <ul className="divide-y divide-foyer-border border-y border-foyer-border">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <li key={item.question}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="font-sans text-[16px] font-medium text-foyer-ink">
                {item.question}
              </span>
              {isOpen ? (
                <Minus className="size-5 shrink-0 text-foyer-muted" aria-hidden />
              ) : (
                <Plus className="size-5 shrink-0 text-foyer-muted" aria-hidden />
              )}
            </button>
            {isOpen && (
              <p className="px-5 pb-5 text-[15px] leading-relaxed text-foyer-muted">
                {item.answer}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
