import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/actions";
import { ArrowLeft } from "lucide-react";

export default async function ProCreateLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?tab=signin&next=/pro/create");

  const profile = await getProfile(user.id);
  if (profile?.plan !== "pro") redirect("/pro");

  return (
    <div className="min-h-dvh bg-[#f5f0ea]">
      <header className="flex h-14 items-center gap-4 border-b border-foyer-border bg-foyer-cream px-5">
        <Link href="/pro/dashboard" className="flex items-center gap-1.5 text-[13px] text-foyer-muted hover:text-foyer-ink">
          <ArrowLeft className="size-4" />
          Dashboard
        </Link>
        <span className="font-serif text-[16px] tracking-tight text-foyer-ink">Foyer</span>
        <span className="rounded-full bg-foyer-sage px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Pro</span>
      </header>
      <main>{children}</main>
    </div>
  );
}
