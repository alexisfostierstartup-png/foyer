"use client";

import { useState } from "react";
import {
  Sofa,
  Table,
  CircleDot,
  LampFloor,
  Armchair,
  PaintBucket,
  Tv,
  Frame,
  Grid2x2,
  Pencil,
  Check,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SOURCE_META,
  type DemoProduct,
  type DemoProductKind,
  type ProductOption,
} from "@/lib/demo-products";

const KIND_ICON: Record<DemoProductKind, LucideIcon> = {
  sofa: Sofa,
  table: Table,
  rug: CircleDot,
  lamp: LampFloor,
  armchair: Armchair,
  paint: PaintBucket,
  tvstand: Tv,
  molding: Frame,
  floor: Grid2x2,
};

function SourceBadge({ source }: { source: DemoProduct["source"] }) {
  const meta = SOURCE_META[source];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium ${meta.badgeClass}`}
    >
      <span className={`size-1.5 rounded-full ${meta.dotClass}`} aria-hidden />
      {meta.label}
    </span>
  );
}

export function ProductCard({
  product,
  onSelect,
}: {
  product: DemoProduct;
  onSelect: (option: ProductOption) => void;
}) {
  const [imgOk, setImgOk] = useState(true);
  const [open, setOpen] = useState(false);
  const Icon = KIND_ICON[product.kind];

  return (
    <div className="rounded-2xl border border-foyer-border bg-white p-3">
      <div className="flex items-center gap-4">
        <div className="size-20 shrink-0 overflow-hidden rounded-xl border border-foyer-border bg-foyer-cream">
          {imgOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.img}
              alt={product.name}
              onError={() => setImgOk(false)}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Icon className="size-7 text-foyer-muted" strokeWidth={1.5} aria-hidden />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="truncate text-[15px] font-medium text-foyer-ink">
            {product.name}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge source={product.source} />
            <span className="text-[13px] text-foyer-muted">{product.merchant}</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="text-[15px] font-semibold text-foyer-ink">
            {product.price}
          </span>
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
            {product.alternatives.map((opt) => {
              const current =
                opt.merchant === product.merchant && opt.price === product.price;
              return (
                <li
                  key={`${opt.merchant}-${opt.price}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-foyer-border p-2.5"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-[14px] text-foyer-ink">{opt.merchant}</span>
                    <SourceBadge source={opt.source} />
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[14px] font-medium text-foyer-ink">
                      {opt.price}
                    </span>
                    {opt.url && (
                      <a
                        href={opt.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-foyer-border px-2.5 py-1 text-[13px] text-foyer-ink hover:bg-foyer-cream"
                      >
                        Voir
                      </a>
                    )}
                    <button
                      type="button"
                      disabled={current}
                      onClick={() => {
                        onSelect(opt);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-medium transition-colors",
                        current
                          ? "cursor-default bg-foyer-sage/15 text-foyer-sage"
                          : "bg-foyer-terra-deep text-white hover:bg-foyer-terra-deep/90",
                      )}
                    >
                      {current ? (
                        <>
                          <Check className="size-3.5" aria-hidden />
                          Choisi
                        </>
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
