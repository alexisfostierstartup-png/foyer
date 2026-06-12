"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ProgressBar } from "@/components/create/ProgressBar";
import { ShoppingCard } from "@/components/create/ShoppingCard";
import type { ShoppingItem } from "@/lib/types";

const STEPS = ["Photo", "Style", "Mobilier", "Rendu", "Projet"];

type Props = {
  projectId: string;
  beforeUrl: string;
  afterUrl: string;
  shoppingList: ShoppingItem[];
};

function ScoreBlock({ list }: { list: ShoppingItem[] }) {
  const total = list.length || 1;
  const sh = list.filter((i) => i.source === "secondhand").length;
  const diy = list.filter((i) => i.source === "diy").length;
  const eco = total - sh - diy;

  const shPct = Math.round((sh / total) * 100);
  const diyCo2 = Math.round(diy * 4);
  const shCo2 = Math.round(sh * 18);
  const ecoCo2 = Math.round(eco * 8);
  const co2 = shCo2 + diyCo2 + ecoCo2;

  const SEGMENTS = [
    { value: shPct, label: "occasion", color: "#6B8E6F", dot: "bg-foyer-sage" },
    { value: Math.round((eco / total) * 100), label: "neuf durable", color: "#A5B8A0", dot: "bg-foyer-water" },
    { value: Math.round((diy / total) * 100), label: "DIY / matériaux", color: "#C89B6A", dot: "bg-foyer-ochre" },
  ];

  let acc = 0;

  return (
    <div className="rounded-2xl border border-foyer-border bg-white p-4">
      <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-foyer-muted">
        Score Foyer
      </p>
      <div className="flex items-center gap-5">
        <div className="size-28 shrink-0">
          <svg viewBox="0 0 42 42" className="size-full">
            <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#E5DDD0" strokeWidth="4" />
            <g transform="rotate(-90 21 21)">
              {SEGMENTS.map((s) => {
                const offset = -acc;
                acc += s.value;
                return (
                  <circle
                    key={s.label}
                    cx="21"
                    cy="21"
                    r="15.9155"
                    fill="none"
                    stroke={s.color}
                    strokeWidth="4"
                    strokeDasharray={`${s.value} ${100 - s.value}`}
                    strokeDashoffset={offset}
                  />
                );
              })}
            </g>
          </svg>
        </div>

        <div className="flex-1">
          <ul className="flex flex-col gap-1.5">
            {SEGMENTS.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-[15px]">
                <span className={`size-2.5 rounded-full ${s.dot}`} aria-hidden />
                <span className="text-foyer-ink">{s.value}% {s.label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 font-serif text-xl text-foyer-ink">
            ~{co2}&nbsp;kg CO<sub>2</sub>{" "}
            <span className="font-sans text-sm text-foyer-muted">évités</span>
          </p>
        </div>
      </div>
      <p className="mt-4 text-[12px] leading-relaxed text-foyer-muted">
        Base ADEME, calcul indicatif. Par rapport à un projet tout-neuf équivalent.
      </p>
    </div>
  );
}

export function FinalScreen({ projectId, beforeUrl: _beforeUrl, afterUrl, shoppingList }: Props) {
  const totalMin = useMemo(() => shoppingList.reduce((s, i) => s + i.priceMin, 0), [shoppingList]);
  const totalMax = useMemo(() => shoppingList.reduce((s, i) => s + i.priceMax, 0), [shoppingList]);

  return (
    <div className="flex flex-1 flex-col">
      <ProgressBar currentStep={5} labels={STEPS} />

      <main className="mx-auto w-full max-w-[480px] flex-1 px-5 pb-24 pt-6">
        {/* Final render image — like demo */}
        <div className="relative overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={afterUrl}
            alt="Votre projet"
            className="w-full object-cover"
          />
          <span className="absolute left-3 top-3 rounded-full border border-foyer-border bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-foyer-ink">
            Votre projet
          </span>
        </div>

        {shoppingList.length > 0 ? (
          <>
            <h2 className="mt-6 font-serif text-[24px] font-medium leading-tight text-foyer-ink">
              Tout ce qu&apos;on voit, vous pouvez l&apos;avoir.
            </h2>
            <p className="mt-2 text-[15px] text-foyer-muted">
              On privilégie la seconde main, puis le neuf responsable.
            </p>

            <ul className="mt-5 flex flex-col gap-3">
              {shoppingList.map((item) => (
                <li key={item.id}>
                  <ShoppingCard item={item} />
                </li>
              ))}
            </ul>

            <div className="mt-6">
              <ScoreBlock list={shoppingList} />
            </div>

            <div className="mt-5 flex items-center justify-between">
              <span className="text-[15px] font-medium text-foyer-ink">
                Total du projet
              </span>
              <span className="font-serif text-2xl text-foyer-ink">
                ~{totalMin}–{totalMax}&nbsp;€
              </span>
            </div>
          </>
        ) : (
          <div className="mt-8 rounded-2xl border border-foyer-border bg-white px-5 py-8 text-center">
            <p className="font-serif text-lg text-foyer-ink">
              Liste de courses en préparation…
            </p>
            <p className="mt-2 text-sm text-foyer-muted">
              Rechargez la page dans quelques instants.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-3">
          <Link
            href={`/create/${projectId}/iterate`}
            className="flex h-[52px] w-full items-center justify-center rounded-full border border-foyer-border font-medium text-foyer-ink transition-colors hover:bg-foyer-border/30"
          >
            Affiner encore
          </Link>
          <Link
            href="/"
            className="flex h-[52px] w-full items-center justify-center rounded-full bg-foyer-sage font-medium text-white shadow-[0_2px_8px_rgba(107,142,111,0.35)] transition-all hover:-translate-y-0.5"
          >
            Terminer
          </Link>
        </div>
      </main>
    </div>
  );
}
