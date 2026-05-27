"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/create/ProgressBar";
import { StyleCard } from "@/components/create/StyleCard";
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

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-28 pt-8">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={basePhotoUrl}
            alt={`Votre ${roomType}`}
            className="size-20 shrink-0 rounded-2xl object-cover"
          />
          <span className="text-sm text-foyer-muted">Votre {roomType}</span>
        </div>

        <h1 className="mt-6 font-serif text-3xl leading-tight text-foyer-ink">
          Quelle ambiance pour cette pièce&nbsp;?
        </h1>
        <p className="mt-3 text-foyer-muted">
          Choisissez l&apos;ambiance qui vous parle. On affinera ensuite.
        </p>

        <div
          role="radiogroup"
          aria-label="Ambiances"
          className="mt-8 grid grid-cols-2 gap-4 duration-200 animate-in fade-in md:grid-cols-3"
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

      <div className="sticky bottom-0 border-t border-foyer-border bg-foyer-cream/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <Button
            type="button"
            size="lg"
            disabled={!selectedStyleId || submitting}
            onClick={handleSubmit}
            className="h-12 w-full bg-foyer-terra-deep text-white hover:bg-foyer-terra-deep/90 disabled:bg-foyer-border disabled:text-foyer-muted disabled:opacity-100"
          >
            {submitting ? (
              <>
                <Loader2 className="size-5 animate-spin" aria-hidden />
                Patientez…
              </>
            ) : (
              "Générer le rendu"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
