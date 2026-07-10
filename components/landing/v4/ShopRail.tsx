"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useShop } from "./context";
import { CroppedShot, TextLink } from "./primitives";
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
 * dans page.tsx). Traité comme une étiquette de fiche latérale, pas une carte
 * flottante d'app — bord franc, pas d'ombre portée, pas d'icône panier.
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
      {/* Desktop — languette latérale fixe, bord franc */}
      <div className="pointer-events-none fixed inset-y-0 right-0 z-40 hidden items-center sm:flex">
        <AnimatePresence>
          {visible && (
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto w-[200px] border border-[var(--v4-border)] bg-white"
            >
              <div className="border-b border-[var(--v4-border)] px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--v4-muted)]">Votre sélection</p>
              </div>
              <div className="flex items-center gap-2.5 px-4 pt-3">
                <div className="flex -space-x-2">
                  {PURCHASABLE.map((p) => (
                    <div
                      key={p.id}
                      className="relative size-7 shrink-0 overflow-hidden ring-2 ring-white"
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
                  <span className="text-[11px] uppercase tracking-[0.1em] text-[var(--v4-muted)]">Total</span>
                  <span className="font-serif text-[19px] font-normal tracking-[-0.01em] text-[var(--v4-ink)]">
                    {total}&nbsp;€
                  </span>
                </div>
                <Link
                  href="/create"
                  className="mt-3 flex w-full items-center justify-center border border-[var(--v4-ink)] py-2 text-[12px] text-[var(--v4-ink)] transition-colors hover:bg-[var(--v4-ink)] hover:text-white"
                >
                  <TextLink>Voir mon panier</TextLink>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile — barre sticky en bas, bord franc */}
      <div className="fixed inset-x-0 bottom-0 z-40 sm:hidden">
        <AnimatePresence>
          {visible && (
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center justify-between gap-3 border-t border-[var(--v4-border)] bg-white px-4 py-3"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex -space-x-2">
                  {PURCHASABLE.slice(0, 3).map((p) => (
                    <div key={p.id} className="relative size-7 shrink-0 overflow-hidden ring-2 ring-white">
                      <CroppedShot crop={p.crop} alt={p.name} />
                    </div>
                  ))}
                </div>
                <div className="leading-tight">
                  <p className="font-serif text-[15px] font-normal text-[var(--v4-ink)]">{total}&nbsp;€</p>
                  <p className="text-[11px] text-[var(--v4-muted)]">{PURCHASABLE.length} articles</p>
                </div>
              </div>
              <Link
                href="/create"
                className="flex shrink-0 items-center border border-[var(--v4-ink)] px-4 py-2 text-[12px] text-[var(--v4-ink)]"
              >
                <TextLink>Commander</TextLink>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
