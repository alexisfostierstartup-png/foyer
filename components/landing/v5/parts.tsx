"use client";

/* =============================================================================
 * Landing v5 — primitives.
 * Volontairement réduites au strict nécessaire : un reveal au scroll, un
 * masque de titre, et l'image avant/après scroll-liée du hero (le seul
 * dispositif motion qui porte un sens produit — la transformation elle-même).
 * Pas de curseur custom, pas de bouton magnétique, pas de marquee : ces
 * effets ne servaient qu'à décorer un squelette de page repris de la v2.
 * ========================================================================== */

import { useRef, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "motion/react";

/* ---------------------------------- REVEAL --------------------------------- */

export function RevealV5({
  children,
  className,
  delay = 0,
  y: distance = 18,
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
      transition={{ duration: 0.8, delay: delay / 1000, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Révélation "masquée" ligne par ligne — réservée à l'unique phrase du hero. */
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
        transition={{ duration: 1, delay: delay / 1000, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/* --------------------------- TRANSFORMATION (HERO) -------------------------- *
 * Le seul dispositif motion "signature" de la v5 : la photo AVANT se résout
 * en photo APRÈS pendant qu'on quitte le premier viewport, avec un léger
 * scale/parallax. Ce n'est pas un slider à manipuler (déjà fait en v2/v3) —
 * ici la transformation se lit passivement, au rythme du scroll, parce que
 * c'est littéralement le produit : on ne "décore" pas avec du motion, le
 * motion EST le message.
 * -------------------------------------------------------------------------- */
export function TransformationImage({
  before,
  after,
  altBefore,
  altAfter,
  className,
}: {
  before: string;
  after: string;
  altBefore: string;
  altAfter: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const afterOpacity = useTransform(scrollYProgress, [0, 0.4], [0, 1]);

  return (
    <div ref={ref} className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <motion.img
        src={before}
        alt={altBefore}
        style={{ scale }}
        className="absolute inset-0 h-full w-full object-cover grayscale-[0.3] contrast-[1.05]"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <motion.img
        src={after}
        alt={altAfter}
        style={{ scale, opacity: afterOpacity }}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}
