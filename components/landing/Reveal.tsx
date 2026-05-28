"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Révèle son contenu (fondu + léger glissement) quand il entre dans le viewport.
 * `delay` permet d'échelonner plusieurs éléments (effet de cascade).
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-all duration-[800ms] ease-out will-change-transform motion-reduce:transition-none",
        shown
          ? "translate-y-0 opacity-100 blur-0"
          : "translate-y-8 opacity-0 blur-[2px] motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:blur-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
