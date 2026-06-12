import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CreditCard, LogOut, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getWallet } from "@/lib/auth/actions";

export const dynamic = "force-dynamic";

const PLAN_LABELS: Record<string, string> = {
  neophyte: "Néophyte",
  expert: "Expert",
  pro: "Pro",
};

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth?tab=signin");

  const [profile, wallet] = await Promise.all([
    getProfile(user.id),
    getWallet(user.id),
  ]);

  const plan = profile?.plan ?? "neophyte";
  const isExpert = plan === "expert" || plan === "pro";

  return (
    <div className="min-h-dvh bg-foyer-cream">
      <nav className="flex items-center justify-between px-6 py-5">
        <Link href="/" className="font-serif text-[20px] tracking-tight text-foyer-ink">
          Foyer
        </Link>
        <Link href="/create" className="text-[13px] text-foyer-muted transition-colors hover:text-foyer-ink">
          Nouveau projet
        </Link>
      </nav>

      <main className="mx-auto max-w-[480px] px-6 pb-16">
        <h1 className="mb-6 font-serif text-[28px] font-medium text-foyer-ink">Mon compte</h1>

        {/* Profile card */}
        <div className="rounded-3xl border border-foyer-border bg-white p-6">
          <div className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-foyer-sage/15">
              <User className="size-5 text-foyer-sage" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-foyer-ink">
                {profile?.display_name ?? user.email}
              </p>
              <p className="text-[13px] text-foyer-muted">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Plan card */}
        <div className="mt-4 rounded-3xl border border-foyer-border bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foyer-muted">Plan actuel</p>
              <div className="mt-1 flex items-center gap-2">
                <p className="font-serif text-[24px] text-foyer-ink">{PLAN_LABELS[plan]}</p>
                {isExpert && (
                  <span className="rounded-full bg-foyer-sage/15 px-2 py-0.5 text-[11px] font-semibold text-foyer-sage">
                    Actif
                  </span>
                )}
              </div>
            </div>
            {!isExpert && (
              <Link
                href="/features"
                className="rounded-full border border-foyer-sage/40 px-4 py-2 text-[13px] font-medium text-foyer-sage transition-colors hover:bg-foyer-sage/10"
              >
                Passer Expert
              </Link>
            )}
          </div>

          {profile?.current_period_end && (
            <p className="mt-3 text-[12px] text-foyer-muted">
              Renouvellement le{" "}
              {new Date(profile.current_period_end).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}

          {isExpert && (
            <form action="/api/billing/customer-portal" method="POST" className="mt-4">
              <button
                type="submit"
                className="flex items-center gap-2 text-[13px] text-foyer-muted transition-colors hover:text-foyer-ink"
              >
                <CreditCard className="size-4" />
                Gérer mon abonnement
                <ArrowRight className="size-3.5" />
              </button>
            </form>
          )}
        </div>

        {/* Credits card — only for neophytes */}
        {!isExpert && (
          <div className="mt-4 rounded-3xl border border-foyer-border bg-white p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foyer-muted">Crédits</p>
            <p className="mt-1 font-serif text-[32px] text-foyer-ink">
              {wallet?.balance ?? 0}
            </p>
            <p className="text-[12px] text-foyer-muted">
              crédits disponibles · {wallet?.total_consumed ?? 0} utilisés au total
            </p>
            <Link
              href="/features"
              className="mt-4 flex h-[44px] items-center justify-center rounded-full bg-foyer-sage font-medium text-white shadow-[0_2px_8px_rgba(107,142,111,0.3)] transition-all hover:-translate-y-0.5 text-[14px]"
            >
              Acheter des crédits →
            </Link>
          </div>
        )}

        {/* Projects link — Expert only */}
        {isExpert && (
          <Link
            href="/projects"
            className="mt-4 flex items-center justify-between rounded-3xl border border-foyer-border bg-white p-5 transition-colors hover:bg-foyer-cream"
          >
            <span className="font-medium text-foyer-ink">Mes projets sauvegardés</span>
            <ArrowRight className="size-4 text-foyer-muted" />
          </Link>
        )}

        {/* Sign out */}
        <form action="/logout" method="POST" className="mt-8">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-full border border-foyer-border py-3 text-[14px] font-medium text-foyer-muted transition-colors hover:border-foyer-ink hover:text-foyer-ink"
          >
            <LogOut className="size-4" />
            Se déconnecter
          </button>
        </form>
      </main>
    </div>
  );
}
