"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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
              <span className="font-serif text-[17px] font-normal text-[var(--v4-ink)] sm:text-[19px]">
                {item.q}
              </span>
              <motion.span
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="shrink-0 text-[18px] font-light text-[var(--v4-muted)]"
                aria-hidden
              >
                +
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
