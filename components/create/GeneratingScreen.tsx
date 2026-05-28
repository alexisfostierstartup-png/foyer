"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/create/ProgressBar";

const STEPS = ["Photo", "Style", "Mobilier", "Rendu", "Projet"];

const MESSAGES = [
  "On analyse votre pièce…",
  "On identifie le mobilier déjà en place…",
  "On applique l'ambiance choisie…",
  "On finalise le rendu…",
];

export function GeneratingScreen({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [messageIndex, setMessageIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const startedRef = useRef(false);

  const startGeneration = useCallback(async () => {
    setFailed(false);
    try {
      const res = await fetch(`/api/projects/${projectId}/generate`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        toast.error(data?.error ?? "La génération a échoué. Réessayez.");
        setFailed(true);
        return;
      }
      router.push(`/create/${projectId}`);
    } catch {
      toast.error("La génération a échoué. Réessayez.");
      setFailed(true);
    }
  }, [projectId, router]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => Math.min(i + 1, MESSAGES.length - 1));
    }, 5000);

    // React 18/19 StrictMode mounts effects twice in dev; guard the POST.
    if (!startedRef.current) {
      startedRef.current = true;
      startGeneration();
    }

    return () => clearInterval(interval);
  }, [startGeneration]);

  return (
    <div className="flex flex-1 flex-col">
      <ProgressBar currentStep={3} labels={STEPS} />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-8">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-foyer-border bg-foyer-border/40">
          {!failed && (
            <div className="absolute inset-0 animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          )}
        </div>

        <div className="mt-8 flex flex-1 flex-col items-center text-center">
          {failed ? (
            <>
              <p className="text-foyer-ink">
                Le rendu n&apos;a pas pu être généré.
              </p>
              <Button
                type="button"
                size="lg"
                onClick={startGeneration}
                className="mt-4 h-12 w-full max-w-xs bg-foyer-terra-deep text-white hover:bg-foyer-terra-deep/90"
              >
                Réessayer
              </Button>
            </>
          ) : (
            <>
              <p className="font-serif text-xl text-foyer-ink transition-opacity duration-300">
                {MESSAGES[messageIndex]}
              </p>
              <p className="mt-3 text-sm text-foyer-muted">
                La génération peut prendre 15 à 30 secondes.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
