import Link from "next/link";

/**
 * Layout commun aux pages légales (/mentions-legales, /confidentialite,
 * /cookies). Nav minimale Foyer + colonne de lecture étroite. Les liens légaux
 * et le bouton « Gérer mes cookies » sont fournis par le footer global.
 */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-foyer-cream">
      <nav className="flex items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="font-serif text-[20px] tracking-tight text-foyer-ink"
        >
          Foyer
        </Link>
        <Link
          href="/"
          className="text-[13px] text-foyer-muted transition-colors hover:text-foyer-ink"
        >
          ← Retour à l&apos;accueil
        </Link>
      </nav>

      <main className="mx-auto max-w-[720px] px-6 py-12 pb-24">{children}</main>
    </div>
  );
}
