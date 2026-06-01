"use client";

import { useCallback, useRef, useState } from "react";
import { ChevronsLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

type BeforeAfterSliderProps = {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
};

function SliderImage({
  src,
  alt,
  placeholder,
}: {
  src: string;
  alt: string;
  placeholder: string;
}) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div className="flex size-full items-center justify-center bg-foyer-cream">
        <span className="rounded-full border border-foyer-border bg-white/70 px-3 py-1 text-xs text-foyer-muted">
          {placeholder}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      draggable={false}
      onError={() => setErrored(true)}
      className="size-full select-none object-cover"
    />
  );
}

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = "Avant",
  afterLabel = "Après",
  className,
}: BeforeAfterSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(25);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, pct)));
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      updateFromClientX(e.clientX);
    },
    [updateFromClientX],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.buttons === 0) return; // only while pressed
      updateFromClientX(e.clientX);
    },
    [updateFromClientX],
  );

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      className={cn(
        "relative aspect-[4/3] w-full touch-none overflow-hidden rounded-2xl border border-foyer-border bg-foyer-cream select-none",
        className,
      )}
    >
      {/* After (base layer) */}
      <div className="absolute inset-0">
        <SliderImage src={afterUrl} alt="Pièce transformée" placeholder="after.jpg" />
        <span className="absolute right-3 top-3 rounded-full border border-foyer-border bg-white px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-foyer-ink">
          {afterLabel}
        </span>
      </div>

      {/* Before (clipped overlay, full-size so the image isn't squeezed) */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <SliderImage src={beforeUrl} alt="Pièce avant" placeholder="before.jpg" />
        <span className="absolute left-3 top-3 rounded-full bg-foyer-ink px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-foyer-cream">
          {beforeLabel}
        </span>
      </div>

      {/* Handle */}
      <div
        className="pointer-events-none absolute inset-y-0"
        style={{ left: `${position}%`, transform: "translateX(-50%)" }}
      >
        <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white/90 shadow-sm" />
        <div className="absolute top-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-foyer-border bg-white text-foyer-ink shadow-md">
          <ChevronsLeftRight className="size-4" aria-hidden />
        </div>
      </div>

      {/* Accessible range control */}
      <input
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={(e) => setPosition(Number(e.target.value))}
        aria-label="Comparer avant et après"
        className="absolute inset-x-0 bottom-2 z-10 mx-auto w-[60%] cursor-pointer opacity-0"
      />
    </div>
  );
}
