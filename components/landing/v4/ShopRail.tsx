"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useShop } from "./context";
import { CroppedShot } from "./primitives";
import { PROJECT_TOTAL, PURCHASABLE } from "./data";

/** Compte de 0 jusqu'à `target` la première fois que `active` devient vrai. */
function useCountUp(active: boolean, target: number) {
  const [value, setValue] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    if (!active || done.current) return;
    done.current = true;
    const duration = 700;
    const start = performance.now();
    let raf = 0;
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target]);

  return value;
}

/**
 * Rail panier persistant : visible de l'entrée du hero jusqu'à la sortie de la
 * grille "shop the room" (sentinels #shop-zone-start / #shop-zone-end posés
 * dans page.tsx). Latéral sur desktop, barre sticky en bas sur mobile.
 */
export function ShopRail() {
  const { selectedId } = useShop();
  const [visible, setVisible] = useState(false);
  const total = useCountUp(visible, PROJECT_TOTAL);

  useEffect(() => {
    const start = document.getElementById("shop-zone-start");
    const end = document.getElementById("shop-zone-end");
    if (!start || !end || typeof IntersectionObserver === "undefined") return;

    let pastStart = false;
    let pastEnd = false;
    const sync = () => setVisible(pastStart && !pastEnd);

    const ioStart = new IntersectionObserver(
      ([entry]) => {
        pastStart = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        sync();
      },
      { threshold: 0 },
    );
    const ioEnd = new IntersectionObserver(
      ([entry]) => {
        pastEnd = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        sync();
      },
      { threshold: 0 },
    );
    ioStart.observe(start);
    ioEnd.observe(end);
    return () => {
      ioStart.disconnect();
      ioEnd.disconnect();
    };
  }, []);

  return (
    <>
      {/* Desktop — rail latéral fixe */}
      <div className="pointer-events-none fixed inset-y-0 right-0 z-40 hidden items-center pr-5 sm:flex">
        <AnimatePresence>
          {visible && (
            <motion.div
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="pointer-events-auto w-[224px] overflow-hidden rounded-2xl bg-white shadow-[0_20px_50px_rgba(31,27,22,0.22)] ring-1 ring-[var(--v4-border)]"
            >
              <div className="flex items-center gap-2 border-b border-[var(--v4-border)] px-4 py-3">
                <ShoppingBag className="size-4 text-[var(--v4-ink)]" strokeWidth={1.8} aria-hidden />
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--v4-ink)]">
                  Votre projet
                </p>
              </div>
              <div className="flex items-center gap-2.5 px-4 pt-3">
                <div className="flex -space-x-2.5">
                  {PURCHASABLE.map((p) => (
                    <div
                      key={p.id}
                      className={cn(
                        "relative size-8 shrink-0 overflow-hidden rounded-full ring-2 ring-white transition-transform duration-300",
                        selectedId === p.id && "z-10 scale-110 ring-[var(--v4-terra)]",
                      )}
                    >
                      <CroppedShot crop={p.crop} alt={p.name} />
                    </div>
                  ))}
                </div>
                <p className="text-[11px] leading-tight text-[var(--v4-muted)]">
                  {PURCHASABLE.length} articles
                  <br />
                  identifiés
                </p>
              </div>
              <div className="px-4 pb-4 pt-3">
                <div className="flex items-baseline justify-between border-t border-[var(--v4-border)] pt-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--v4-muted)]">
                    Total
                  </span>
                  <span className="font-serif text-[22px] font-medium tracking-[-0.01em] text-[var(--v4-ink)]">
                    {total}&nbsp;€
                  </span>
                </div>
                <Link
                  href="/create"
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-[var(--v4-ink)] py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--v4-ink)]/85"
                >
                  Voir mon panier
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile — barre sticky en bas */}
      <div className="fixed inset-x-0 bottom-0 z-40 sm:hidden">
        <AnimatePresence>
          {visible && (
            <motion.div
              initial={{ y: 90, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 90, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="flex items-center justify-between gap-3 border-t border-[var(--v4-border)] bg-white/97 px-4 py-3 shadow-[0_-8px_24px_rgba(31,27,22,0.12)] backdrop-blur-sm"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex -space-x-2">
                  {PURCHASABLE.slice(0, 3).map((p) => (
                    <div
                      key={p.id}
                      className="relative size-7 shrink-0 overflow-hidden rounded-full ring-2 ring-white"
                    >
                      <CroppedShot crop={p.crop} alt={p.name} />
                    </div>
                  ))}
                </div>
                <div className="leading-tight">
                  <p className="font-serif text-[16px] font-medium text-[var(--v4-ink)]">{total}&nbsp;€</p>
                  <p className="text-[11px] text-[var(--v4-muted)]">{PURCHASABLE.length} articles</p>
                </div>
              </div>
              <Link
                href="/create"
                className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--v4-ink)] px-4 py-2.5 text-[13px] font-semibold text-white"
              >
                Commander
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
