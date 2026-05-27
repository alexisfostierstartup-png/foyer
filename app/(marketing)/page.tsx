import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <span className="mb-6 rounded-full border border-foyer-border px-4 py-1 text-sm text-foyer-muted">
        Votre pièce, transformée. Réellement.
      </span>
      <h1 className="max-w-2xl font-serif text-4xl leading-tight text-foyer-ink sm:text-6xl">
        De la photo aux commandes prêtes, on pense le projet avec vous.
      </h1>
      <p className="mt-6 max-w-xl text-lg text-foyer-muted">
        Foyer préserve l&apos;architecture de votre pièce, garde vos meubles
        quand c&apos;est possible, et propose un projet éco-aligné.
      </p>
      <div className="mt-10">
        <Button
          render={<Link href="/create" />}
          size="lg"
          className="rounded-2xl bg-foyer-terra text-foyer-cream hover:bg-foyer-terra/90"
        >
          Commencer avec une photo
        </Button>
      </div>
      {/* Landing design from Claude Design (see /design) will replace this placeholder. */}
    </main>
  );
}
