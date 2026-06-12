import { redirect } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { creditUser, activateExpertPlan } from "@/lib/auth/actions";

const CREDIT_AMOUNTS: Record<string, number> = {
  credits_starter: 3,
  credits_standard: 15,
  credits_volume: 40,
};

const LABELS: Record<string, string> = {
  credits_starter: "3 crédits Découverte",
  credits_standard: "15 crédits Standard",
  credits_volume: "40 crédits Volume",
  expert_monthly: "Abonnement Expert",
};

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; user_id?: string; session_id?: string }>;
}) {
  const { type, user_id } = await searchParams;

  if (!type || !user_id) redirect("/");

  // Apply the purchase server-side
  if (type === "expert_monthly") {
    await activateExpertPlan(user_id);
  } else if (CREDIT_AMOUNTS[type]) {
    await creditUser(user_id, CREDIT_AMOUNTS[type], `purchase:${type}`);
  }

  const label = LABELS[type] ?? type;
  const isExpert = type === "expert_monthly";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-foyer-cream px-6 py-12">
      <div className="w-full max-w-[420px] rounded-3xl bg-white p-8 shadow-[0_20px_60px_rgba(31,27,22,0.08)] ring-1 ring-foyer-border/50 text-center md:p-10">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-foyer-sage/15">
          <Check className="size-7 text-foyer-sage" strokeWidth={2.5} />
        </div>

        <h1 className="font-serif text-[24px] text-foyer-ink">
          {isExpert ? "Bienvenue, Expert !" : "Crédits ajoutés !"}
        </h1>

        <p className="mt-2 text-[14px] text-foyer-muted">
          {isExpert
            ? "Votre plan Expert est maintenant actif. Toutes les fonctionnalités sont débloquées."
            : `${label} ont été ajoutés à votre compte.`}
        </p>

        {isExpert && (
          <ul className="mt-5 space-y-2 text-left">
            {[
              "Sauvegarde illimitée de projets",
              "Édition live — changez n'importe quel meuble",
              "URL produit personnalisée",
              "Générations illimitées",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2 text-[13px] text-foyer-ink">
                <Check className="size-4 shrink-0 text-foyer-sage" strokeWidth={2.5} />
                {f}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-7 flex flex-col gap-3">
          <Link
            href="/create"
            className="flex h-[48px] items-center justify-center rounded-full bg-foyer-sage font-medium text-white shadow-[0_2px_8px_rgba(107,142,111,0.35)] transition-all hover:-translate-y-0.5"
          >
            Lancer un nouveau projet →
          </Link>
          <Link
            href="/account"
            className="flex h-[48px] items-center justify-center rounded-full border border-foyer-border font-medium text-foyer-ink transition-colors hover:bg-foyer-border/30"
          >
            Mon compte
          </Link>
        </div>
      </div>
    </div>
  );
}
