"use client";

import { useState } from "react";
import {
  Sofa,
  Table,
  CircleDot,
  LampFloor,
  Tv,
  Frame,
  Grid2x2,
  BookOpen,
  Shrub,
  PaintBucket,
  Package,
  Pencil,
  Check,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShoppingItem, ShoppingMerchant, ShoppingSource } from "@/lib/types";

// ── Icons ────────────────────────────────────────────────────────────────────
const CATEGORY_ICON: Record<string, LucideIcon> = {
  sofa: Sofa, armchair: Sofa,
  table: Table, coffee_table: Table,
  rug: CircleDot,
  lamp: LampFloor,
  tv_stand: Tv,
  molding: Frame, mirror: Frame,
  floor: Grid2x2,
  shelf: BookOpen,
  plant: Shrub,
  curtain: Package, cushion: Package, other: Package,
  paint: PaintBucket,
};

// ── Tags ─────────────────────────────────────────────────────────────────────
const SOURCE_TAG: Record<ShoppingSource, { label: string; className: string }> = {
  reuse: { label: "Réutilisation", className: "bg-foyer-sage/15 text-foyer-sage" },
  diy:   { label: "Réutilisation", className: "bg-foyer-sage/15 text-foyer-sage" },
  secondhand: { label: "Seconde main", className: "bg-sky-100 text-sky-700" },
  new:   { label: "Neuf",            className: "bg-violet-100 text-violet-700" },
};

function SourceTag({ source }: { source: ShoppingSource }) {
  const t = SOURCE_TAG[source] ?? SOURCE_TAG.new;
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-medium", t.className)}>
      {t.label}
    </span>
  );
}

// ── Search-URL fallback (when AI doesn't provide a product URL) ───────────────
const SEARCH_URL: Record<string, (q: string) => string> = {
  "Selency":        q => `https://selency.fr/search?q=${encodeURIComponent(q)}`,
  "Leboncoin":      q => `https://www.leboncoin.fr/recherche?text=${encodeURIComponent(q)}`,
  "Vinted":         q => `https://www.vinted.fr/catalog?search_text=${encodeURIComponent(q)}`,
  "Troc de l'Île":  q => `https://www.trocdelile.com/recherche?q=${encodeURIComponent(q)}`,
  "IKEA":           q => `https://www.ikea.com/fr/fr/search/?q=${encodeURIComponent(q)}`,
  "La Redoute":     q => `https://www.laredoute.fr/ppdp/cat-croisee.aspx?search=${encodeURIComponent(q)}`,
  "Maisons du Monde": q => `https://www.maisonsdumonde.com/FR/fr/search?searchTerm=${encodeURIComponent(q)}`,
  "Alinéa":         q => `https://www.alinea.com/fr-fr/search/?q=${encodeURIComponent(q)}`,
  "But":            q => `https://www.but.fr/recherche.html?q=${encodeURIComponent(q)}`,
  "BUT":            q => `https://www.but.fr/recherche.html?q=${encodeURIComponent(q)}`,
  "Leroy Merlin":   q => `https://www.leroymerlin.fr/recherche/${encodeURIComponent(q)}.html`,
  "Jardineries Truffaut": q => `https://www.truffaut.com/recherche?q=${encodeURIComponent(q)}`,
  "Castorama":      q => `https://www.castorama.fr/store/search?q=${encodeURIComponent(q)}`,
  "ManoMano":       q => `https://www.manomano.fr/search/${encodeURIComponent(q)}`,
};

function merchantUrl(merchant: ShoppingMerchant, productName: string): string | null {
  if (merchant.source === "reuse" || merchant.source === "diy") return null;
  if (merchant.url) return merchant.url;
  const fn = SEARCH_URL[merchant.name];
  return fn ? fn(productName) : null;
}

// ── Normalise merchants — handle both string[] (legacy) and ShoppingMerchant[] ──
function normalizeMerchant(m: ShoppingMerchant | string): ShoppingMerchant {
  if (typeof m === "string") return { name: m, source: "secondhand" };
  return m;
}

// ── Price display ─────────────────────────────────────────────────────────────
function displayPrice(item: ShoppingItem): string {
  const qty = item.quantity ?? 1;
  if (item.priceMin > 0 && item.priceMin === item.priceMax) {
    return `${item.priceMin * qty} €`;
  }
  const mid = item.priceMin && item.priceMax
    ? Math.round((item.priceMin + item.priceMax) / 2)
    : item.priceMin || item.priceMax;
  const total = mid * qty;
  return total ? `~${total} €` : "–";
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function ShoppingCard({ item }: { item: ShoppingItem }) {
  const [open, setOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [imgError, setImgError] = useState(false);

  const Icon = CATEGORY_ICON[item.category] ?? Package;
  const merchants = (item.merchants ?? []).map(normalizeMerchant);
  const selected = merchants[selectedIdx] ?? merchants[0];

  if (!selected) return null;

  return (
    <div className="rounded-2xl border border-foyer-border bg-white p-3">
      <div className="flex items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-foyer-border bg-foyer-cream">
          {item.imgUrl && !imgError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imgUrl}
              alt={item.name}
              className="size-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <Icon className="size-7 text-foyer-muted" strokeWidth={1.5} aria-hidden />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="truncate text-[15px] font-medium text-foyer-ink">
            {item.name}
            {(item.quantity ?? 1) > 1 && (
              <span className="ml-1 text-foyer-muted">×{item.quantity}</span>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <SourceTag source={selected.source} />
            <span className="text-[13px] text-foyer-muted">{selected.name}</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="font-serif text-[17px] text-foyer-ink">{displayPrice(item)}</span>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[13px] transition-colors",
              open
                ? "border-foyer-ink text-foyer-ink"
                : "border-foyer-border text-foyer-muted hover:text-foyer-ink",
            )}
          >
            <Pencil className="size-3" aria-hidden />
            Modifier
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 border-t border-foyer-border pt-3">
          <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-foyer-muted">
            Autres options
          </p>
          <ul className="flex flex-col gap-2">
            {merchants.map((m, i) => {
              const current = i === selectedIdx;
              const url = merchantUrl(m, item.name);
              return (
                <li
                  key={`${m.name}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-foyer-border p-2.5"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-[14px] text-foyer-ink">{m.name}</span>
                    <SourceTag source={m.source} />
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 rounded-full border border-foyer-border px-2.5 py-1 text-[13px] text-foyer-ink hover:bg-foyer-cream transition-colors"
                      >
                        <ExternalLink className="size-3" aria-hidden />
                        Voir
                      </a>
                    )}
                    <button
                      type="button"
                      disabled={current}
                      onClick={() => { setSelectedIdx(i); setOpen(false); }}
                      className={cn(
                        "flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-medium transition-colors",
                        current
                          ? "cursor-default bg-foyer-sage/15 text-foyer-sage"
                          : "bg-foyer-sage text-white hover:bg-foyer-sage/90",
                      )}
                    >
                      {current ? (
                        <><Check className="size-3.5" aria-hidden />Choisi</>
                      ) : (
                        "Sélectionner"
                      )}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
