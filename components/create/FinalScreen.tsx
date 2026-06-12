"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { ProgressBar } from "@/components/create/ProgressBar";
import { ShoppingCard } from "@/components/create/ShoppingCard";
import { cn } from "@/lib/utils";
import type { ShoppingItem, ScoreFoyer } from "@/lib/types";

const STEPS = ["Photo", "Style", "Mobilier", "Rendu", "Projet"];
const TABS = ["Mes meubles", "Liste shopping", "Score Foyer"] as const;
type Tab = (typeof TABS)[number];

// ── Alteration shape (from extract_alterations) ───────────────────────────────
type Alteration = {
  element: string;
  action: string;
  category: string;
  detail?: string;
  shoppingImpact: "none" | "to_buy" | "to_buy_secondhand" | "diy_material";
};

type DetectedElement = {
  element?: string;
  type?: string;
  description?: string;
  movable?: boolean;
};

// ── RSE eco-advice (mirrors matcher.ts) ───────────────────────────────────────
const RSE_ADVICE: Record<string, string> = {
  floor_material:
    "Alternative durable : béton ciré sur chape existante = moins de déchets de chantier.",
  paint:
    "Optez pour une peinture à l'eau labellisée NF Environnement — VOC réduits, moins de pollution intérieure.",
  mouldings:
    "Les moulures en MDF recyclé sont plus légères et génèrent moins de déchets que le bois massif.",
};

// ── Status chip helpers ───────────────────────────────────────────────────────
type StatusKey = "kept" | "modified" | "replaced" | "added" | "removed";

const STATUS: Record<StatusKey, { label: string; className: string }> = {
  kept:     { label: "Conservé",   className: "bg-foyer-sage/15 text-foyer-sage" },
  modified: { label: "Modifié",    className: "bg-foyer-ochre/20 text-amber-700" },
  replaced: { label: "Remplacé",   className: "bg-foyer-ink/10 text-foyer-ink" },
  added:    { label: "Ajouté",     className: "bg-foyer-water/20 text-sky-700" },
  removed:  { label: "Retiré",     className: "bg-foyer-terra/15 text-foyer-terra" },
};

function statusFromAction(action: string): StatusKey {
  if (action === "added") return "added";
  if (action === "removed") return "removed";
  if (action === "replaced") return "replaced";
  if (action === "restyled" || action === "painted" || action === "floor_changed") return "modified";
  return "kept";
}

function StatusChip({ status }: { status: StatusKey }) {
  const s = STATUS[status];
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide", s.className)}>
      {s.label}
    </span>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-foyer-muted">
      {children}
    </p>
  );
}

// ── Tab: Mes meubles ─────────────────────────────────────────────────────────
function MesMeublesTab({
  detectedElements,
  alterations,
}: {
  detectedElements: DetectedElement[];
  alterations: Alteration[];
}) {
  // Build list: detected elements + any "added" alterations not already listed
  const items: { name: string; description?: string; status: StatusKey }[] = [];
  const seen = new Set<string>();

  for (const el of detectedElements) {
    const name = el.element ?? el.type ?? "Élément";
    seen.add(name.toLowerCase());

    const match = alterations.find(
      (a) =>
        a.element.toLowerCase() === name.toLowerCase() ||
        a.category.toLowerCase() === (el.type ?? "").toLowerCase(),
    );

    items.push({
      name,
      description: el.description,
      status: match ? statusFromAction(match.action) : "kept",
    });
  }

  // Add alterations not already shown (added / replaced items not in original)
  for (const alt of alterations) {
    if (!seen.has(alt.element.toLowerCase()) && (alt.action === "added" || alt.action === "replaced")) {
      items.push({ name: alt.element, description: alt.detail, status: statusFromAction(alt.action) });
    }
  }

  if (items.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-foyer-border bg-white px-5 py-8 text-center">
        <p className="text-foyer-muted text-[15px]">
          Analyse de la pièce non disponible.
        </p>
      </div>
    );
  }

  return (
    <ul className="mt-4 flex flex-col gap-2">
      {items.map((item, i) => (
        <li
          key={`${item.name}-${i}`}
          className="flex items-center justify-between gap-3 rounded-2xl border border-foyer-border bg-white px-4 py-3"
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-medium capitalize text-foyer-ink">
              {item.name}
            </span>
            {item.description && (
              <span className="text-[13px] text-foyer-muted line-clamp-1">
                {item.description}
              </span>
            )}
          </div>
          <StatusChip status={item.status} />
        </li>
      ))}
    </ul>
  );
}

// ── Tab: Liste shopping ───────────────────────────────────────────────────────
function ListeShoppingTab({
  shoppingList,
  alterations,
}: {
  shoppingList: ShoppingItem[];
  alterations: Alteration[];
}) {
  const kept = alterations.filter((a) => a.shoppingImpact === "none");
  const secondhand = shoppingList.filter((i) => i.source === "secondhand" && i.merchants.length > 0);
  const ecoNew = shoppingList.filter((i) => i.source !== "secondhand" && i.merchants.length > 0);
  const unmatched = shoppingList.filter((i) => i.merchants.length === 0);

  // Collect all merchant URLs for "Tout ouvrir"
  const allUrls = shoppingList
    .flatMap((i) => i.merchants.map((m) => m.url).filter(Boolean))
    .slice(0, 20);

  function openAll() {
    for (const url of allUrls) {
      if (url) window.open(url, "_blank");
    }
  }

  const hasItems = secondhand.length > 0 || ecoNew.length > 0;

  return (
    <div className="mt-4 space-y-6">
      {/* Conservé */}
      {kept.length > 0 && (
        <section>
          <SectionLabel>Conservé ({kept.length})</SectionLabel>
          <ul className="flex flex-col gap-2">
            {kept.map((a) => (
              <li
                key={a.element}
                className="flex items-center gap-3 rounded-xl border border-foyer-border bg-white px-4 py-3"
              >
                <span className="size-2 shrink-0 rounded-full bg-foyer-sage" aria-hidden />
                <span className="text-[14px] capitalize text-foyer-ink">{a.element}</span>
                {a.detail && (
                  <span className="ml-auto text-[12px] text-foyer-muted">{a.detail}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Seconde main */}
      {secondhand.length > 0 && (
        <section>
          <SectionLabel>Seconde main ({secondhand.length})</SectionLabel>
          <ul className="flex flex-col gap-3">
            {secondhand.map((item) => (
              <li key={item.id}>
                <ShoppingCard item={item} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Neuf responsable */}
      {ecoNew.length > 0 && (
        <section>
          <SectionLabel>Neuf responsable ({ecoNew.length})</SectionLabel>
          <ul className="flex flex-col gap-3">
            {ecoNew.map((item) => {
              const advice = RSE_ADVICE[item.category];
              return (
                <li key={item.id}>
                  <ShoppingCard item={item} />
                  {advice && (
                    <p className="mt-1.5 rounded-xl bg-foyer-sage/8 px-3 py-2 text-[12px] leading-relaxed text-foyer-sage">
                      {advice}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Unmatched */}
      {unmatched.length > 0 && (
        <section>
          <SectionLabel>À sourcer ({unmatched.length})</SectionLabel>
          <ul className="flex flex-col gap-2">
            {unmatched.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-dashed border-foyer-border bg-white px-4 py-3"
              >
                <span className="size-2 shrink-0 rounded-full bg-foyer-muted/40" aria-hidden />
                <span className="text-[14px] capitalize text-foyer-muted">{item.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!hasItems && unmatched.length === 0 && (
        <div className="rounded-2xl border border-foyer-border bg-white px-5 py-8 text-center">
          <p className="text-[15px] text-foyer-muted">
            La liste de courses se prépare…
          </p>
        </div>
      )}

      {/* Tout ouvrir */}
      {allUrls.length > 0 && (
        <button
          type="button"
          onClick={openAll}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-foyer-border py-3 text-[14px] font-medium text-foyer-ink transition-colors hover:bg-foyer-border/30"
        >
          <ExternalLink className="size-4" aria-hidden />
          Tout ouvrir ({allUrls.length} liens)
        </button>
      )}
    </div>
  );
}

// ── Tab: Score Foyer ──────────────────────────────────────────────────────────
function ScoreFoyerTab({
  score,
  shoppingList,
}: {
  score?: ScoreFoyer;
  shoppingList: ShoppingItem[];
}) {
  const kept = score?.kept ?? 0;
  const secondhand = score?.secondhand ?? 0;
  const ecoNew = score?.ecoNew ?? 0;
  const total = kept + secondhand + ecoNew || 1;
  const co2 = score?.co2SavedKg ?? kept * 30 + secondhand * 20 + ecoNew * 5;
  const budget = score?.totalEstimated ?? shoppingList.reduce((s, i) => s + (i.priceMin + i.priceMax) / 2, 0);

  const segments = [
    { value: Math.round((kept / total) * 100), label: "conservé", color: "#6B8E6F", dot: "bg-foyer-sage" },
    { value: Math.round((secondhand / total) * 100), label: "occasion", color: "#A5B8A0", dot: "bg-foyer-water" },
    { value: Math.round((ecoNew / total) * 100), label: "neuf durable", color: "#C89B6A", dot: "bg-foyer-ochre" },
  ];

  let acc = 0;

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl border border-foyer-border bg-white p-5">
        <div className="flex items-center gap-6">
          {/* Donut */}
          <div className="size-32 shrink-0">
            <svg viewBox="0 0 42 42" className="size-full -rotate-90">
              <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#E5DDD0" strokeWidth="4" />
              {segments.map((s) => {
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
            </svg>
          </div>

          {/* Légende */}
          <div className="flex-1">
            <ul className="flex flex-col gap-1.5">
              {segments.map((s) => (
                <li key={s.label} className="flex items-center gap-2">
                  <span className={cn("size-2.5 shrink-0 rounded-full", s.dot)} aria-hidden />
                  <span className="text-[14px] text-foyer-ink">
                    {s.value}% {s.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* CO2 */}
        <div className="mt-4 border-t border-foyer-border pt-4">
          <p className="font-serif text-3xl text-foyer-ink">
            ~{co2}&nbsp;kg CO<sub>2</sub>
          </p>
          <p className="mt-0.5 text-[13px] text-foyer-muted">
            évités par rapport à un projet tout-neuf équivalent
          </p>
        </div>
      </div>

      {/* Budget */}
      <div className="rounded-2xl border border-foyer-border bg-white px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-foyer-muted">
          Budget estimé
        </p>
        <p className="mt-1 font-serif text-2xl text-foyer-ink">
          ~{Math.round(budget)}&nbsp;€
        </p>
        <p className="mt-0.5 text-[12px] text-foyer-muted">
          Catalogue indicatif — les prix seconde main varient.
        </p>
      </div>

      {/* Détail */}
      <div className="rounded-2xl border border-foyer-border bg-white px-5 py-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-foyer-muted">
          Détail impact
        </p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="font-serif text-2xl text-foyer-ink">{kept}</p>
            <p className="text-[12px] text-foyer-muted">éléments conservés</p>
          </div>
          <div>
            <p className="font-serif text-2xl text-foyer-ink">{secondhand}</p>
            <p className="text-[12px] text-foyer-muted">seconde main</p>
          </div>
          <div>
            <p className="font-serif text-2xl text-foyer-ink">{ecoNew}</p>
            <p className="text-[12px] text-foyer-muted">neuf responsable</p>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-center text-foyer-muted leading-relaxed">
        Base ADEME : 30 kg CO₂ / meuble conservé · 20 kg / occasion · 5 kg / neuf éco.
        Calcul indicatif.
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
type Props = {
  projectId: string;
  afterUrl: string;
  shoppingList: ShoppingItem[];
  scoreFoyer?: ScoreFoyer;
  visionOutput?: unknown;
  alterations?: unknown;
};

export function FinalScreen({
  projectId,
  afterUrl,
  shoppingList,
  scoreFoyer,
  visionOutput,
  alterations,
}: Props) {
  const [tab, setTab] = useState<Tab>("Mes meubles");

  const detectedElements = ((visionOutput as { detectedElements?: DetectedElement[] } | null)
    ?.detectedElements ?? []) as DetectedElement[];

  const alterationsList = ((alterations as { alterations?: Alteration[] } | null)
    ?.alterations ?? []) as Alteration[];

  return (
    <div className="flex flex-1 flex-col">
      <ProgressBar currentStep={5} labels={STEPS} />

      <main className="mx-auto w-full max-w-[480px] flex-1 px-5 pb-24 pt-6">
        {/* Final render */}
        <div className="relative overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={afterUrl} alt="Votre projet" className="w-full object-cover" />
          <span className="absolute left-3 top-3 rounded-full border border-foyer-border bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-foyer-ink">
            Votre projet
          </span>
        </div>

        {/* Tabs */}
        <div className="mt-5 flex gap-1.5 overflow-x-auto pb-0.5">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors",
                tab === t
                  ? "bg-foyer-ink text-foyer-cream"
                  : "border border-foyer-border text-foyer-muted hover:text-foyer-ink",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "Mes meubles" && (
          <MesMeublesTab
            detectedElements={detectedElements}
            alterations={alterationsList}
          />
        )}

        {tab === "Liste shopping" && (
          <ListeShoppingTab
            shoppingList={shoppingList}
            alterations={alterationsList}
          />
        )}

        {tab === "Score Foyer" && (
          <ScoreFoyerTab
            score={scoreFoyer}
            shoppingList={shoppingList}
          />
        )}

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href={`/create/${projectId}/iterate`}
            className="flex h-[52px] w-full items-center justify-center rounded-full border border-foyer-border font-medium text-foyer-ink transition-colors hover:bg-foyer-border/30"
          >
            Affiner encore
          </Link>
          <Link
            href="/create"
            className="flex h-[52px] w-full items-center justify-center rounded-full bg-foyer-sage font-medium text-white shadow-[0_2px_8px_rgba(107,142,111,0.35)] transition-all hover:-translate-y-0.5"
          >
            Recommencer un projet
          </Link>
        </div>
      </main>
    </div>
  );
}
