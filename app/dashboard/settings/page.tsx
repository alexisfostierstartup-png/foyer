import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getWallet } from "@/lib/auth/actions";

export const dynamic = "force-dynamic";

export default async function UserSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?tab=signin");

  const [profile, wallet] = await Promise.all([
    getProfile(user.id),
    getWallet(user.id),
  ]);

  const plan = profile?.plan ?? "neophyte";
  const isExpert = plan === "expert";

  return (
    <div className="p-6 lg:p-8">
      <h1 className="mb-6 font-serif text-[24px] font-medium text-foyer-ink">Paramètres</h1>

      <div className="mx-auto max-w-lg space-y-4">
        {/* Account */}
        <div className="rounded-2xl border border-foyer-border bg-foyer-cream p-5">
          <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-foyer-muted">Compte</h2>
          <div className="space-y-3 text-[14px]">
            <div className="flex justify-between">
              <span className="text-foyer-muted">Email</span>
              <span className="font-medium text-foyer-ink">{user.email}</span>
            </div>
            {profile?.display_name && (
              <div className="flex justify-between">
                <span className="text-foyer-muted">Nom</span>
                <span className="text-foyer-ink">{profile.display_name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-foyer-muted">Plan</span>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                isExpert ? "bg-foyer-ochre/80 text-white" : "bg-foyer-border text-foyer-muted"
              }`}>
                {isExpert ? "Expert" : "Gratuit"}
              </span>
            </div>
          </div>
        </div>

        {/* Credits (neophyte/expert) */}
        {wallet && (
          <div className="rounded-2xl border border-foyer-border bg-foyer-cream p-5">
            <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-foyer-muted">Crédits</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-serif text-[32px] text-foyer-ink">{wallet.balance}</p>
                <p className="text-[12px] text-foyer-muted">crédit{wallet.balance !== 1 ? "s" : ""} restant{wallet.balance !== 1 ? "s" : ""}</p>
              </div>
              {!isExpert && (
                <Link
                  href="/features"
                  className="rounded-full bg-foyer-sage px-4 py-2 text-[13px] font-medium text-white"
                >
                  Acheter des crédits
                </Link>
              )}
            </div>
            {isExpert && (
              <p className="mt-3 text-[12px] text-foyer-muted">
                Plan Expert · générations illimitées incluses
              </p>
            )}
          </div>
        )}

        {/* Upgrade CTA for neophyte */}
        {!isExpert && (
          <div className="rounded-2xl border border-foyer-sage/30 bg-foyer-sage/8 p-5">
            <p className="text-[14px] font-semibold text-foyer-ink">Foyer Expert</p>
            <p className="mt-1 text-[13px] text-foyer-muted">
              Générations illimitées, listes de courses enrichies, édition live et plus.
            </p>
            <Link
              href="/features"
              className="mt-4 inline-flex rounded-full bg-foyer-sage px-5 py-2 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(107,142,111,0.3)]"
            >
              Découvrir Expert →
            </Link>
          </div>
        )}

        {/* Subscription info for expert */}
        {isExpert && profile?.current_period_end && (
          <div className="rounded-2xl border border-foyer-border bg-foyer-cream p-5">
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-foyer-muted">Abonnement</h2>
            <div className="flex justify-between text-[14px]">
              <span className="text-foyer-muted">Renouvellement</span>
              <span className="text-foyer-ink">
                {new Date(profile.current_period_end).toLocaleDateString("fr-FR", {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </span>
            </div>
            <Link
              href="/account"
              className="mt-4 inline-block text-[13px] text-foyer-sage underline underline-offset-2"
            >
              Gérer l'abonnement
            </Link>
          </div>
        )}

        {/* Logout */}
        <div className="rounded-2xl border border-foyer-border bg-foyer-cream p-5">
          <form action="/logout" method="POST">
            <button type="submit" className="text-[13px] text-foyer-muted hover:text-foyer-ink">
              Se déconnecter
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
