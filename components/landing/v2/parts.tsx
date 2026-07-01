"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/* -------------------------------------------------------------------------- *
 * RevealV2 — apparition au scroll (opacity + transform) façon Lovable.
 * On passe la transform initiale via `from` ; au repos elle revient à `none`.
 * `style` porte les props persistantes (ex. marginLeft pour l'effet escalier).
 * -------------------------------------------------------------------------- */
export function RevealV2({
  children,
  className,
  from = "translateY(28px)",
  delay = 0,
  style,
  instant = false,
}: {
  children: ReactNode;
  className?: string;
  from?: string;
  delay?: number;
  style?: CSSProperties;
  /** Affiché immédiatement (above-the-fold / hero), sans attendre le scroll ni l'hydratation. */
  instant?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(instant);
  // Une fois le reveal terminé, on relâche le transform/transition inline pour
  // laisser les classes CSS (ex. hover:-translate-y) reprendre la main — sinon
  // les styles inline gagnent toujours et le hover paraît « mort ».
  const [done, setDone] = useState(instant);

  useEffect(() => {
    if (!shown || done) return;
    const t = setTimeout(() => setDone(true), 850 + delay);
    return () => clearTimeout(t);
  }, [shown, done, delay]);

  useEffect(() => {
    if (instant) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          io.disconnect();
          // Double rAF : on garantit que l'état caché (opacity:0 + transform)
          // est bien peint AVANT de révéler. Sinon, pour un élément déjà visible
          // au montage, React passe à l'état final dans la même frame et le
          // navigateur saute la transition (= « pas d'animation »).
          requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [instant]);

  return (
    <div
      ref={ref}
      className={className}
      style={
        done
          ? // Reveal fini : on ne pilote plus le transform en inline → le hover CSS fonctionne.
            { ...style, opacity: 1 }
          : {
              ...style,
              opacity: shown ? 1 : 0,
              transform: shown ? "none" : from,
              transition: `opacity 0.8s cubic-bezier(0.2,0.7,0.2,1) ${delay}ms, transform 0.8s cubic-bezier(0.2,0.7,0.2,1) ${delay}ms`,
              willChange: "opacity, transform",
            }
      }
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * BeforeAfterV2 — comparateur avant/après glissant (réplique exacte Lovable).
 * -------------------------------------------------------------------------- */
export function BeforeAfterV2({
  beforeSrc,
  afterSrc,
  beforeAlt = "Salon transformé — avant",
  afterAlt = "Salon transformé — après",
  fill = false,
  compact = false,
}: {
  beforeSrc: string;
  afterSrc: string;
  beforeAlt?: string;
  afterAlt?: string;
  /** Remplit le conteneur parent (absolute inset-0) au lieu d'imposer un aspect-ratio. */
  fill?: boolean;
  /** Labels & poignée plus petits (cartes projet). */
  compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(52);

  const update = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(100, Math.max(0, pct)));
  }, []);

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 0) return;
        update(e.clientX);
      }}
      className={
        fill
          ? "absolute inset-0 overflow-hidden bg-muted select-none touch-none cursor-ew-resize"
          : "relative w-full aspect-[4/3] overflow-hidden rounded-3xl border border-border bg-muted select-none touch-none cursor-ew-resize"
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={afterSrc} alt={afterAlt} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeSrc}
          alt={beforeAlt}
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ width: `${(100 / pos) * 100}%`, maxWidth: "none" }}
        />
      </div>
      <span
        className={
          compact
            ? "absolute left-2 bottom-2 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-medium text-cream tracking-wide"
            : "absolute left-3 top-3 rounded-full bg-ink/80 px-3 py-1 text-xs font-medium text-cream tracking-wide"
        }
      >
        AVANT
      </span>
      <span
        className={
          compact
            ? "absolute right-2 bottom-2 rounded-full bg-cream/90 px-2 py-0.5 text-[10px] font-medium text-ink tracking-wide"
            : "absolute right-3 top-3 rounded-full bg-cream/90 px-3 py-1 text-xs font-medium text-ink tracking-wide"
        }
      >
        APRÈS
      </span>
      <div
        className="absolute top-0 bottom-0 w-px bg-cream shadow-[0_0_0_1px_rgba(0,0,0,0.1)]"
        style={{ left: `${pos}%` }}
      />
      <button
        type="button"
        aria-label="Glisser pour comparer"
        className={
          compact
            ? "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 grid place-items-center h-8 w-8 rounded-full bg-cream border border-border shadow-md cursor-ew-resize"
            : "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 grid place-items-center h-11 w-11 rounded-full bg-cream border border-border shadow-md cursor-ew-resize"
        }
        style={{ left: `${pos}%` }}
      >
        <svg width={compact ? 14 : 18} height={compact ? 14 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M8 7l-4 5 4 5" />
          <path d="M16 7l4 5-4 5" />
        </svg>
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * FaqV2 — accordéon (réplique exacte Lovable). Premier item ouvert.
 * -------------------------------------------------------------------------- */
export function FaqV2({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState(0);

  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q} className="py-5">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? -1 : i)}
              aria-expanded={isOpen}
              className="w-full flex items-start justify-between gap-6 text-left"
            >
              <span className="font-display text-xl sm:text-2xl pr-4">{item.q}</span>
              <span className="grid place-items-center h-8 w-8 rounded-full bg-bone ring-1 ring-line shrink-0 mt-1">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14" />
                  {!isOpen && <path d="M12 5v14" />}
                </svg>
              </span>
            </button>
            <div
              className="overflow-hidden transition-all duration-300 ease-out"
              style={{ maxHeight: isOpen ? 320 : 0, opacity: isOpen ? 1 : 0 }}
            >
              <p className="pt-4 text-[14px] leading-relaxed text-muted-foreground max-w-2xl">{item.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
