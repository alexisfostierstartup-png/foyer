"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { FAQS } from "./data";

export function FaqV4() {
  const [open, setOpen] = useState(0);

  return (
    <div className="divide-y divide-[var(--v4-border)] border-y border-[var(--v4-border)]">
      {FAQS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q} className="py-4">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? -1 : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-6 text-left"
            >
              <span className="font-serif text-[17px] font-medium text-[var(--v4-ink)] sm:text-[19px]">
                {item.q}
              </span>
              <motion.span
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={{ type: "spring", stiffness: 340, damping: 22 }}
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--v4-ink-wash)] text-[var(--v4-ink)]"
              >
                <Plus className="size-3.5" strokeWidth={2.4} aria-hidden />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 280, damping: 32 }}
                  className="overflow-hidden"
                >
                  <p className="max-w-2xl pt-3 text-[14px] leading-relaxed text-[var(--v4-muted)]">{item.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
