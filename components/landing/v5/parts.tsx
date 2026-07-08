"use client";

/* =============================================================================
 * Landing v5 — primitives d'interaction.
 * Curseur custom, bouton magnétique, marquee, reveal, compteur, hero scroll-linked.
 * Tout est désactivé proprement sur tactile (matchMedia "(pointer: coarse)").
 * ========================================================================== */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";

/* --------------------------------- CURSEUR -------------------------------- */

type CursorVariant = "default" | "view" | "drag";

const CursorCtx = createContext<{
  setVariant: (v: CursorVariant, label?: string) => void;
} | null>(null);

export function CursorProvider({ children }: { children: ReactNode }) {
  const [coarse, setCoarse] = useState(true);
  const [variant, setVariantState] = useState<CursorVariant>("default");
  const [label, setLabel] = useState<string | undefined>();
  const [visible, setVisible] = useState(false);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 420, damping: 38, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 420, damping: 38, mass: 0.4 });

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    setCoarse(mq.matches);
    const onChange = () => setCoarse(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (coarse) return;
    const onMove = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      if (!visible) setVisible(true);
    };
    const onLeave = () => setVisible(false);
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("mouseleave", onLeave);
    // Masque le curseur système sur desktop uniquement : la classe est scopée
    // (v5-cursor-none) et retirée au démontage, donc n'affecte jamais les
    // autres routes/versions.
    document.documentElement.classList.add("v5-cursor-none");
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.documentElement.classList.remove("v5-cursor-none");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coarse]);

  const setVariant = useCallback((v: CursorVariant, l?: string) => {
    setVariantState(v);
    setLabel(l);
  }, []);

  const ctx = useMemo(() => ({ setVariant }), [setVariant]);

  const sizes: Record<CursorVariant, number> = { default: 14, view: 84, drag: 84 };
  const size = sizes[variant];

  return (
    <CursorCtx.Provider value={ctx}>
      {children}
      {!coarse && (
        <motion.div
          aria-hidden
          className="pointer-events-none fixed top-0 left-0 z-[999] hidden lg:flex items-center justify-center rounded-full mix-blend-difference"
          style={{
            x: sx,
            y: sy,
            translateX: "-50%",
            translateY: "-50%",
            width: size,
            height: size,
            opacity: visible ? 1 : 0,
            backgroundColor: "#f4efe6",
          }}
          transition={{ duration: 0.35 }}
        >
          {label && (
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#141310] select-none">
              {label}
            </span>
          )}
        </motion.div>
      )}
    </CursorCtx.Provider>
  );
}

/** Zone qui pilote le curseur custom au survol (aucun effet sur tactile). */
export function CursorTarget({
  children,
  variant = "view",
  label = "Voir",
  className,
}: {
  children: ReactNode;
  variant?: CursorVariant;
  label?: string;
  className?: string;
}) {
  const ctx = useContext(CursorCtx);
  return (
    <div
      className={className}
      onMouseEnter={() => ctx?.setVariant(variant, label)}
      onMouseLeave={() => ctx?.setVariant("default")}
    >
      {children}
    </div>
  );
}

/* ----------------------------- BOUTON MAGNÉTIQUE --------------------------- */

export function Magnetic({
  children,
  className,
  strength = 0.35,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 18, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 260, damping: 18, mass: 0.4 });

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const onLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ x: sx, y: sy }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ---------------------------------- REVEAL --------------------------------- */

export function RevealV5({
  children,
  className,
  delay = 0,
  y: distance = 22,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
      transition={{ duration: 0.9, delay: delay / 1000, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Révélation "masquée" ligne par ligne — pour le titre du hero.
 * Joue au montage (`animate`, pas `whileInView`) : le hero est toujours
 * visible dès le chargement, donc pas de scroll à attendre. Un `whileInView`
 * imbriqué dans le <motion.h1> scroll-lié du hero ne se déclenchait jamais
 * de façon fiable (l'IntersectionObserver d'un enfant motion ne reçoit pas
 * toujours son premier callback quand l'ancêtre porte déjà un style piloté
 * par MotionValue) — le titre restait masqué à translateY(110%).
 */
export function MaskReveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <span className={`inline-block overflow-hidden ${className ?? ""}`}>
      <motion.span
        className="inline-block"
        initial={{ y: "110%" }}
        animate={{ y: 0 }}
        transition={{ duration: 1.05, delay: delay / 1000, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/* ---------------------------------- COMPTEUR -------------------------------- */

export function Counter({
  to,
  suffix = "",
  prefix = "",
  decimals = 0,
  className,
}: {
  to: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const duration = 1400;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, to]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/* ------------------------------ HERO SCROLL-LINKED -------------------------- */

export function ParallaxImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.18]);
  const y = useTransform(scrollYProgress, [0, 1], [0, 60]);

  return (
    <div ref={ref} className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <motion.img src={src} alt={alt} style={{ scale, y }} className="h-full w-full object-cover" />
    </div>
  );
}

export function useSectionProgress(ref: React.RefObject<HTMLElement | null>): MotionValue<number> {
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  return scrollYProgress;
}

/* -------------------------- MARQUEUR DE SECTION ---------------------------- *
 * Numérotation façon portfolio éditorial ("N°02 — Projets") + filet fin.
 * `dark` inverse la teinte pour les sections plein-bleed sombres.
 * -------------------------------------------------------------------------- */
export function SectionMarker({
  index,
  label,
  dark = false,
  className,
}: {
  index: string;
  label: string;
  dark?: boolean;
  className?: string;
}) {
  return (
    <RevealV5 y={12} className={className}>
      <div className="flex items-center gap-4">
        <span
          className={`font-mono text-[12px] tracking-[0.24em] ${dark ? "text-foyer-ochre" : "text-foyer-ochre"}`}
        >
          N°{index}
        </span>
        <span aria-hidden className={`h-px w-10 ${dark ? "bg-foyer-ochre/40" : "bg-foyer-border"}`} />
        <span
          className={`font-mono text-[12px] uppercase tracking-[0.24em] ${dark ? "text-[#f4efe6]/60" : "text-foyer-muted"}`}
        >
          {label}
        </span>
      </div>
    </RevealV5>
  );
}

/* --------------------------------- MARQUEE ---------------------------------- *
 * Bandeau infini, sobre et lent — deux copies de la piste juxtaposées,
 * translation continue de -50% (voir @keyframes marquee dans v5.css).
 * -------------------------------------------------------------------------- */
export function Marquee({
  items,
  className,
  durationS = 42,
}: {
  items: string[];
  className?: string;
  durationS?: number;
}) {
  const track = (
    <div className="flex shrink-0 items-center gap-10 pr-10" aria-hidden>
      {items.map((item, i) => (
        <span key={i} className="flex shrink-0 items-center gap-10">
          <span className="whitespace-nowrap font-serif text-[16px] tracking-[-0.01em] text-current/80 md:text-[19px]">
            {item}
          </span>
          <span className="size-1 shrink-0 rounded-full bg-foyer-ochre" />
        </span>
      ))}
    </div>
  );
  return (
    <div className={`overflow-hidden ${className ?? ""}`}>
      <div
        className="flex w-max"
        style={{ animation: `v5-marquee ${durationS}s linear infinite` }}
      >
        {track}
        {track}
      </div>
    </div>
  );
}
