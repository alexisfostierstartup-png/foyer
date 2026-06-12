import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/actions";

// Redirect authenticated pros to their dashboard; others to auth
export default async function ProPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth?tab=signup&next=/pro/dashboard");

  const profile = await getProfile(user.id);
  if (profile?.plan === "pro") redirect("/pro/dashboard");

  // Not yet pro — show upgrade page
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-foyer-cream px-6 py-16 text-center">
      <h1 className="font-serif text-[36px] font-medium text-foyer-ink">Foyer Pro</h1>
      <p className="mt-3 max-w-sm text-[16px] leading-relaxed text-foyer-muted">
        La suite professionnelle pour agents et architectes d'intérieur.
        Générez des portfolios entiers en quelques clics.
      </p>
      <p className="mt-8 text-[14px] text-foyer-muted">
        Accès Pro sur invitation — contactez{" "}
        <a href="mailto:pro@foyer.io" className="text-foyer-sage underline underline-offset-2">
          pro@foyer.io
        </a>
      </p>
    </div>
  );
}
