"use client";

import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

// PAIEMENT FICTIF (Wizard-of-Oz) : aucun débit, aucun formulaire de carte — on ne
// collecte jamais de moyen de paiement ici. Le clic sur un pack simule l'achat, crédite
// le projet côté navigateur (voir lib/credits.ts) et rend la main à l'itération.
// Le vrai tunnel Stripe vit dans components/paywalls/PaywallModal.tsx.
export type Pack = { credits: number; price: string; label: string; badge?: string };

const PACKS: Pack[] = [
  { credits: 3, price: "5 €", label: "3 modifications" },
  { credits: 10, price: "15 €", label: "10 modifications", badge: "Le plus choisi" },
  { credits: 25, price: "30 €", label: "25 modifications" },
];

export function CreditsDialog({
  onClose,
  onAchat,
}: {
  onClose: () => void;
  /** Achat simulé confirmé → nombre de crédits ajoutés. */
  onAchat: (credits: number) => void;
}) {
  const [enCours, setEnCours] = useState<number | null>(null);

  async function acheter(pack: Pack) {
    setEnCours(pack.credits);
    // Latence simulée : sans elle l'achat paraît ne rien faire.
    await new Promise((r) => setTimeout(r, 900));
    onAchat(pack.credits);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-foyer-ink/30 backdrop-blur-sm"
        onClick={enCours === null ? onClose : undefined}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Crédits épuisés"
        className="relative z-10 w-full max-w-[480px] rounded-t-3xl bg-foyer-cream p-6 shadow-2xl sm:rounded-3xl sm:p-7"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="font-serif text-[20px] font-medium text-foyer-ink">
              Vous n&apos;avez plus de crédit
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-foyer-muted">
              L&apos;offre gratuite comprend une seule modification, et vous l&apos;avez
              utilisée. Pour continuer à retoucher votre rendu, ajoutez des crédits. Sans
              abonnement, sans engagement.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={enCours !== null}
            className="ml-3 shrink-0 rounded-full p-1.5 text-foyer-muted transition-colors hover:bg-foyer-border hover:text-foyer-ink"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {PACKS.map((pack) => (
            <button
              key={pack.credits}
              type="button"
              onClick={() => acheter(pack)}
              disabled={enCours !== null}
              className={cn(
                "relative flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all",
                pack.badge
                  ? "border-foyer-sage bg-foyer-sage/8 ring-1 ring-foyer-sage"
                  : "border-foyer-border bg-white hover:border-foyer-sage/50",
                enCours !== null && "cursor-not-allowed opacity-60",
              )}
            >
              {pack.badge && (
                <span className="absolute -top-2.5 left-4 rounded-full bg-foyer-sage px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  {pack.badge}
                </span>
              )}
              <div>
                <p className="text-[15px] font-semibold text-foyer-ink">{pack.label}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-foyer-muted">
                  <Check className="size-3.5 text-foyer-sage" strokeWidth={2.5} />
                  Crédits valables sur tous vos projets
                </p>
              </div>
              <span className="ml-3 shrink-0 text-[16px] font-bold text-foyer-ink">
                {enCours === pack.credits ? (
                  <Loader2 className="size-5 animate-spin text-foyer-sage" aria-hidden />
                ) : (
                  pack.price
                )}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={enCours !== null}
            className="text-[12px] text-foyer-muted transition-colors hover:text-foyer-ink"
          >
            Non merci, voir ma liste de courses
          </button>
        </div>
      </div>
    </div>
  );
}
