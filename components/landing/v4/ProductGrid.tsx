"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useShop } from "./context";
import { ConditionLabel, CroppedShot, PriceTag, RefCode, RevealV4, TextLink } from "./primitives";
import { PRODUCTS, type ShopProduct } from "./data";

function ProductTile({ product, index }: { product: ShopProduct; index: number }) {
  const { selectedId, select } = useShop();
  const [added, setAdded] = useState(false);
  const isSelected = selectedId === product.id;

  return (
    <RevealV4 delay={index * 50} y={16}>
      <motion.article initial="rest" animate="rest" whileHover="hover" className="group flex h-full flex-col">
        <button
          type="button"
          onClick={() => select(product.id)}
          aria-pressed={isSelected}
          className={cn(
            "relative block aspect-[4/5] w-full overflow-hidden bg-[var(--v4-canvas-deep)] text-left transition-shadow duration-300",
            isSelected && "shadow-[0_0_0_1.5px_var(--v4-accent)]",
          )}
        >
          <motion.div
            variants={{ rest: { scale: 1 }, hover: { scale: 1.04 } }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0"
          >
            <CroppedShot crop={product.crop} alt={product.name} />
          </motion.div>
          <motion.div
            variants={{ rest: { opacity: 0 }, hover: { opacity: 1 } }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0"
          >
            <CroppedShot crop={product.cropAlt} alt="" />
          </motion.div>
        </button>

        <div className="flex flex-1 flex-col gap-2 pt-3">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 truncate text-[13.5px] leading-snug text-[var(--v4-ink)]">
              {product.name}
              <RefCode index={index} />
            </p>
            <ConditionLabel condition={product.condition} className="shrink-0 pt-0.5" />
          </div>
          <p className="-mt-1 truncate text-[11px] text-[var(--v4-muted)]">
            {product.merchant} · {product.detail}
          </p>
          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            <PriceTag price={product.price} />
            {product.price !== null ? (
              <button
                type="button"
                onClick={() => setAdded((v) => !v)}
                aria-pressed={added}
                className={cn(
                  "shrink-0 text-[11px] uppercase tracking-[0.06em] transition-colors",
                  added ? "text-[var(--v4-ink)]" : "text-[var(--v4-faint)] hover:text-[var(--v4-ink)]",
                )}
              >
                {added ? "Ajouté ✓" : "+ Ajouter"}
              </button>
            ) : (
              <Link href="/create" className="shrink-0 text-[11px] uppercase tracking-[0.06em] text-[var(--v4-faint)] hover:text-[var(--v4-ink)]">
                Voir →
              </Link>
            )}
          </div>
        </div>
      </motion.article>
    </RevealV4>
  );
}

export function ProductGrid() {
  return (
    <section id="shop-the-room" className="scroll-mt-24 bg-[var(--v4-paper)]">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-24">
        <div className="max-w-xl">
          <RevealV4>
            <p className="font-serif text-[15px] italic text-[var(--v4-muted)]">Shop the room</p>
          </RevealV4>
          <RevealV4 delay={60}>
            <h2 className="mt-2 font-serif text-[28px] font-normal leading-[1.1] tracking-[-0.01em] text-[var(--v4-ink)] md:text-[38px]">
              Chaque objet du rendu, prêt à commander.
            </h2>
          </RevealV4>
          <RevealV4 delay={110}>
            <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--v4-muted)]">
              Pas de mood board : une liste d&apos;achat réelle, enseigne par enseigne, avec ce que vous gardez déjà.
            </p>
          </RevealV4>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
          {PRODUCTS.map((product, i) => (
            <ProductTile key={product.id} product={product} index={i} />
          ))}
        </div>

        <RevealV4 delay={80} className="mt-14 flex flex-col items-center gap-3 border-t border-[var(--v4-border)] pt-10 text-center">
          <p className="text-[14px] text-[var(--v4-muted)]">Ce rendu, c&apos;est le vôtre en 2 minutes.</p>
          <Link href="/create" className="inline-flex items-center border border-[var(--v4-accent)] px-6 py-2.5 text-[13px] text-[var(--v4-accent)] transition-colors hover:bg-[var(--v4-accent)] hover:text-white">
            <TextLink>Essayer sur ma photo</TextLink>
          </Link>
        </RevealV4>
      </div>
    </section>
  );
}
