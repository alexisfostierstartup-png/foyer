"use client";

import type { CSSProperties, ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { CONDITION_LABEL, HERO_IMAGE, type Condition, type Crop } from "./data";

/* -------------------------------------------------------------------------- *
 * RevealV4 — apparition au scroll en physique ressort (motion `whileInView`),
 * volontairement plus "rebondi" que les fades doux de v1/v2.
 * -------------------------------------------------------------------------- */
export function RevealV4({
  children,
  className,
  delay = 0,
  y = 22,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
      transition={{ type: "spring", stiffness: 260, damping: 26, delay: delay / 1000 }}
    >
      {children}
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- *
 * CroppedShot — recadre/zoome la même photo hero pour simuler une photo
 * produit isolée (pas de vraies photos individuelles disponibles).
 * -------------------------------------------------------------------------- */
export function CroppedShot({
  crop,
  alt,
  className,
  src = HERO_IMAGE,
}: {
  crop: Crop;
  alt: string;
  className?: string;
  src?: string;
}) {
  const style: CSSProperties = {
    objectPosition: `${crop.x}% ${crop.y}%`,
    transform: `scale(${crop.zoom})`,
    transformOrigin: `${crop.x}% ${crop.y}%`,
  };
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={cn("absolute inset-0 h-full w-full object-cover", className)}
      style={style}
    />
  );
}

const CONDITION_TONE: Record<Condition, string> = {
  conserve: "bg-[var(--v4-sage-wash)] text-[var(--v4-sage)] ring-[var(--v4-sage)]/25",
  occasion: "bg-[var(--v4-ochre-wash)] text-[var(--v4-ochre-deep)] ring-[var(--v4-ochre)]/35",
  neuf: "bg-[var(--v4-ink-wash)] text-[var(--v4-ink)] ring-[var(--v4-ink)]/12",
};

export function ConditionBadge({ condition, className }: { condition: Condition; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.09em] ring-1 backdrop-blur-sm",
        CONDITION_TONE[condition],
        className,
      )}
    >
      {CONDITION_LABEL[condition]}
    </span>
  );
}

export function PriceTag({
  price,
  size = "md",
  className,
}: {
  price: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  if (price === null) {
    return (
      <span className={cn("text-[12px] font-semibold text-[var(--v4-muted)]", className)}>
        Déjà chez vous
      </span>
    );
  }
  const sizeClass =
    size === "lg" ? "text-[26px] md:text-[30px]" : size === "sm" ? "text-[14px]" : "text-[17px]";
  return (
    <span className={cn("font-serif font-medium tracking-[-0.01em] text-[var(--v4-price)]", sizeClass, className)}>
      {price}&nbsp;€
    </span>
  );
}
