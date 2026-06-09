"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Share2, Loader2 } from "lucide-react";
import { ProgressBar } from "@/components/create/ProgressBar";
import { BeforeAfterSlider } from "@/components/create/BeforeAfterSlider";
import { cn } from "@/lib/utils";
import type { DetectedFurniture, FurnitureDecision } from "@/lib/types";

const STEPS = ["Photo", "Style", "Mobilier", "Rendu", "Projet"];

type Tab = "furniture" | "cart" | "score";

const DECISION_OPTIONS: {
  id: FurnitureDecision;
  label: string;
  activeClass: string;
}[] = [
  { id: "keep", label: "Garder", activeClass: "bg-foyer-sage text-white" },
  { id: "customize", label: "Customiser", activeClass: "bg-foyer-ochre text-white" },
  { id: "replace", label: "Remplacer", activeClass: "bg-foyer-ink text-white" },
];

function FurnitureRow({
  item,
  decision,
  onChange,
}: {
  item: DetectedFurniture;
  decision: FurnitureDecision;
  onChange: (d: FurnitureDecision) => void;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-foyer-border py-3 last:border-0">
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foyer-border text-foyer-muted">
        <span className="text-xs font-medium">
          {item.type.slice(0, 2).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foyer-ink truncate">
          {item.description}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DECISION_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                decision === opt.id
                  ? opt.activeClass + " border-transparent"
                  : "border-foyer-border text-foyer-muted hover:border-foyer-ink hover:text-foyer-ink",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScorePlaceholder() {
  return (
    <div className="py-4 text-center">
      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 border-foyer-border">
        <div className="text-center">
          <p className="font-serif text-lg leading-none text-foyer-ink">—</p>
          <p className="text-[10px] uppercase tracking-wide text-foyer-muted">Score</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-foyer-muted">
        Le Score Foyer sera calculé une fois votre projet finalisé.
      </p>
    </div>
  );
}

type Props = {
  projectId: string;
  beforeUrl: string;
  afterUrl: string;
  furniture: DetectedFurniture[];
};

export function RenderScreen({ projectId, beforeUrl, afterUrl, furniture }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("furniture");
  const [decisions, setDecisions] = useState<Record<string, FurnitureDecision>>(
    () => Object.fromEntries(furniture.map((f) => [f.id, f.decision])),
  );
  const [isPending, startTransition] = useTransition();

  function updateDecision(id: string, d: FurnitureDecision) {
    setDecisions((prev) => ({ ...prev, [id]: d }));
  }

  async function saveFurnitureAndNavigate(destination: string) {
    startTransition(async () => {
      try {
        const updatedFurniture = furniture.map((f) => ({
          ...f,
          decision: decisions[f.id] ?? f.decision,
        }));
        await fetch(`/api/projects/${projectId}/furniture`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ furniture: updatedFurniture }),
        });
      } catch {
        // non-blocking — decisions saved best-effort
        toast.error("Les décisions n'ont pas pu être sauvegardées.");
      }
      router.push(destination);
    });
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "furniture", label: "Vos meubles" },
    { id: "cart", label: "Ce qu'on commande" },
    { id: "score", label: "Score Foyer" },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <ProgressBar currentStep={4} labels={STEPS} />

      {/* Actions bar */}
      <div className="flex items-center justify-between px-5 py-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-foyer-muted hover:text-foyer-ink"
        >
          ← Retour
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Itérer"
            onClick={() => saveFurnitureAndNavigate(`/create/${projectId}/iterate`)}
            className="grid h-9 w-9 place-items-center rounded-full text-foyer-muted hover:bg-foyer-border hover:text-foyer-ink"
          >
            <RefreshCw size={16} />
          </button>
          <button
            type="button"
            aria-label="Partager"
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              toast.success("Lien copié !");
            }}
            className="grid h-9 w-9 place-items-center rounded-full text-foyer-muted hover:bg-foyer-border hover:text-foyer-ink"
          >
            <Share2 size={16} />
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto pb-28">
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

            {/* Tab content */}
            <div className="p-5">
              {activeTab === "furniture" && (
                <div>
                  <p className="mb-3 text-xs text-foyer-muted">
                    Par défaut, on conserve tout. Marquez ce que vous voulez changer.
                  </p>
                  {furniture.length === 0 ? (
                    <p className="text-sm text-foyer-muted italic">
                      Aucun meuble détecté sur cette photo.
                    </p>
                  ) : (
                    furniture.map((item) => (
                      <FurnitureRow
                        key={item.id}
                        item={item}
                        decision={decisions[item.id] ?? item.decision}
                        onChange={(d) => updateDecision(item.id, d)}
                      />
                    ))
                  )}
                </div>
              )}

              {activeTab === "cart" && (
                <div className="py-4 text-center">
                  <p className="text-sm text-foyer-muted">
                    La liste de courses sera générée après l&apos;itération finale.
                  </p>
                </div>
              )}

              {activeTab === "score" && <ScorePlaceholder />}
            </div>
          </div>
        </div>
      </main>

      {/* Sticky footer */}
      <div className="fixed bottom-0 inset-x-0 border-t border-foyer-border bg-foyer-cream/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            disabled={isPending}
            onClick={() => saveFurnitureAndNavigate(`/create/${projectId}/iterate`)}
            className={cn(
              "flex h-[52px] w-full items-center justify-center gap-2 rounded-full font-medium transition-all",
              isPending
                ? "bg-foyer-border text-foyer-muted"
                : "bg-foyer-sage text-white shadow-[0_2px_8px_rgba(107,142,111,0.35)] hover:-translate-y-0.5",
            )}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Un instant…
              </>
            ) : (
              "Affiner le rendu"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
