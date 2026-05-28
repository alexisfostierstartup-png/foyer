"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Store, RotateCcw } from "lucide-react";
import {
  demoProducts,
  ORDER_STORAGE_KEY,
  SOURCE_META,
  type DemoProduct,
} from "@/lib/demo-products";
import { PrimaryButton } from "@/components/demo/primitives";

function priceToNumber(price: string) {
  return Number(price.replace(/[^\d]/g, ""));
}

export function OrderScreen() {
  const router = useRouter();
  const [items, setItems] = useState<DemoProduct[]>(demoProducts);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ORDER_STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as DemoProduct[]);
    } catch {
      // keep defaults
    }
  }, []);

  const { groups, total } = useMemo(() => {
    const map = new Map<string, DemoProduct[]>();
    for (const it of items) {
      const list = map.get(it.merchant) ?? [];
      list.push(it);
      map.set(it.merchant, list);
    }
    const groups = [...map.entries()]
      .map(([merchant, list]) => ({
        merchant,
        list,
        subtotal: list.reduce((s, p) => s + priceToNumber(p.price), 0),
      }))
      .sort((a, b) => b.list.length - a.list.length);
    const total = items.reduce((s, p) => s + priceToNumber(p.price), 0);
    return { groups, total };
  }, [items]);

  function restart() {
    try {
      localStorage.removeItem(ORDER_STORAGE_KEY);
    } catch {
      // ignore
    }
    router.push("/demo");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-foyer-cream">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-foyer-border bg-foyer-cream/95 px-5 py-3 backdrop-blur">
        <Link
          href="/"
          className="font-serif text-xl tracking-tight text-foyer-ink"
        >
          Foyer
        </Link>
        <button
          type="button"
          onClick={restart}
          className="flex items-center gap-1.5 text-[13px] text-foyer-muted hover:text-foyer-ink"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Recommencer
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-5 py-6">
        <h1 className="font-serif text-[26px] font-medium leading-tight tracking-[-0.02em] text-foyer-ink">
          Votre commande
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-foyer-muted">
          On a regroupé vos {items.length} articles chez {groups.length}{" "}
          {groups.length > 1 ? "enseignes" : "enseigne"} pour limiter les
          livraisons.
        </p>

        <div className="mt-6 flex flex-col gap-4">
          {groups.map((g) => (
            <div
              key={g.merchant}
              className="rounded-2xl border border-foyer-border bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Store className="size-4 text-foyer-ink" strokeWidth={1.5} aria-hidden />
                  <span className="font-medium text-foyer-ink">{g.merchant}</span>
                  <span className="text-[13px] text-foyer-muted">
                    · {g.list.length} {g.list.length > 1 ? "articles" : "article"}
                  </span>
                </span>
                <span className="text-[15px] font-semibold text-foyer-ink">
                  {g.subtotal} €
                </span>
              </div>

              <ul className="mt-3 flex flex-col gap-2">
                {g.list.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 text-[14px]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={`size-1.5 shrink-0 rounded-full ${SOURCE_META[p.source].dotClass}`}
                        aria-hidden
                      />
                      <span className="truncate text-foyer-ink">{p.name}</span>
                    </span>
                    <span className="shrink-0 text-foyer-muted">{p.price}</span>
                  </li>
                ))}
              </ul>

              <a
                href="#"
                className="mt-4 flex h-10 w-full items-center justify-center rounded-full border border-foyer-border text-[14px] font-medium text-foyer-ink hover:bg-foyer-cream"
              >
                Commander chez {g.merchant}
              </a>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <span className="text-[15px] font-medium text-foyer-ink">
            Total du projet
          </span>
          <span className="font-serif text-2xl text-foyer-ink">~{total} €</span>
        </div>

        <div className="mt-5">
          <PrimaryButton>Tout commander</PrimaryButton>
        </div>
      </main>
    </div>
  );
}
