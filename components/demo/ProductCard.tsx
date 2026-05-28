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
  type LucideIcon,
} from "lucide-react";
import {
  SOURCE_META,
  type DemoProduct,
  type DemoProductKind,
} from "@/lib/demo-products";

const KIND_ICON: Record<DemoProductKind, LucideIcon> = {
  sofa: Sofa,
  table: Table,
  rug: CircleDot,
  lamp: LampFloor,
  armchair: Armchair,
  paint: PaintBucket,
  tvstand: Tv,
};

export function ProductCard({ product }: { product: DemoProduct }) {
  const [imgOk, setImgOk] = useState(true);
  const Icon = KIND_ICON[product.kind];
  const meta = SOURCE_META[product.source];

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-foyer-border bg-white p-3">
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
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium ${meta.badgeClass}`}
          >
            <span className={`size-1.5 rounded-full ${meta.dotClass}`} aria-hidden />
            {meta.label}
          </span>
          <span className="text-[13px] text-foyer-muted">{product.merchant}</span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[15px] font-semibold text-foyer-ink">
          {product.price}
        </span>
        <a
          href="#"
          className="rounded-full border border-foyer-border px-3 py-1 text-[13px] text-foyer-ink hover:bg-foyer-cream"
        >
          Voir
        </a>
      </div>
    </div>
  );
}
