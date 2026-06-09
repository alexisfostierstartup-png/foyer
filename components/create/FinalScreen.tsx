"use client";

import Link from "next/link";
import { useState } from "react";
import { ProgressBar } from "@/components/create/ProgressBar";
import { BeforeAfterSlider } from "@/components/create/BeforeAfterSlider";
import { cn } from "@/lib/utils";
import type { DetectedFurniture } from "@/lib/types";

const STEPS = ["Photo", "Style", "Mobilier", "Rendu", "Projet"];

type Tab = "furniture" | "cart" | "score";

function ScoreBadge({
  kept,
  customized,
  replaced,
}: {
  kept: number;
  customized: number;
  replaced: number;
}) {
  const total = kept + customized + replaced || 1;
  const kDeg = (kept / total) * 360;
  const cDeg = (customized / total) * 360;
  const bg = `conic-gradient(
    #6b8e6f 0deg ${kDeg}deg,
    #c89b6a ${kDeg}deg ${kDeg + cDeg}deg,
    #1f1b16 ${kDeg + cDeg}deg 360deg
  )`;
  const co2 = Math.round(kept * 3.5 + customized * 1.2);

  return (
    <div className="flex items-center gap-5 py-2">
      <div className="relative h-24 w-24 shrink-0 rounded-full" style={{ background: bg }}>
        <div
          className="absolute grid place-items-center rounded-full bg-white text-center"
          style={{ inset: 8 }}
        >
          <div>
            <p className="font-serif text-lg leading-none text-foyer-ink">
              {kept}
              <span className="text-xs">/{customized}/{replaced}</span>
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-foyer-muted">
              Score
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-1.5 text-sm">
        <p className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-foyer-sage" />
          {kept} conservé{kept > 1 ? "s" : ""}
        </p>
        <p className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-foyer-ochre" />
          {customized} customisé{customized > 1 ? "s" : ""}
        </p>
        <p className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-foyer-ink" />
          {replaced} remplacé{replaced > 1 ? "s" : ""}
        </p>
        <p className="pt-1 font-serif text-lg text-foyer-ink">
          ~{co2} kg CO₂{" "}
          <span className="text-xs font-sans text-foyer-muted">évités</span>
        </p>
      </div>
    </div>
  );
}

type Props = {
  projectId: string;
  beforeUrl: string;
  afterUrl: string;
  furniture: DetectedFurniture[];
};

export function FinalScreen({ projectId, beforeUrl, afterUrl, furniture }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("furniture");

  const kept = furniture.filter((f) => f.decision === "keep").length;
  const customized = furniture.filter((f) => f.decision === "customize").length;
  const replaced = furniture.filter((f) => f.decision === "replace").length;

  const TABS: { id: Tab; label: string }[] = [
    { id: "furniture", label: "Mes meubles" },
    { id: "cart", label: "Liste shopping" },
    { id: "score", label: "Score Foyer" },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <ProgressBar currentStep={5} labels={STEPS} />

      <main className="flex-1 overflow-y-auto pb-12">
        <div className="px-5 py-4">
          <h1 className="font-serif text-2xl text-foyer-ink">Voici votre projet.</h1>
          <p className="mt-1 text-sm text-foyer-muted">
            Glissez le curseur pour comparer avec l&apos;original.
          </p>
        </div>

        {/* Slider */}
        <div className="px-5">
          <div className="mx-auto max-w-3xl">
            <BeforeAfterSlider before={beforeUrl} after={afterUrl} />
          </div>
        </div>

        {/* Tabs card */}
        <div className="mx-auto mt-5 max-w-3xl px-5">
          <div className="overflow-hidden rounded-3xl border border-foyer-border bg-white">
            {/* Tab nav */}
            <div className="grid grid-cols-3 border-b border-foyer-border text-sm">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "py-3 font-medium transition-colors",
                    activeTab === tab.id
                      ? "text-foyer-ink border-b-2 border-foyer-ink -mb-px"
                      : "text-foyer-muted hover:text-foyer-ink",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-5">
              {activeTab === "furniture" && (
                <div className="space-y-2">
                  {[
                    { label: "Conservés", items: furniture.filter((f) => f.decision === "keep"), color: "bg-foyer-sage" },
                    { label: "À customiser", items: furniture.filter((f) => f.decision === "customize"), color: "bg-foyer-ochre" },
                    { label: "À remplacer", items: furniture.filter((f) => f.decision === "replace"), color: "bg-foyer-ink" },
                  ].map(({ label, items, color }) =>
                    items.length > 0 ? (
                      <div key={label} className="mb-4 last:mb-0">
                        <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-foyer-muted">
                          <span className={`h-2 w-2 rounded-full ${color}`} />
                          {label}
                        </p>
                        <ul className="space-y-1 text-sm">
                          {items.map((f) => (
                            <li key={f.id} className="text-foyer-ink/80">
                              • {f.description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null,
                  )}
                  {furniture.length === 0 && (
                    <p className="text-sm text-foyer-muted italic">Aucun meuble détecté.</p>
                  )}
                </div>
              )}

              {activeTab === "cart" && (
                <div className="py-6 text-center">
                  <p className="font-serif text-lg text-foyer-ink">
                    Liste de courses en cours de préparation…
                  </p>
                  <p className="mt-2 text-sm text-foyer-muted">
                    La sélection de produits sera disponible prochainement.
                  </p>
                </div>
              )}

              {activeTab === "score" && (
                <ScoreBadge kept={kept} customized={customized} replaced={replaced} />
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mx-auto mt-6 max-w-3xl px-5 space-y-3">
          <Link
            href={`/create/${projectId}/iterate`}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full border border-foyer-border font-medium text-foyer-ink hover:bg-foyer-border/30 transition-colors"
          >
            Affiner encore
          </Link>
          <Link
            href="/"
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-foyer-sage text-white font-medium shadow-[0_2px_8px_rgba(107,142,111,0.35)] hover:-translate-y-0.5 transition-all"
          >
            Terminer
          </Link>
        </div>
      </main>
    </div>
  );
}
