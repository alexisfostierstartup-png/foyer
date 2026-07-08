"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useShop } from "./context";
import { CroppedShot, ConditionBadge, PriceTag } from "./primitives";
import { HERO_IMAGE, PRODUCTS, type ShopProduct } from "./data";

/** Place la carte flottante desktop du bon côté du point pour ne jamais sortir du cadre. */
function cardOffset(hotspot: { x: number; y: number }): CSSProperties {
  const fromRight = hotspot.x > 55;
  const fromBottom = hotspot.y > 55;
  return {
    left: `${hotspot.x}%`,
    top: `${hotspot.y}%`,
    transform: `translate(${fromRight ? "calc(-100% - 20px)" : "20px"}, ${
      fromBottom ? "calc(-100% - 14px)" : "-50%"
    })`,
  };
}

function HotspotDot({
  product,
  index,
  isSelected,
  onSelect,
}: {
  product: ShopProduct;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    // Le centrage (-1/2,-1/2) vit sur ce wrapper statique, jamais touché par
    // motion : le bouton animé ci-dessous gère lui seul son propre transform
    // (scale de pop-in), sinon motion écrase l'offset de centrage au montage.
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${product.hotspot.x}%`, top: `${product.hotspot.y}%` }}
    >
      <motion.button
        type="button"
        onClick={onSelect}
        aria-pressed={isSelected}
        aria-label={`${product.name} — ${product.price !== null ? `${product.price} €` : "déjà chez vous"}`}
        className="relative z-10 flex touch-manipulation items-center justify-center p-2"
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 340, damping: 18, delay: 0.5 + index * 0.12 }}
      >
        {!isSelected && (
          <motion.span
            aria-hidden
            className="absolute size-6 rounded-full bg-white/70"
            animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 0.9 + index * 0.2 }}
          />
        )}
        <motion.span
          aria-hidden
          animate={{ scale: isSelected ? 1.2 : 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 20 }}
          className={cn(
            "relative flex size-6 items-center justify-center rounded-full ring-[3px] ring-white shadow-[0_3px_12px_rgba(31,27,22,0.35)] transition-colors duration-300",
            isSelected ? "bg-[var(--v4-ink)]" : "bg-[var(--v4-terra)]",
          )}
        >
          <span className="size-1.5 rounded-full bg-white" />
        </motion.span>
      </motion.button>
    </div>
  );
}

function ProductCardBody({ product, onClose }: { product: ShopProduct; onClose: () => void }) {
  return (
    <>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer la fiche produit"
        className="absolute right-2 top-2 z-10 flex size-5 items-center justify-center rounded-full bg-[var(--v4-ink-wash)] text-[var(--v4-ink)]"
      >
        <X className="size-3" strokeWidth={2.4} />
      </button>
      <div className="flex gap-3 p-3 pr-7">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-[var(--v4-canvas-deep)]">
          <CroppedShot crop={product.crop} alt={product.name} />
        </div>
        <div className="min-w-0 flex-1">
          <ConditionBadge condition={product.condition} />
          <p className="mt-1.5 truncate text-[13px] font-medium leading-tight text-[var(--v4-ink)]">
            {product.name}
          </p>
          {product.price !== null && (
            <p className="mt-0.5 truncate text-[11px] text-[var(--v4-muted)]">{product.merchant}</p>
          )}
          <div className="mt-1.5">
            <PriceTag price={product.price} size="sm" />
          </div>
        </div>
      </div>
      <Link
        href="/create"
        className="flex items-center justify-between gap-2 border-t border-[var(--v4-border)] bg-[var(--v4-canvas)] px-3 py-2 text-[12px] font-semibold text-[var(--v4-ink)] transition-colors hover:bg-[var(--v4-canvas-deep)]"
      >
        {product.price !== null ? `Voir chez ${product.merchant}` : "Retrouver dans mon inventaire"}
        <ArrowUpRight className="size-3.5" aria-hidden />
      </Link>
    </>
  );
}

function ProductCardDesktop({ product, onClose }: { product: ShopProduct; onClose: () => void }) {
  return (
    // Même règle que pour HotspotDot : le placement (quel côté du point la
    // carte occupe) vit sur un wrapper statique ; motion garde l'exclusivité
    // du transform sur son propre élément pour le pop-in spring.
    <div className="absolute z-30 hidden w-[236px] sm:block" style={cardOffset(product.hotspot)}>
      <motion.div
        key={product.id}
        initial={{ opacity: 0, scale: 0.85, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 4 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className="overflow-hidden rounded-2xl bg-white shadow-[0_20px_50px_rgba(31,27,22,0.25)] ring-1 ring-[var(--v4-border)]"
      >
        <ProductCardBody product={product} onClose={onClose} />
      </motion.div>
    </div>
  );
}

function ProductSheetMobile({ product, onClose }: { product: ShopProduct; onClose: () => void }) {
  return (
    <>
      <motion.button
        type="button"
        aria-label="Fermer la fiche produit"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-[var(--v4-ink)]/25 sm:hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        key={product.id}
        initial={{ opacity: 0, y: 36 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 28 }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        className="fixed inset-x-3 bottom-[84px] z-50 overflow-hidden rounded-2xl bg-white shadow-[0_20px_50px_rgba(31,27,22,0.3)] ring-1 ring-[var(--v4-border)] sm:hidden"
      >
        <ProductCardBody product={product} onClose={onClose} />
      </motion.div>
    </>
  );
}

export function HotspotHero() {
  const { selectedId, select } = useShop();
  const selectedProduct = PRODUCTS.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-6 -top-10 -bottom-10 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_75%_10%,var(--v4-sage-wash),transparent_65%)]"
      />
      <div className="relative mx-auto aspect-[10/7] w-full overflow-hidden rounded-[28px] bg-[var(--v4-canvas-deep)] shadow-[0_30px_80px_rgba(31,27,22,0.16),0_0_0_1px_rgba(31,27,22,0.05)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_IMAGE}
          alt="Salon transformé — chaque objet du rendu est cliquable et achetable"
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />

        <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 shadow-[0_6px_20px_rgba(31,27,22,0.18)] backdrop-blur-sm sm:left-5 sm:top-5">
          <span className="flex size-2 rounded-full bg-[var(--v4-terra)]" />
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--v4-ink)]">
            {PRODUCTS.length} produits identifiés
          </span>
        </div>

        <div className="absolute bottom-4 right-4 hidden rounded-full bg-[var(--v4-ink)]/85 px-3 py-1.5 text-[11px] font-medium text-white/90 backdrop-blur-sm sm:block">
          Touchez un point pour voir le produit
        </div>

        {PRODUCTS.map((product, i) => (
          <HotspotDot
            key={product.id}
            product={product}
            index={i}
            isSelected={selectedId === product.id}
            onSelect={() => select(product.id)}
          />
        ))}

        <AnimatePresence>
          {selectedProduct && (
            <ProductCardDesktop product={selectedProduct} onClose={() => select(null)} />
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedProduct && (
          <ProductSheetMobile product={selectedProduct} onClose={() => select(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
