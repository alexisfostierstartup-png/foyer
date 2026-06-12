import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/actions";
import { Image, Settings, LogOut, Plus } from "lucide-react";

const NAV = [
  { href: "/dashboard/rendus", label: "Mes Rendus", icon: Image },
  { href: "/dashboard/settings", label: "Paramètres", icon: Settings },
];

export default async function UserDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?tab=signin&next=/dashboard/rendus");

  const profile = await getProfile(user.id);
  // Pro users have their own dashboard
  if (profile?.plan === "pro") redirect("/pro/dashboard");

  const plan = profile?.plan ?? "neophyte";
  const isExpert = plan === "expert";

  return (
    <div className="flex min-h-dvh bg-[#f5f0ea]">
      {/* Sidebar */}
      <aside className="hidden w-52 shrink-0 flex-col border-r border-foyer-border bg-foyer-cream lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-foyer-border px-5">
          <Link href="/dashboard/rendus" className="font-serif text-[18px] tracking-tight text-foyer-ink">
            Foyer
          </Link>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            isExpert ? "bg-foyer-ochre/80 text-white" : "bg-foyer-border text-foyer-muted"
          }`}>
            {isExpert ? "Expert" : "Free"}
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium text-foyer-muted transition-colors hover:bg-foyer-border/50 hover:text-foyer-ink"
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          ))}

          <div className="mt-auto pt-4">
            <Link
              href="/create"
              className="flex items-center gap-2 rounded-xl border border-foyer-sage/40 px-3 py-2 text-[13px] font-medium text-foyer-sage transition-colors hover:bg-foyer-sage/10"
            >
              <Plus className="size-4" />
              Nouveau projet
            </Link>
          </div>
        </nav>

        <div className="border-t border-foyer-border px-4 py-4">
          <p className="truncate text-[12px] text-foyer-muted">{user.email}</p>
          <form action="/logout" method="POST" className="mt-2">
            <button
              type="submit"
              className="flex items-center gap-1.5 text-[12px] text-foyer-muted transition-colors hover:text-foyer-ink"
            >
              <LogOut className="size-3.5" />
              Déconnexion
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-foyer-border bg-foyer-cream px-4 lg:hidden">
        <Link href="/dashboard/rendus" className="font-serif text-[18px] tracking-tight text-foyer-ink">
          Foyer
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/rendus" className="text-[13px] text-foyer-muted hover:text-foyer-ink">Rendus</Link>
          <Link href="/dashboard/settings" className="text-[13px] text-foyer-muted hover:text-foyer-ink">Paramètres</Link>
          <Link href="/create" className="rounded-full bg-foyer-sage px-3 py-1.5 text-[12px] font-semibold text-white">+ Nouveau</Link>
        </div>
      </div>

      <main className="flex flex-1 flex-col overflow-auto pt-14 lg:pt-0">{children}</main>
    </div>
  );
}
