"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  before: string;
  after: string;
  alt?: string;
  className?: string;
  initialPos?: number;
  /** Position du curseur (0-100), remontée au parent : les calques posés PAR-DESSUS
   *  l'image (hotspots) doivent pouvoir se cacher sous la moitié « avant ». */
  onPosChange?: (pos: number) => void;
};

export function BeforeAfterSlider({
  before,
  after,
  alt = "Avant / Après",
  className = "",
  // Ouvert LARGEMENT sur l'après : c'est le rendu qu'on vient voir. La photo d'origine ne
  // sert qu'à donner la mesure du chemin parcouru — à 52 %, elle en mangeait la moitié.
  initialPos = 20,
  onPosChange,
}: Props) {
  const [pos, setPos] = useState(initialPos);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => { onPosChange?.(pos); }, [pos, onPosChange]);

  const move = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, p)));
  }, []);

  useEffect(() => {
    const up = () => { dragging.current = false; };
    const mm = (e: MouseEvent) => { if (dragging.current) move(e.clientX); };
    const tm = (e: TouchEvent) => {
      if (dragging.current && e.touches[0]) move(e.touches[0].clientX);
    };
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    window.addEventListener("mousemove", mm);
    window.addEventListener("touchmove", tm, { passive: true });
    return () => {
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("touchmove", tm);
    };
  }, [move]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full aspect-[4/3] overflow-hidden rounded-3xl border border-foyer-border bg-foyer-border select-none touch-none ${className}`}
    >
      {/* After (base layer) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={after}
        alt={`${alt} — après`}
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />

      {/* Before (clipped layer) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${pos}%` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={before}
          alt={`${alt} — avant`}
          className="absolute inset-0 h-full object-cover"
          style={{
            width: `${100 / (pos / 100)}%`,
            maxWidth: "none",
          }}
          draggable={false}
        />
      </div>

      {/* Labels — chacun enfermé dans SA moitié, avec overflow-hidden : la ligne du
          curseur les rogne au lieu de leur passer par-dessus. Poussé à fond d'un
          côté, le badge de ce côté disparaît entièrement, ce qui est le but.
          `whitespace-nowrap` est indispensable : sans lui, le texte se replierait
          sur plusieurs lignes à mesure que le conteneur rétrécit, au lieu d'être
          coupé net. `pointer-events-none` pour ne pas voler le drag au curseur. */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: `${pos}%` }}
      >
        <span className="absolute left-3 top-3 whitespace-nowrap rounded-full bg-foyer-ink/75 px-3 py-1 text-[11px] font-medium tracking-widest text-foyer-cream">
          AVANT
        </span>
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 right-0 overflow-hidden"
        style={{ left: `${pos}%` }}
      >
        <span className="absolute right-3 top-3 whitespace-nowrap rounded-full bg-foyer-cream/90 px-3 py-1 text-[11px] font-medium tracking-widest text-foyer-ink">
          APRÈS
        </span>
      </div>

      {/* Divider line */}
      <div
        className="absolute inset-y-0 w-px bg-foyer-cream shadow"
        style={{ left: `${pos}%` }}
      />

      {/* Drag handle */}
      <button
        type="button"
        aria-label="Glisser pour comparer"
        onMouseDown={(e) => { e.preventDefault(); dragging.current = true; }}
        onTouchStart={() => { dragging.current = true; }}
        className="absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-foyer-border bg-foyer-cream shadow-md"
        style={{ left: `${pos}%` }}
      >
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-foyer-ink"
        >
          <path d="m8 7-4 5 4 5" />
          <path d="m16 7 4 5-4 5" />
        </svg>
      </button>
    </div>
  );
}
