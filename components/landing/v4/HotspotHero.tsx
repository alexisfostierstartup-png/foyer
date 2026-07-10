"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useShop } from "./context";
import { CroppedShot, ConditionLabel, PriceTag, RefCode, TextLink } from "./primitives";
import { HERO_IMAGE, PRODUCTS, type ShopProduct } from "./data";

/** Place la fiche flottante desktop du bon côté du point pour ne jamais sortir du cadre. */
function cardOffset(hotspot: { x: number; y: number }): CSSProperties {
  const fromRight = hotspot.x > 55;
  const fromBottom = hotspot.y > 55;
  return {
    left: `${hotspot.x}%`,
    top: `${hotspot.y}%`,
    transform: `translate(${fromRight ? "calc(-100% - 18px)" : "18px"}, ${
      fromBottom ? "calc(-100% - 12px)" : "-50%"
    })`,
  };
}

/**
 * Point d'annotation — discret, façon légende de plan plutôt que pastille
 * d'alerte. Pas d'animation `ping` continue : un seul fondu à l'apparition,
 * puis un point fixe. L'état sélectionné se lit au remplissage, pas à la taille.
 */
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
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${product.hotspot.x}%`, top: `${product.hotspot.y}%` }}
    >
      <motion.button
        type="button"
        onClick={onSelect}
        aria-pressed={isSelected}
        aria-label={`${product.name} — ${product.price !== null ? `${product.price} €` : "déjà chez vous"}`}
        className="relative z-10 flex touch-manipulation items-center justify-center p-2.5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 + index * 0.08 }}
      >
        <span
          className={cn(
            "flex size-[9px] items-center justify-center rounded-full border transition-colors duration-300",
            isSelected
              ? "border-[var(--v4-accent)] bg-[var(--v4-accent)]"
              : "border-white bg-white/40 shadow-[0_0_0_1px_rgba(31,27,22,0.35)] backdrop-blur-[1px]",
          )}
        />
      </motion.button>
    </div>
  );
}

function ProductCardBody({ product, index, onClose }: { product: ShopProduct; index: number; onClose: () => void }) {
  return (
    <>
      <div className="flex gap-3 p-4">
        <div className="relative size-16 shrink-0 overflow-hidden bg-[var(--v4-canvas-deep)]">
          <CroppedShot crop={product.crop} alt={product.name} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[13.5px] leading-tight text-[var(--v4-ink)]">
              {product.name}
              <RefCode index={index} />
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer la fiche produit"
              className="shrink-0 text-[13px] text-[var(--v4-faint)] transition-colors hover:text-[var(--v4-ink)]"
            >
              ✕
            </button>
          </div>
          {product.price !== null && (
            <p className="mt-1 truncate text-[11px] text-[var(--v4-muted)]">{product.merchant}</p>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            <PriceTag price={product.price} size="sm" />
            <ConditionLabel condition={product.condition} />
          </div>
        </div>
      </div>
      <Link
        href="/create"
        className="flex items-center justify-between gap-2 border-t border-[var(--v4-border)] px-4 py-2.5 text-[12px] text-[var(--v4-ink)] transition-colors hover:bg-[var(--v4-ink-wash)]"
      >
        {product.price !== null ? (
          <TextLink>Voir chez {product.merchant}</TextLink>
        ) : (
          <TextLink>Retrouver dans mon inventaire</TextLink>
        )}
      </Link>
    </>
  );
}

function ProductCardDesktop({
  product,
  index,
  onClose,
}: {
  product: ShopProduct;
  index: number;
  onClose: () => void;
}) {
  return (
    <div className="absolute z-30 hidden w-[240px] sm:block" style={cardOffset(product.hotspot)}>
      <motion.div
        key={product.id}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden border border-[var(--v4-border)] bg-white"
      >
        <ProductCardBody product={product} index={index} onClose={onClose} />
      </motion.div>
    </div>
  );
}

function ProductSheetMobile({
  product,
  index,
  onClose,
}: {
  product: ShopProduct;
  index: number;
  onClose: () => void;
}) {
  return (
    <>
      <motion.button
        type="button"
        aria-label="Fermer la fiche produit"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-[var(--v4-ink)]/20 sm:hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        key={product.id}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-x-3 bottom-[88px] z-50 overflow-hidden border border-[var(--v4-border)] bg-white sm:hidden"
      >
        <ProductCardBody product={product} index={index} onClose={onClose} />
      </motion.div>
    </>
  );
}

export function HotspotHero() {
  const { selectedId, select } = useShop();
  const selectedIndex = PRODUCTS.findIndex((p) => p.id === selectedId);
  const selectedProduct = selectedIndex >= 0 ? PRODUCTS[selectedIndex] : null;

  return (
    <div className="relative">
      <div className="relative mx-auto aspect-[10/7] w-full overflow-hidden bg-[var(--v4-canvas-deep)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_IMAGE}
          alt="Salon transformé — chaque objet du rendu est cliquable et achetable"
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />

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
            <ProductCardDesktop product={selectedProduct} index={selectedIndex} onClose={() => select(null)} />
          )}
        </AnimatePresence>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-[0.1em] text-[var(--v4-faint)]">
        <span>{PRODUCTS.length} objets identifiés</span>
        <span className="hidden sm:inline">Touchez un point pour voir le produit</span>
      </div>

      <AnimatePresence>
        {selectedProduct && (
          <ProductSheetMobile product={selectedProduct} index={selectedIndex} onClose={() => select(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
