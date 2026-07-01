"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ManageCookiesButton } from "./manage-cookies-button";

const LEGAL_LINKS = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/cookies", label: "Cookies" },
];

/**
 * Footer global, monté dans le root layout. Présent sur toutes les pages,
 * SAUF le parcours de création (/create/*) et la landing (/) qui possède son
 * propre footer brandé.
 */
export function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith("/create") || pathname === "/") return null;

  return (
    <footer className="mt-auto border-t border-foyer-border bg-foyer-cream px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-[13px] text-foyer-muted sm:flex-row sm:justify-between">
        <span>© {new Date().getFullYear()} Héra</span>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-foyer-ink"
            >
              {link.label}
            </Link>
          ))}
          <ManageCookiesButton className="transition-colors hover:text-foyer-ink" />
        </nav>
      </div>
    </footer>
  );
}
