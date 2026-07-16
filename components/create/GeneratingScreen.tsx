"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/create/ProgressBar";
import { PaywallModal } from "@/components/paywalls/PaywallModal";
import { PAYWALL_DISABLED } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { PaywallTrigger } from "@/components/paywalls/PaywallModal";

const STEPS = ["Photo", "Style", "Mobilier", "Rendu", "Projet"];

const MESSAGES = [
  "On analyse votre pièce…",
  "On identifie le mobilier déjà en place…",
  "On applique l'ambiance choisie…",
  "On finalise le rendu…",
];

export function GeneratingScreen({
  projectId,
  expert = false,
  hasDecisions = false,
}: {
  projectId: string;
  // Parcours expert court : pas d'écran review — l'analyse puis le rendu expert
  // s'enchaînent ici automatiquement → atterrissage direct sur /final.
  expert?: boolean;
  hasDecisions?: boolean;
}) {
  const router = useRouter();
  const [messageIndex, setMessageIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [paywallTrigger, setPaywallTrigger] = useState<PaywallTrigger | null>(null);
  const startedRef = useRef(false);

  const startGeneration = useCallback(async () => {
    setFailed(false);
    setPaywallTrigger(null);
    try {
      // Personne n'est passé par la review (parcours expert, ou review fermée en
      // production) : l'analyse par élément n'a jamais tourné. On la joue ici — sans
      // elle le plan de design est vide et le rendu ignore garder/personnaliser/remplacer.
      if (!hasDecisions) {
        const a = await fetch(`/api/projects/${projectId}/analyze`, { method: "POST" });
        if (!a.ok) {
          toast.error("L'analyse de la pièce a échoué. Réessayez.");
          setFailed(true);
          return;
        }
      }
      const res = await fetch(`/api/projects/${projectId}/generate`, {
        method: "POST",
      });
      if (res.status === 402) {
        const data = (await res.json().catch(() => null)) as
          | { paywall?: PaywallTrigger }
          | null;
        setPaywallTrigger(data?.paywall ?? "second_project");
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        toast.error(data?.error ?? "La génération a échoué. Réessayez.");
        setFailed(true);
        return;
      }
      if (expert) {
        // Rendu expert (liste de courses + swap produits réels côté route) → /final direct.
        const er = await fetch(`/api/projects/${projectId}/expert-render`, { method: "POST" });
        if (!er.ok) {
          const data = (await er.json().catch(() => null)) as { error?: string } | null;
          toast.error(data?.error ?? "Le rendu expert a échoué. Réessayez.");
          setFailed(true);
          return;
        }
        router.push(`/create/${projectId}/final`);
        return;
      }
      router.push(`/create/${projectId}`);
    } catch {
      toast.error("La génération a échoué. Réessayez.");
      setFailed(true);
    }
  }, [projectId, router, expert, hasDecisions]);

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
    <>
    {!PAYWALL_DISABLED && paywallTrigger && (
      <PaywallModal
        trigger={paywallTrigger}
        onClose={() => { setPaywallTrigger(null); setFailed(true); }}
      />
    )}
    <div className="flex flex-1 flex-col">
      <ProgressBar currentStep={3} labels={STEPS} />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-8">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-foyer-border bg-foyer-border/40">
          {!failed && (
            <div className="absolute inset-0 animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          )}
        </div>

        {/* EXPERT : le rendu réaliste (fake + incrustation des vrais produits) prend
            40-60 s — sans explication, cette attente ressemble à une page cassée
            (demande Alexis 2026-07-16). Le bandeau vit avec l'écran de chargement et
            disparaît avec lui (navigation vers /final à la fin, ou état failed). */}
        {expert && !failed && (
          <div className="mt-4 rounded-xl border border-foyer-sage/30 bg-foyer-sage/10 px-4 py-3 text-center">
            <p className="text-[14px] font-medium text-foyer-ink">
              Votre rendu expert est en préparation — comptez 40 à 60 secondes.
            </p>
            <p className="mt-0.5 text-[13px] text-foyer-muted">
              Nous composons votre pièce avec de vrais meubles du catalogue, à leur taille et à leur place réelles.
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-1 flex-col items-center">
          {failed ? (
            <>
              <p className="text-foyer-ink">
                Le rendu n&apos;a pas pu être généré.
              </p>
              <Button
                type="button"
                size="lg"
                onClick={startGeneration}
                className="mt-4 h-12 w-full max-w-xs bg-foyer-ink text-white hover:bg-foyer-ink/90"
              >
                Réessayer
              </Button>
            </>
          ) : (
            <ul className="flex w-full max-w-xs flex-col gap-3">
              {MESSAGES.map((m, idx) => {
                const state =
                  idx < messageIndex
                    ? "done"
                    : idx === messageIndex
                      ? "current"
                      : "todo";
                return (
                  <li key={m} className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border",
                        state === "done" &&
                          "border-foyer-sage bg-foyer-sage text-white",
                        state === "current" &&
                          "border-foyer-sage text-foyer-sage",
                        state === "todo" &&
                          "border-foyer-border text-foyer-border",
                      )}
                    >
                      {state === "done" && (
                        <Check className="size-3" aria-hidden />
                      )}
                      {state === "current" && (
                        <Loader2 className="size-3 animate-spin" aria-hidden />
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-[15px]",
                        state === "todo"
                          ? "text-foyer-muted/60"
                          : "text-foyer-ink",
                        state === "current" && "font-medium",
                      )}
                    >
                      {m}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
    </>
  );
}
