import Link from "next/link";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`font-serif text-xl tracking-tight text-foyer-ink ${className ?? ""}`}
    >
      Foyer
    </Link>
  );
}
