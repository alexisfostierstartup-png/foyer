"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useShop } from "./context";
import { ConditionBadge, CroppedShot, PriceTag, RevealV4 } from "./primitives";
import { PRODUCTS, type ShopProduct } from "./data";

function ProductTile({ product, index }: { product: ShopProduct; index: number }) {
  const { selectedId, select } = useShop();
  const [added, setAdded] = useState(false);
  const isSelected = selectedId === product.id;

  return (
    <RevealV4 delay={index * 60} y={26}>
      <motion.article
        initial="rest"
        animate="rest"
        whileHover="hover"
        className={cn(
          "group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white ring-1 transition-shadow duration-300",
          isSelected
            ? "shadow-[0_14px_36px_rgba(31,27,22,0.16)] ring-2 ring-[var(--v4-ink)]"
            : "ring-[var(--v4-border)] hover:shadow-[0_10px_28px_rgba(31,27,22,0.1)]",
        )}
      >
        <button
          type="button"
          onClick={() => select(product.id)}
          aria-pressed={isSelected}
          className="relative block aspect-[4/5] w-full overflow-hidden bg-[var(--v4-canvas-deep)] text-left"
        >
          <motion.div
            variants={{ rest: { scale: 1 }, hover: { scale: 1.08 } }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
            className="absolute inset-0"
          >
            <CroppedShot crop={product.crop} alt={product.name} />
          </motion.div>
          <motion.div
            variants={{ rest: { opacity: 0 }, hover: { opacity: 1 } }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0"
          >
            <CroppedShot crop={product.cropAlt} alt="" />
          </motion.div>
          <div className="absolute left-2 top-2">
            <ConditionBadge condition={product.condition} />
          </div>
        </button>

        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-medium leading-snug text-[var(--v4-ink)]">
              {product.name}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-[var(--v4-muted)]">
              {product.merchant} · {product.detail}
            </p>
          </div>
          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            <PriceTag price={product.price} />
            {product.price !== null ? (
              <button
                type="button"
                onClick={() => setAdded((v) => !v)}
                aria-pressed={added}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
                  added
                    ? "bg-[var(--v4-sage-wash-strong)] text-[var(--v4-sage)]"
                    : "bg-[var(--v4-ink)] text-white hover:bg-[var(--v4-ink)]/85",
                )}
              >
                {added ? (
                  <>
                    <Check className="size-3" strokeWidth={2.6} aria-hidden /> Ajouté
                  </>
                ) : (
                  <>
                    <Plus className="size-3" strokeWidth={2.6} aria-hidden /> Ajouter
                  </>
                )}
              </button>
            ) : (
              <Link
                href="/create"
                className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--v4-ink-wash)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--v4-ink)]"
              >
                Voir <ArrowUpRight className="size-3" aria-hidden />
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
      <div className="mx-auto w-full max-w-6xl px-6 py-14 md:py-20">
        <div className="max-w-xl">
          <RevealV4>
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--v4-terra)]">
              Shop the room
            </p>
          </RevealV4>
          <RevealV4 delay={70}>
            <h2 className="mt-3 font-serif text-[30px] font-medium leading-[1.05] tracking-[-0.02em] text-[var(--v4-ink)] md:text-[42px]">
              Chaque objet du rendu, prêt à commander.
            </h2>
          </RevealV4>
          <RevealV4 delay={130}>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--v4-muted)]">
              Pas de mood board : une liste d&apos;achat réelle, enseigne par enseigne, avec ce que vous gardez déjà.
            </p>
          </RevealV4>
        </div>

        <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {PRODUCTS.map((product, i) => (
            <ProductTile key={product.id} product={product} index={i} />
          ))}
        </div>

        <RevealV4 delay={80} className="mt-10 flex flex-col items-center gap-3 text-center">
          <p className="text-[14px] text-[var(--v4-muted)]">Ce rendu, c&apos;est le vôtre en 2 minutes.</p>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--v4-terra)] px-6 py-3 text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(168,65,42,0.3)] transition-transform hover:-translate-y-0.5"
          >
            Essayer sur ma photo
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </RevealV4>
      </div>
    </section>
  );
}
