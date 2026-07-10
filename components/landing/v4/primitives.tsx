"use client";

import type { CSSProperties, ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { CONDITION_LABEL, HERO_IMAGE, type Condition, type Crop } from "./data";

/* -------------------------------------------------------------------------- *
 * RevealV4 — apparition au scroll sobre (fade + très léger déplacement).
 * Volontairement plus posée que v2/v3 : pas de spring rebondissant, la
 * retenue est le point de style ici (référence : maisons de mobilier haut de
 * gamme, pas d'app mobile).
 * -------------------------------------------------------------------------- */
export function RevealV4({
  children,
  className,
  delay = 0,
  y = 12,
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
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: delay / 1000 }}
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

/**
 * ConditionLabel — remplace l'ancien badge en pilule colorée. Une marque de
 * mobilier haut de gamme ne code pas ses catégories par couleur : simple
 * légende grise, petites capitales, alignée comme une métadonnée de fiche
 * produit (référence : catégorie produit &Tradition).
 */
export function ConditionLabel({ condition, className }: { condition: Condition; className?: string }) {
  return (
    <span
      className={cn(
        "whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--v4-faint)]",
        className,
      )}
    >
      {CONDITION_LABEL[condition]}
    </span>
  );
}

/** RefCode — petit code référence en exposant, façon nomenclature designer ("Numbra ᵀʸ³"). */
export function RefCode({ index, className }: { index: number; className?: string }) {
  const code = `HR·${String(index + 1).padStart(2, "0")}`;
  return (
    <sup className={cn("ml-1 text-[9px] font-normal tracking-[0.03em] text-[var(--v4-faint)]", className)}>
      {code}
    </sup>
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
      <span className={cn("text-[12px] text-[var(--v4-muted)]", className)}>
        Déjà chez vous
      </span>
    );
  }
  const sizeClass =
    size === "lg" ? "text-[24px] md:text-[28px]" : size === "sm" ? "text-[13px]" : "text-[15px]";
  return (
    <span className={cn("font-serif font-normal tracking-[-0.01em] text-[var(--v4-price)]", sizeClass, className)}>
      {price}&nbsp;€
    </span>
  );
}

/** Lien texte + flèche fine qui glisse au survol — remplace le bouton pilule + bulle icône. */
export function TextLink({
  children,
  className,
  arrow = true,
}: {
  children: ReactNode;
  className?: string;
  arrow?: boolean;
}) {
  return (
    <span className={cn("group/link inline-flex items-center gap-1.5", className)}>
      {children}
      {arrow && (
        <span aria-hidden className="inline-block transition-transform duration-300 group-hover/link:translate-x-1">
          →
        </span>
      )}
    </span>
  );
}
