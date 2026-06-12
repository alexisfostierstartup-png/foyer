"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Check, Star, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CheckoutType } from "@/app/api/billing/create-checkout-session/route";

export type PaywallTrigger = "save_project" | "second_project" | "live_edit" | "product_url";

interface PaywallModalProps {
  trigger: PaywallTrigger;
  onClose: () => void;
  onSuccess?: () => void;
}

const TRIGGER_COPY: Record<
  PaywallTrigger,
  { title: string; subtitle: string; showCredits: boolean }
> = {
  save_project: {
    title: "Sauvegardez votre projet",
    subtitle: "Pour retrouver votre rendu à tout moment, passez Expert ou achetez des crédits.",
    showCredits: true,
  },
  second_project: {
    title: "Continuez à créer",
    subtitle: "Votre premier rendu gratuit est épuisé. Achetez des crédits ou passez Expert illimité.",
    showCredits: true,
  },
  live_edit: {
    title: "Édition live — plan Expert",
    subtitle: "Changez n'importe quel meuble en un clic. Disponible avec l'abonnement Expert.",
    showCredits: false,
  },
  product_url: {
    title: "URL produit personnalisée",
    subtitle: "Intégrez directement un produit de votre choix. Disponible avec l'abonnement Expert.",
    showCredits: false,
  },
};

const CREDIT_PACKS: {
  type: CheckoutType;
  label: string;
  price: string;
  credits: string;
  badge?: string;
}[] = [
  { type: "credits_starter", label: "Découverte", price: "4,99€", credits: "3 crédits" },
  {
    type: "credits_standard",
    label: "Standard",
    price: "14,99€",
    credits: "15 crédits",
    badge: "Le plus choisi",
  },
  { type: "credits_volume", label: "Volume", price: "29,99€", credits: "40 crédits" },
];

function PlanCard({
  title,
  price,
  subtitle,
  badge,
  highlighted,
  loading,
  onClick,
  features,
}: {
  title: string;
  price: string;
  subtitle: string;
  badge?: string;
  highlighted?: boolean;
  loading?: boolean;
  onClick: () => void;
  features?: string[];
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "relative w-full rounded-2xl border p-4 text-left transition-all",
        highlighted
          ? "border-foyer-sage bg-foyer-sage/8 ring-1 ring-foyer-sage"
          : "border-foyer-border bg-white hover:border-foyer-sage/50",
        loading && "opacity-60 cursor-not-allowed",
      )}
    >
      {badge && (
        <span className="absolute -top-2.5 left-4 rounded-full bg-foyer-sage px-2.5 py-0.5 text-[11px] font-semibold text-white">
          {badge}
        </span>
      )}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[15px] font-semibold text-foyer-ink">{title}</p>
          <p className="mt-0.5 text-[13px] text-foyer-muted">{subtitle}</p>
        </div>
        <div className="ml-3 shrink-0 text-right">
          <p className="text-[16px] font-bold text-foyer-ink">{price}</p>
        </div>
      </div>
      {features && (
        <ul className="mt-3 space-y-1.5">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-[12px] text-foyer-ink">
              <Check className="size-3.5 shrink-0 text-foyer-sage" strokeWidth={2.5} />
              {f}
            </li>
          ))}
        </ul>
      )}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl">
          <Loader2 className="size-5 animate-spin text-foyer-sage" />
        </div>
      )}
    </button>
  );
}

export function PaywallModal({ trigger, onClose, onSuccess }: PaywallModalProps) {
  const router = useRouter();
  const [loadingType, setLoadingType] = useState<CheckoutType | null>(null);
  const copy = TRIGGER_COPY[trigger];

  async function handleCheckout(type: CheckoutType) {
    setLoadingType(type);
    try {
      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          successUrl: `${window.location.origin}/billing/success`,
          cancelUrl: window.location.href,
        }),
      });
      if (res.status === 401) {
        router.push("/auth?tab=signup");
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoadingType(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foyer-ink/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div className="relative z-10 w-full max-w-[480px] rounded-t-3xl bg-foyer-cream p-6 shadow-2xl sm:rounded-3xl sm:p-7">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="font-serif text-[20px] font-medium text-foyer-ink">{copy.title}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-foyer-muted">{copy.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 shrink-0 rounded-full p-1.5 text-foyer-muted transition-colors hover:bg-foyer-border hover:text-foyer-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className={cn("flex flex-col gap-3", copy.showCredits ? "" : "")}>
          {/* Expert subscription — always shown */}
          <PlanCard
            title="Foyer Expert"
            price="15€/mois"
            subtitle="Sans engagement"
            badge={copy.showCredits ? undefined : "Recommandé"}
            highlighted={!copy.showCredits}
            loading={loadingType === "expert_monthly"}
            onClick={() => handleCheckout("expert_monthly")}
            features={[
              "Générations illimitées",
              "Sauvegarde de tous vos projets",
              "Édition live",
              "URL produit personnalisée",
            ]}
          />

          {/* Credit packs — only for save/second_project */}
          {copy.showCredits && (
            <>
              <div className="relative flex items-center gap-3">
                <div className="h-px flex-1 bg-foyer-border" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-foyer-muted">
                  ou achetez des crédits
                </span>
                <div className="h-px flex-1 bg-foyer-border" />
              </div>

              {CREDIT_PACKS.map((pack) => (
                <PlanCard
                  key={pack.type}
                  title={pack.label}
                  price={pack.price}
                  subtitle={pack.credits}
                  badge={pack.badge}
                  highlighted={pack.badge === "Le plus choisi"}
                  loading={loadingType === pack.type}
                  onClick={() => handleCheckout(pack.type)}
                />
              ))}
            </>
          )}
        </div>

        {/* Footer links */}
        <div className="mt-5 flex items-center justify-between">
          <a
            href="/features"
            className="text-[12px] text-foyer-muted underline-offset-2 hover:text-foyer-ink hover:underline"
          >
            Voir toutes les features Expert →
          </a>
          <button
            type="button"
            onClick={onClose}
            className="text-[12px] text-foyer-muted transition-colors hover:text-foyer-ink"
          >
            Continuer sans
          </button>
        </div>
      </div>
    </div>
  );
}
