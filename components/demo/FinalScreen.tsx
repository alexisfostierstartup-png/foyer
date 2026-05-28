"use client";

import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { PrimaryButton, DemoImage } from "@/components/demo/primitives";
import { ProductCard } from "@/components/demo/ProductCard";
import { demoProducts } from "@/lib/demo-products";

export function FinalScreen({ onRestart }: { onRestart: () => void }) {
  const { secondhand, ecoNew, total } = useMemo(() => {
    let sh = 0;
    let en = 0;
    let sum = 0;
    for (const p of demoProducts) {
      if (p.source === "secondhand") sh += 1;
      else en += 1;
      sum += Number(p.price.replace(/[^\d]/g, ""));
    }
    return { secondhand: sh, ecoNew: en, total: sum };
  }, []);

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative">
        <DemoImage src="/demo/final.png" alt="Votre projet" label="final" />
        <span className="absolute left-3 top-3 rounded-full border border-foyer-border bg-white px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-foyer-ink">
          Votre projet
        </span>
      </div>

      <h2 className="mt-6 font-serif text-[24px] font-medium leading-tight text-foyer-ink">
        Tout ce qu&apos;on voit, vous pouvez l&apos;avoir.
      </h2>
      <p className="mt-2 text-[15px] text-foyer-muted">
        On privilégie la seconde main, puis le neuf responsable.
      </p>

      <ul className="mt-5 flex flex-col gap-3">
        {demoProducts.map((p) => (
          <li key={p.id}>
            <ProductCard product={p} />
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-2xl border border-foyer-border bg-white p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-foyer-muted">
          Score Foyer
        </p>
        <p className="mt-2 text-[15px] text-foyer-ink">
          {secondhand} pièces chinées · {ecoNew} neuves responsables · ~48 kg
          CO₂ évités
        </p>
        <p className="mt-1 text-[12px] text-foyer-muted">
          Base ADEME, calcul indicatif.
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <span className="text-[15px] font-medium text-foyer-ink">
          Total du projet
        </span>
        <span className="font-serif text-2xl text-foyer-ink">~{total} €</span>
      </div>

      <div className="mt-5">
        <PrimaryButton>
          Tout ouvrir
          <ArrowRight className="size-4" aria-hidden />
        </PrimaryButton>
      </div>

      <button
        type="button"
        onClick={onRestart}
        className="mx-auto mt-5 text-[13px] text-foyer-muted underline underline-offset-4 hover:text-foyer-ink"
      >
        Recommencer la démo
      </button>
    </div>
  );
}
