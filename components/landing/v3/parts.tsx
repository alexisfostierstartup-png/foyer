"use client";

/**
 * Héra landing v3 — « Design circulaire »
 * Une seule primitive dédiée : CountUp (chiffre qui s'incrémente au scroll).
 * Le reste (Reveal, BeforeAfter, Faq) est réutilisé depuis v2/parts — ces
 * primitives sont éprouvées et leur motion est déjà au bon niveau.
 */

import { useEffect, useRef, useState } from "react";

/** Chiffre qui compte de 0 à `value` quand il entre dans le viewport. */
export function CountUp({
  value,
  suffix = "",
  duration = 1400,
  className,
}: {
  value: number;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setDisplay(value);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return;
        started.current = true;
        io.disconnect();
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / duration);
          // easeOutCubic — décélère en fin de course, façon compteur réel.
          const eased = 1 - Math.pow(1 - p, 3);
          setDisplay(Math.round(eased * value));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {display}
      {suffix}
    </span>
  );
}
