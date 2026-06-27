"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";

const ASSET_CATEGORIES = [
  { slug: "ambiance", label: "Ambiances" },
  { slug: "room_defaults", label: "Defaults pièce" },
  { slug: "floor_preset", label: "Presets sol" },
  { slug: "wall_palette", label: "Palettes murales" },
];

function NavLink({
  href,
  label,
  onClick,
}: {
  href: string;
  label: string;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block rounded-md px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-foyer-ink text-foyer-cream"
          : "text-foyer-muted hover:bg-foyer-border hover:text-foyer-ink"
      }`}
    >
      {label}
    </Link>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const assetsActive = pathname.startsWith("/admin/assets");

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const content = (
    <nav className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-foyer-border">
        <Link
          href="/"
          className="font-serif text-xl tracking-tight text-foyer-ink"
          onClick={() => setMobileOpen(false)}
        >
          Foyer
        </Link>
        <span className="ml-2 text-xs text-foyer-muted">admin</span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <NavLink
          href="/admin/dashboard"
          label="Dashboard coûts"
          onClick={() => setMobileOpen(false)}
        />
        <NavLink
          href="/admin/ai-pricing"
          label="Pricing IA"
          onClick={() => setMobileOpen(false)}
        />
        <NavLink
          href="/admin/prompts"
          label="Prompts"
          onClick={() => setMobileOpen(false)}
        />
        <NavLink
          href="/admin/logs"
          label="Logs"
          onClick={() => setMobileOpen(false)}
        />
        <NavLink
          href="/admin/catalog"
          label="Catalogue"
          onClick={() => setMobileOpen(false)}
        />
        <NavLink
          href="/admin/diy-actions"
          label="Actions DIY"
          onClick={() => setMobileOpen(false)}
        />

        <div>
          <button
            onClick={() => setAssetsOpen((v) => !v)}
            className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
              assetsActive
                ? "bg-foyer-ink text-foyer-cream"
                : "text-foyer-muted hover:bg-foyer-border hover:text-foyer-ink"
            }`}
          >
            Assets
            <ChevronDown
              size={14}
              className={`transition-transform ${assetsOpen ? "rotate-180" : ""}`}
            />
          </button>
          {assetsOpen && (
            <div className="mt-1 ml-3 space-y-0.5">
              {ASSET_CATEGORIES.map((c) => (
                <NavLink
                  key={c.slug}
                  href={`/admin/assets/${c.slug}`}
                  label={c.label}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-3 py-4 border-t border-foyer-border">
        <button
          onClick={handleLogout}
          className="w-full rounded-md px-3 py-2 text-sm text-foyer-muted hover:text-foyer-terra text-left transition-colors"
        >
          Déconnexion
        </button>
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed top-4 left-4 z-50 flex h-9 w-9 items-center justify-center rounded-lg border border-foyer-border bg-foyer-cream shadow-sm md:hidden"
        onClick={() => setMobileOpen((v) => !v)}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foyer-ink/20 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-full w-56 bg-foyer-cream border-r border-foyer-border transition-transform md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {content}
      </aside>
    </>
  );
}
