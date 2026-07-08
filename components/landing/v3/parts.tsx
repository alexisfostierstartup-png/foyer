"use client";

/**
 * Foyer landing v3 — « Le dossier de traçabilité »
 * Primitives dédiées : reveal, compteurs incrémentés au scroll, séparateur
 * organique (bord déchiré + veine de feuille), tampon d'audit, carte
 * passeport matière, boucle de cycle de vie, barre de score, FAQ « annexes ».
 * Isolé de components/landing/v2/* — aucune dépendance croisée.
 */

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- *
 * useInView — observe une fois, puis se déconnecte (déclencheurs one-shot).
 * -------------------------------------------------------------------------- */
function useInView<T extends HTMLElement>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return [ref, inView] as const;
}

/* -------------------------------------------------------------------------- *
 * RevealV3 — apparition au scroll (opacity + translateY léger).
 * -------------------------------------------------------------------------- */
export function RevealV3({
  children,
  className,
  delay = 0,
  instant = false,
  from = "translateY(22px)",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  instant?: boolean;
  from?: string;
}) {
  const [ref, inView] = useInView<HTMLDivElement>(0.2);
  const shown = instant || inView;
  const [done, setDone] = useState(instant);

  useEffect(() => {
    if (!shown || done) return;
    const t = setTimeout(() => setDone(true), 760 + delay);
    return () => clearTimeout(t);
  }, [shown, done, delay]);

  const style: CSSProperties = done
    ? { opacity: 1 }
    : {
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : from,
        transition: `opacity 0.7s cubic-bezier(0.16,0.8,0.24,1) ${delay}ms, transform 0.7s cubic-bezier(0.16,0.8,0.24,1) ${delay}ms`,
        willChange: "opacity, transform",
      };

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * CountUp — compte de 0 à `value` quand l'élément entre dans le viewport.
 * -------------------------------------------------------------------------- */
export function CountUp({
  value,
  decimals = 0,
  duration = 1500,
  prefix = "",
  suffix = "",
}: {
  value: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}) {
  const [ref, inView] = useInView<HTMLSpanElement>(0.5);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);

  const formatted =
    decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toLocaleString("fr-FR");

  return (
    <span ref={ref}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

/* -------------------------------------------------------------------------- *
 * OrganicDivider — bord déchiré (clip-path déterministe) + veine de feuille
 * gravée en surimpression. Sectionnement propre à la v3.
 * -------------------------------------------------------------------------- */
export function OrganicDivider({
  dir,
  height = 56,
}: {
  dir: "to-deep" | "to-paper";
  height?: number;
}) {
  const from = dir === "to-deep" ? "var(--v3-paper)" : "var(--v3-paper-deep)";
  const to = dir === "to-deep" ? "var(--v3-paper-deep)" : "var(--v3-paper)";

  const steps = 28;
  // Précision volontairement courte : le navigateur renormalise les décimales
  // longues en relisant style.clipPath après le SSR, ce qui provoquait un
  // faux mismatch d'hydratation (la chaîne re-sérialisée ne matchait plus
  // la chaîne JS d'origine au caractère près).
  const pts: string[] = ["0% 0px", "100% 0px"];
  for (let i = 0; i <= steps; i++) {
    const x = (100 - (i / steps) * 100).toFixed(2);
    const n = Math.abs(Math.sin(i * 12.9898));
    const frac = n - Math.floor(n);
    const y = (height * 0.22 + frac * height * 0.46).toFixed(2);
    pts.push(`${x}% ${y}px`);
  }
  const clipPath = `polygon(${pts.join(", ")})`;

  return (
    <div
      aria-hidden
      className="relative w-full overflow-hidden"
      style={{ height, background: to }}
    >
      <div
        className="absolute inset-x-0 top-0"
        style={{ height, background: from, clipPath }}
      />
      <svg
        viewBox={`0 0 400 ${height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full opacity-[0.16]"
      >
        <path
          d={`M0 ${height * 0.58} C 80 ${height * 0.32}, 160 ${height * 0.74}, 240 ${height * 0.42} S 360 ${height * 0.56}, 400 ${height * 0.3}`}
          stroke="var(--v3-ink)"
          strokeWidth="1"
          fill="none"
        />
        {[64, 148, 232, 316].map((x, i) => (
          <path
            key={i}
            d={`M${x} ${height * 0.46} q 9 -13 20 -20`}
            stroke="var(--v3-ink)"
            strokeWidth="0.75"
            fill="none"
          />
        ))}
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * StampSeal — tampon d'audit (bordure pointillée, texte incliné).
 * -------------------------------------------------------------------------- */
export function StampSeal({
  label,
  sub,
  tone = "forest",
  className,
}: {
  label: string;
  sub?: string;
  tone?: "forest" | "rust";
  className?: string;
}) {
  const color = tone === "rust" ? "var(--v3-rust)" : "var(--v3-forest)";
  const [ref, inView] = useInView<HTMLSpanElement>(0.6);
  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex select-none flex-col items-center justify-center rounded-full border-[1.5px] border-dashed bg-[var(--v3-card)]/90 px-3 py-1.5 text-center leading-none backdrop-blur-[1px]",
        className,
      )}
      style={{
        borderColor: color,
        color,
        transform: inView ? "rotate(-7deg) scale(1)" : "rotate(-7deg) scale(0.6)",
        opacity: inView ? 1 : 0,
        transition: "transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease-out",
      }}
    >
      <span className="v3-mono-label text-[9.5px] font-semibold">{label}</span>
      {sub && (
        <span className="v3-mono-label mt-0.5 text-[7.5px] opacity-70">
          {sub}
        </span>
      )}
    </span>
  );
}

/* -------------------------------------------------------------------------- *
 * Perforation — liseré de trous, façon souche de billet / étiquette à
 * détacher, posé entre la vignette et le corps d'une carte passeport.
 * -------------------------------------------------------------------------- */
export function Perforation({ holeColor = "var(--v3-card)" }: { holeColor?: string }) {
  return (
    <div
      aria-hidden
      className="h-[9px] w-full"
      style={{
        backgroundColor: "var(--v3-line)",
        backgroundImage: `radial-gradient(circle, ${holeColor} 2.4px, transparent 2.8px)`,
        backgroundSize: "13px 9px",
        backgroundRepeat: "repeat-x",
        backgroundPosition: "3px center",
      }}
    />
  );
}

/* -------------------------------------------------------------------------- *
 * PassportCard — fiche d'audit par meuble (angle « inventaire » → « preuve »).
 * -------------------------------------------------------------------------- */
export type PassportRow = { label: string; value: string };

export function PassportCard({
  swatchSrc,
  swatchAlt,
  status,
  statusTone = "forest",
  title,
  code,
  rows,
  delay = 0,
}: {
  swatchSrc: string;
  swatchAlt: string;
  status: string;
  statusTone?: "forest" | "rust";
  title: string;
  code: string;
  rows: PassportRow[];
  delay?: number;
}) {
  return (
    <RevealV3 delay={delay}>
      <div className="group relative flex h-full flex-col overflow-hidden rounded-[6px] bg-[var(--v3-card)] ring-1 ring-[var(--v3-line)] shadow-[0_14px_34px_-20px_rgba(20,24,18,0.45)] transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] hover:-translate-y-1">
        <div className="relative h-36 shrink-0 overflow-hidden sm:h-40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={swatchSrc}
            alt={swatchAlt}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            style={{ filter: "grayscale(18%) sepia(10%) hue-rotate(65deg) saturate(0.9) contrast(1.04)" }}
          />
          <div aria-hidden className="absolute inset-0 bg-[var(--v3-forest)] mix-blend-multiply opacity-[0.14]" />
          <div className="absolute right-2.5 top-2.5">
            <StampSeal label={status} tone={statusTone} />
          </div>
        </div>
        <Perforation />
        <div className="flex flex-1 flex-col px-5 py-5">
          <h3 className="font-display-v3 text-[19px] leading-snug text-[var(--v3-ink)]">
            {title}
          </h3>
          <dl className="mt-4 flex-1 space-y-2.5 border-t border-dashed border-[var(--v3-line)] pt-3.5">
            {rows.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-3">
                <dt className="v3-mono-label shrink-0 text-[9.5px] text-[var(--v3-ink)]/45">
                  {r.label}
                </dt>
                <dd className="text-right text-[12px] leading-snug text-[var(--v3-ink)]">
                  {r.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="v3-mono-label mt-4 text-[8.5px] text-[var(--v3-ink)]/30">
            Réf. {code}
          </p>
        </div>
      </div>
    </RevealV3>
  );
}

/* -------------------------------------------------------------------------- *
 * ScoreBar — barre segmentée (conservé / occasion / neuf), largeur animée.
 * -------------------------------------------------------------------------- */
export function ScoreBar({
  segments,
}: {
  segments: { value: number; color: string; label: string }[];
}) {
  const [ref, inView] = useInView<HTMLDivElement>(0.5);
  return (
    <div ref={ref}>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--v3-paper-deep)] ring-1 ring-[var(--v3-line)]">
        {segments.map((s, i) => (
          <div
            key={s.label}
            style={{
              width: inView ? `${s.value}%` : "0%",
              background: s.color,
              transition: `width 1s cubic-bezier(0.16,0.8,0.24,1) ${i * 140}ms`,
            }}
          />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-[11px] text-[var(--v3-ink)]/60">
            <span aria-hidden className="size-2 rounded-full" style={{ background: s.color }} />
            {s.label} · <span className="v3-mono-label text-[10px] text-[var(--v3-ink)]">{s.value}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * LifecycleLoop — garder → chiner → reprendre/réparer → neuf durable,
 * en circuit fermé (dessiné au scroll), plutôt qu'une grille à 4 colonnes.
 * -------------------------------------------------------------------------- */
export type LoopNode = {
  icon: ReactNode;
  num: string;
  title: string;
  sub: string;
};

export function LifecycleLoop({ nodes }: { nodes: LoopNode[] }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.35);
  const R = 150;
  const C = 200;
  const circumference = 2 * Math.PI * R;

  const positions = nodes.map((_, i) => {
    const angle = (-90 + i * (360 / nodes.length)) * (Math.PI / 180);
    return {
      x: C + R * Math.cos(angle),
      y: C + R * Math.sin(angle),
    };
  });

  return (
    <div ref={ref} className="relative mx-auto aspect-square w-full max-w-[440px]">
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
        <circle
          cx={C}
          cy={C}
          r={R}
          fill="none"
          stroke="var(--v3-line)"
          strokeWidth="1.5"
          strokeDasharray="2 7"
        />
        <circle
          cx={C}
          cy={C}
          r={R}
          fill="none"
          stroke="var(--v3-forest)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={inView ? 0 : circumference}
          style={{
            transition: "stroke-dashoffset 1.9s cubic-bezier(0.16,0.8,0.2,1)",
            transform: "rotate(-90deg)",
            transformOrigin: "200px 200px",
          }}
        />
        {/* petites flèches indiquant le sens du circuit, entre chaque nœud */}
        {nodes.map((_, i) => {
          const mx = C + (R + 2) * Math.cos(
            ((-90 + i * (360 / nodes.length) + 360 / nodes.length / 2)) * (Math.PI / 180),
          );
          const my = C + (R + 2) * Math.sin(
            ((-90 + i * (360 / nodes.length) + 360 / nodes.length / 2)) * (Math.PI / 180),
          );
          const angleDeg = -90 + i * (360 / nodes.length) + 360 / nodes.length / 2 + 90;
          return (
            <g
              key={i}
              style={{
                opacity: inView ? 0.55 : 0,
                transition: `opacity 0.5s ease ${1200 + i * 90}ms`,
              }}
            >
              <path
                d={`M${mx - 6} ${my - 4} L${mx + 6} ${my} L${mx - 6} ${my + 4}`}
                stroke="var(--v3-moss)"
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                transform={`rotate(${angleDeg} ${mx} ${my})`}
              />
            </g>
          );
        })}
      </svg>
      {nodes.map((node, i) => {
        const p = positions[i];
        return (
          <div
            key={node.title}
            className="absolute flex w-[118px] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center sm:w-[136px]"
            style={{
              left: `${(p.x / 400) * 100}%`,
              top: `${(p.y / 400) * 100}%`,
              opacity: inView ? 1 : 0,
              transform: `translate(-50%, -50%) scale(${inView ? 1 : 0.85})`,
              transition: `opacity 0.55s ease ${300 + i * 140}ms, transform 0.55s cubic-bezier(0.34,1.2,0.64,1) ${300 + i * 140}ms`,
            }}
          >
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-[var(--v3-card)] ring-1 ring-[var(--v3-line)] shadow-[0_8px_20px_-10px_rgba(20,24,18,0.4)] sm:size-14">
              {node.icon}
            </span>
            <span className="v3-mono-label mt-2.5 text-[9.5px] text-[var(--v3-moss)]">
              {node.num}
            </span>
            <span className="font-display-v3 mt-0.5 text-[14px] leading-tight text-[var(--v3-ink)] sm:text-[15px]">
              {node.title}
            </span>
            <span className="mt-1 text-[11px] leading-snug text-[var(--v3-ink)]/55">
              {node.sub}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- *
 * Checkpoint — jalon d'une chaîne de traçabilité horodatée (process).
 * -------------------------------------------------------------------------- */
export function Checkpoint({
  timestamp,
  title,
  description,
  icon,
  index,
}: {
  timestamp: string;
  title: string;
  description: string;
  icon: ReactNode;
  index: number;
}) {
  return (
    <RevealV3 delay={index * 110} className="relative flex gap-4 sm:flex-col sm:items-center sm:gap-0 sm:text-center">
      <div className="relative z-10 flex shrink-0 flex-col items-center sm:w-full">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--v3-card)] ring-2 ring-[var(--v3-forest)] sm:size-12">
          {icon}
        </span>
      </div>
      <div className="pb-8 sm:pb-0 sm:pt-4">
        <p className="v3-mono-label text-[10px] text-[var(--v3-moss)]">{timestamp}</p>
        <h3 className="font-display-v3 mt-1.5 text-[16px] leading-snug text-[var(--v3-ink)] sm:text-[17px]">
          {title}
        </h3>
        <p className="mt-1.5 max-w-[220px] text-[13px] leading-relaxed text-[var(--v3-ink)]/60 sm:mx-auto">
          {description}
        </p>
      </div>
    </RevealV3>
  );
}

/* -------------------------------------------------------------------------- *
 * FaqV3 — accordéon « annexes de dossier », numéroté en mono.
 * -------------------------------------------------------------------------- */
export function FaqV3({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="divide-y divide-dashed divide-[var(--v3-line)] border-y border-dashed border-[var(--v3-line)]">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q} className="py-5">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? -1 : i)}
              aria-expanded={isOpen}
              className="flex w-full items-start justify-between gap-6 text-left"
            >
              <span className="flex items-baseline gap-3">
                <span className="v3-mono-label shrink-0 text-[11px] text-[var(--v3-moss)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-display-v3 text-[17px] leading-snug text-[var(--v3-ink)] sm:text-[19px]">
                  {item.q}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "mt-1 size-4 shrink-0 text-[var(--v3-ink)]/40 transition-transform duration-300",
                  isOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>
            <div
              className="overflow-hidden transition-all duration-300 ease-out"
              style={{ maxHeight: isOpen ? 320 : 0, opacity: isOpen ? 1 : 0 }}
            >
              <p className="mt-3 max-w-2xl pl-8 text-[14px] leading-relaxed text-[var(--v3-ink)]/65">
                {item.a}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
