"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  before: string;
  after: string;
  alt?: string;
  className?: string;
  initialPos?: number;
};

export function BeforeAfterSlider({
  before,
  after,
  alt = "Avant / Après",
  className = "",
  initialPos = 52,
}: Props) {
  const [pos, setPos] = useState(initialPos);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

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

      {/* Labels */}
      <span className="absolute left-3 top-3 rounded-full bg-foyer-ink/75 px-3 py-1 text-[11px] font-medium tracking-widest text-foyer-cream">
        AVANT
      </span>
      <span className="absolute right-3 top-3 rounded-full bg-foyer-cream/90 px-3 py-1 text-[11px] font-medium tracking-widest text-foyer-ink">
        APRÈS
      </span>

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
