import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?tab=signin");

  const profile = await getProfile(user.id);

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
            <div className="flex justify-between">
              <span className="text-foyer-muted">Nom d'affichage</span>
              <span className="text-foyer-ink">{profile?.display_name ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foyer-muted">Plan</span>
              <span className="rounded-full bg-foyer-sage px-2.5 py-0.5 text-[11px] font-bold uppercase text-white">
                {profile?.plan ?? "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Subscription */}
        <div className="rounded-2xl border border-foyer-border bg-foyer-cream p-5">
          <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-foyer-muted">Abonnement</h2>
          <div className="space-y-3 text-[14px]">
            {profile?.current_period_end && (
              <div className="flex justify-between">
                <span className="text-foyer-muted">Renouvellement</span>
                <span className="text-foyer-ink">
                  {new Date(profile.current_period_end).toLocaleDateString("fr-FR", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <Link
              href="/account"
              className="rounded-full border border-foyer-border px-4 py-2 text-[13px] font-medium text-foyer-muted transition-colors hover:text-foyer-ink"
            >
              Gérer l'abonnement
            </Link>
            <form action="/logout" method="POST">
              <button
                type="submit"
                className="rounded-full border border-foyer-border px-4 py-2 text-[13px] font-medium text-foyer-muted transition-colors hover:text-foyer-ink"
              >
                Se déconnecter
              </button>
            </form>
          </div>
        </div>

        {/* Support */}
        <div className="rounded-2xl border border-foyer-border bg-foyer-cream p-5">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-foyer-muted">Support</h2>
          <p className="text-[13px] text-foyer-muted">
            Une question ?{" "}
            <a href="mailto:pro@foyer.io" className="text-foyer-sage underline underline-offset-2">
              pro@foyer.io
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
