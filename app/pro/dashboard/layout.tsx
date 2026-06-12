import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/actions";
import {
  Building2,
  Users,
  LayoutTemplate,
  BarChart2,
  Settings,
  LogOut,
} from "lucide-react";

const NAV = [
  { href: "/pro/dashboard/biens", label: "Biens", icon: Building2 },
  { href: "/pro/dashboard/clients", label: "Clients", icon: Users },
  { href: "/pro/dashboard/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/pro/dashboard/stats", label: "Stats", icon: BarChart2 },
  { href: "/pro/dashboard/settings", label: "Paramètres", icon: Settings },
];

export default async function ProDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?tab=signin&next=/pro/dashboard");

  const profile = await getProfile(user.id);
  if (profile?.plan !== "pro") redirect("/pro");

  return (
    <div className="flex min-h-dvh bg-[#f5f0ea]">
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-foyer-border bg-foyer-cream lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-foyer-border px-5">
          <Link href="/pro/dashboard" className="font-serif text-[18px] tracking-tight text-foyer-ink">
            Foyer
          </Link>
          <span className="rounded-full bg-foyer-sage px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            Pro
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

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-auto">{children}</main>
    </div>
  );
}
