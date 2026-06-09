"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ProgressBar } from "@/components/create/ProgressBar";
import { StyleCard } from "@/components/create/StyleCard";
import { cn } from "@/lib/utils";
import type { RoomType, Style } from "@/lib/types";

const STEPS = ["Photo", "Style", "Mobilier", "Rendu", "Projet"];

type StyleSelectorProps = {
  projectId: string;
  roomType: RoomType;
  basePhotoUrl: string;
  styles: Style[];
};

export function StyleSelector({
  projectId,
  roomType,
  basePhotoUrl,
  styles,
}: StyleSelectorProps) {
  const router = useRouter();
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!selectedStyleId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/style`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleId: selectedStyleId }),
      });
      if (!res.ok) {
        toast.error("Erreur lors de l'enregistrement de l'ambiance");
        setSubmitting(false);
        return;
      }
      router.push(`/create/generating?projectId=${projectId}`);
    } catch {
      toast.error("Erreur lors de l'enregistrement de l'ambiance");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <ProgressBar currentStep={2} labels={STEPS} />

      <main className="mx-auto w-full max-w-[480px] flex-1 px-5 pb-28 pt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foyer-sage">
          Style
        </p>
        <h1 className="mt-1 font-serif text-[26px] font-medium leading-tight text-foyer-ink">
          Quelle ambiance ?
        </h1>

        <div className="mt-4 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={basePhotoUrl}
            alt={`Votre ${roomType}`}
            className="size-16 shrink-0 rounded-xl object-cover"
          />
          <span className="text-sm text-foyer-muted">Votre {roomType}</span>
        </div>

        <div
          role="radiogroup"
          aria-label="Ambiances"
          className="mt-6 grid grid-cols-2 gap-3 duration-200 animate-in fade-in"
        >
          {styles.map((style) => (
            <StyleCard
              key={style.id}
              style={style}
              selected={selectedStyleId === style.id}
              onSelect={() => setSelectedStyleId(style.id)}
            />
          ))}
        </div>
      </main>

      <div className="sticky bottom-0 border-t border-foyer-border bg-foyer-cream/95 px-5 py-3 backdrop-blur">
        <button
          type="button"
          disabled={!selectedStyleId || submitting}
          onClick={handleSubmit}
          className={cn(
            "flex h-[52px] w-full items-center justify-center gap-2 rounded-full font-medium transition-all",
            !selectedStyleId || submitting
              ? "cursor-not-allowed bg-foyer-border text-foyer-muted"
              : "bg-foyer-sage text-white shadow-[0_2px_8px_rgba(107,142,111,0.35)] hover:-translate-y-0.5 hover:bg-foyer-sage/90 hover:shadow-[0_4px_14px_rgba(107,142,111,0.45)]",
          )}
        >
          {submitting ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden />
              Patientez…
            </>
          ) : (
            "Générer le rendu"
          )}
        </button>
      </div>
    </div>
  );
}
