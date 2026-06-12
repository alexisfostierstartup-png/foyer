import Link from "next/link";
import { Check, Pencil, Bookmark, Link2, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Foyer Expert — Fonctionnalités",
  description: "Allez plus loin avec Foyer Expert. Édition live, projets sauvegardés, URL produit.",
};

const FEATURES = [
  {
    icon: Pencil,
    title: "Édition live",
    subtitle: "Cliquez n'importe quel élément. Changez-le sans tout recommencer.",
    description:
      "Identifiez un meuble ou une surface dans le rendu, sélectionnez-le et remplacez-le instantanément. Pas besoin de relancer un projet entier pour affiner.",
    badge: "Expert",
  },
  {
    icon: Bookmark,
    title: "Vos projets, toujours là",
    subtitle: "Sauvegardez, retrouvez, comparez.",
    description:
      "Tous vos projets sont conservés dans votre espace personnel. Retrouvez n'importe quel rendu, comparez deux ambiances, ou reprenez là où vous vous étiez arrêté.",
    badge: "Expert",
  },
  {
    icon: Link2,
    title: "URL produit personnalisée",
    subtitle: "Un produit en tête ? On l'intègre directement.",
    description:
      "Collez l'URL d'un produit (canapé, lampe, table…) et Foyer l'intègre visuellement dans votre pièce. Voyez à quoi ressemble exactement ce que vous envisagez d'acheter.",
    badge: "Expert",
  },
];

const COMPARE_ROWS = [
  { feature: "1er rendu offert", neophyte: true, expert: true },
  { feature: "Générations supplémentaires", neophyte: "Crédits", expert: "Illimité" },
  { feature: "Sauvegarde de projets", neophyte: false, expert: true },
  { feature: "Édition live", neophyte: false, expert: true },
  { feature: "URL produit personnalisée", neophyte: false, expert: true },
];

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="mx-auto size-5 text-foyer-sage" strokeWidth={2.5} />;
  if (value === false) return <span className="text-foyer-muted">—</span>;
  return <span className="text-[13px] text-foyer-ink">{value}</span>;
}

export default function FeaturesPage() {
  return (
    <div className="min-h-dvh bg-foyer-cream">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5">
        <Link href="/" className="font-serif text-[20px] tracking-tight text-foyer-ink">
          Foyer
        </Link>
        <Link
          href="/auth?tab=signup"
          className="rounded-full bg-foyer-sage px-4 py-2 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(107,142,111,0.3)] transition-all hover:-translate-y-0.5"
        >
          Essayer Expert →
        </Link>
      </nav>

      <main className="mx-auto max-w-[640px] px-6 pb-24">
        {/* Hero */}
        <section className="py-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-foyer-sage/30 bg-foyer-sage/10 px-3 py-1.5">
            <span className="size-1.5 rounded-full bg-foyer-sage" />
            <span className="text-[12px] font-semibold text-foyer-sage">Foyer Expert</span>
          </div>
          <h1 className="font-serif text-[38px] font-medium leading-tight text-foyer-ink md:text-[48px]">
            Allez plus loin
            <br />
            avec Foyer Expert
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-foyer-muted">
            Pour ceux qui veulent piloter leur projet de bout en bout.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/auth?tab=signup&plan=expert"
              className="flex h-[52px] items-center gap-2 rounded-full bg-foyer-sage px-8 font-semibold text-white shadow-[0_2px_12px_rgba(107,142,111,0.35)] transition-all hover:-translate-y-0.5"
            >
              Essayer Expert — 15€/mois
            </Link>
            <Link
              href="/create"
              className="flex h-[52px] items-center gap-2 rounded-full border border-foyer-border px-6 text-foyer-ink transition-colors hover:bg-foyer-border/30"
            >
              Essayer gratuitement d'abord
            </Link>
          </div>
          <p className="mt-3 text-[12px] text-foyer-muted">Sans engagement · Résiliable à tout moment</p>
        </section>

        {/* Features */}
        <section className="space-y-12">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="rounded-3xl border border-foyer-border bg-white p-7">
                <div className="mb-5 flex items-start gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-foyer-sage/12">
                    <Icon className="size-5 text-foyer-sage" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-serif text-[20px] font-medium text-foyer-ink">{f.title}</h2>
                      <span className="rounded-full bg-foyer-sage/15 px-2 py-0.5 text-[11px] font-semibold text-foyer-sage">
                        {f.badge}
                      </span>
                    </div>
                    <p className="mt-1 text-[14px] font-medium text-foyer-muted">{f.subtitle}</p>
                  </div>
                </div>

                {/* Placeholder visual */}
                <div className="mb-5 aspect-[16/7] w-full rounded-2xl bg-foyer-cream border border-foyer-border/60 flex items-center justify-center">
                  <p className="text-[13px] text-foyer-muted">Capture annotée — coming soon</p>
                </div>

                <p className="text-[14px] leading-relaxed text-foyer-muted">{f.description}</p>
              </div>
            );
          })}
        </section>

        {/* Comparatif */}
        <section className="mt-16">
          <h2 className="mb-6 text-center font-serif text-[28px] font-medium text-foyer-ink">
            Néophyte vs Expert
          </h2>
          <div className="overflow-hidden rounded-2xl border border-foyer-border bg-white">
            <div className="grid grid-cols-3 border-b border-foyer-border bg-foyer-cream/50 px-5 py-3">
              <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-foyer-muted">
                Fonctionnalité
              </span>
              <span className="text-center text-[12px] font-semibold uppercase tracking-[0.08em] text-foyer-muted">
                Néophyte
              </span>
              <span className="text-center text-[12px] font-semibold uppercase tracking-[0.08em] text-foyer-sage">
                Expert
              </span>
            </div>
            {COMPARE_ROWS.map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-3 items-center px-5 py-4 text-center ${i < COMPARE_ROWS.length - 1 ? "border-b border-foyer-border" : ""}`}
              >
                <span className="text-left text-[13px] text-foyer-ink">{row.feature}</span>
                <FeatureValue value={row.neophyte} />
                <FeatureValue value={row.expert} />
              </div>
            ))}
          </div>
        </section>

        {/* Pricing CTA */}
        <section className="mt-16">
          <div className="rounded-3xl border border-foyer-sage/30 bg-white p-8 text-center shadow-[0_4px_24px_rgba(107,142,111,0.1)]">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-foyer-sage/10 px-3 py-1.5">
              <span className="text-[12px] font-semibold text-foyer-sage">Expert</span>
            </div>
            <p className="font-serif text-[40px] font-medium text-foyer-ink">15€<span className="text-[22px] text-foyer-muted">/mois</span></p>
            <p className="mt-1 text-[14px] text-foyer-muted">Sans engagement · Résiliable à tout moment</p>
            <ul className="mt-6 space-y-2.5 text-left">
              {[
                "Générations illimitées",
                "Tous vos projets sauvegardés",
                "Édition live — changez n'importe quel meuble",
                "URL produit personnalisée",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-[14px] text-foyer-ink">
                  <Check className="size-4 shrink-0 text-foyer-sage" strokeWidth={2.5} />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/auth?tab=signup&plan=expert"
              className="mt-8 flex h-[52px] items-center justify-center rounded-full bg-foyer-sage font-semibold text-white shadow-[0_2px_12px_rgba(107,142,111,0.35)] transition-all hover:-translate-y-0.5"
            >
              Essayer Expert →
            </Link>
          </div>
        </section>

        {/* Pro teaser */}
        <div className="mt-10 text-center">
          <Link
            href="/pro"
            className="inline-flex items-center gap-1.5 text-[13px] text-foyer-muted transition-colors hover:text-foyer-ink"
          >
            Vous êtes professionnel ? Voir Foyer Pro
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </main>
    </div>
  );
}
