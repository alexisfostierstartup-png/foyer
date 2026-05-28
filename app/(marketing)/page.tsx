import Link from "next/link";
import {
  Image as ImageIcon,
  Compass,
  ShoppingBag,
  Leaf,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BeforeAfterSlider } from "@/components/landing/BeforeAfterSlider";
import { StepCard } from "@/components/landing/StepCard";
import { DiffCard } from "@/components/landing/DiffCard";
import { SourcedItem } from "@/components/landing/SourcedItem";
import { PartnerCard } from "@/components/landing/PartnerCard";
import { FaqAccordion } from "@/components/landing/FaqAccordion";

const PROCESS_STEPS = [
  {
    number: "01",
    title: "Vous photographiez votre pièce",
    description: "Une photo suffit pour commencer. Pas besoin de mesurer.",
  },
  {
    number: "02",
    title: "On imagine le projet avec vous",
    description:
      "Choisissez un style, on génère des propositions, vous ajustez.",
  },
  {
    number: "03",
    title: "On vérifie que tout rentre",
    description:
      "Une mesure rapide, et on adapte le projet à vos vraies dimensions.",
  },
  {
    number: "04",
    title: "On vous dit où tout acheter",
    description:
      "Chaque élément du rendu est sourcé : seconde main d'abord, neuf durable ensuite.",
  },
];

const DIFFERENCES = [
  {
    icon: ImageIcon,
    tone: "terra" as const,
    title: "Des rendus réels",
    description:
      "Le rendu tient compte de votre pièce. Chaque élément est sourcé et achetable.",
  },
  {
    icon: Compass,
    tone: "ink" as const,
    title: "Une conception guidée",
    description:
      "Choix du style, ajustements, validation. Vous n'êtes pas seul devant une page blanche.",
  },
  {
    icon: ShoppingBag,
    tone: "sage" as const,
    title: "Une liste d'achat réelle",
    description:
      "On vous indique où acheter chaque pièce, au meilleur compromis prix/durabilité.",
  },
  {
    icon: Leaf,
    tone: "water" as const,
    title: "Une logique éco par défaut",
    description:
      "On garde votre mobilier d'abord, on chine ensuite, on achète neuf en dernier.",
  },
];

const SOURCED_ITEMS = [
  {
    tone: "terra" as const,
    name: "Canapé en lin écru",
    detail: "seconde main · Selency",
    price: "320 €",
  },
  {
    tone: "terra" as const,
    name: "Table basse chêne clair",
    detail: "seconde main · Leboncoin",
    price: "75 €",
  },
  {
    tone: "sage" as const,
    name: "Escalier",
    detail: "conservé, harmonisé au style",
    price: "existant",
  },
  {
    tone: "terra" as const,
    name: "Lampe céramique",
    detail: "neuf français · La Redoute",
    price: "119 €",
  },
];

const ECO_STEPS = [
  {
    number: "01",
    title: "D'abord, on réutilise",
    description: "Homestaging et customisation de vos meubles.",
  },
  {
    number: "02",
    title: "Ensuite, on cherche d'occasion",
    description:
      "Sourcing seconde main depuis les plateformes que vous utilisez déjà.",
  },
  {
    number: "03",
    title: "En dernier, du neuf qui dure",
    description: "Conseil matériaux et marques. Ce qui tient dix ans, pas trois.",
  },
];

const PARTNERS = [
  {
    title: "Enseignes fournitures",
    promise:
      "Captez le flux IA-design en France. Co-investissement, exclu catégorie, données agrégées.",
    examples: "Leroy Merlin, Castorama, ManoMano",
  },
  {
    title: "Marketplaces seconde main",
    promise:
      "Augmentez la visibilité de vos vendeurs auprès d'acheteurs en projet déco qualifié.",
    examples: "Leboncoin, Vinted, Selency",
  },
  {
    title: "Enseignes mobilier durable",
    promise: "Touchez des acheteurs qui achètent moins, mais durable.",
    examples: "Maisons du Monde, La Redoute, Tikamoon",
  },
];

const FAQ = [
  {
    question: "Combien ça coûte ?",
    answer:
      "Le premier rendu est offert. Ensuite des crédits à partir de 4,99 €. Pas d'abonnement.",
  },
  {
    question: "Est-ce que vous remplacez tout mon mobilier ?",
    answer:
      "Non, on propose systématiquement de garder ce qui peut l'être. C'est notre angle de départ.",
  },
  {
    question: "Comment trouvez-vous les meubles d'occasion ?",
    answer:
      "On scanne Leboncoin et Vinted Maison, et on propose ce qui correspond visuellement au rendu.",
  },
  {
    question: "Et si je ne suis pas content du rendu ?",
    answer:
      "Vous pouvez itérer (changer de style, ajuster). Si vraiment ça ne va pas, on rembourse le crédit.",
  },
  {
    question: "Comment se passe l'achat ?",
    answer:
      "On vous indique où acheter chaque élément (seconde main et neuf), avec les liens. Vous achetez directement chez chaque marchand.",
  },
  {
    question: "C'est dispo où ?",
    answer: "France pour le moment. Europe à venir.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <header className="border-b border-foyer-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="font-serif text-xl tracking-tight text-foyer-ink"
          >
            Foyer
          </Link>
          <nav className="flex items-center gap-5 text-sm text-foyer-muted">
            <Link href="#process" className="hidden hover:text-foyer-ink sm:inline">
              Comment ça marche
            </Link>
            <Link
              href="#partenaires"
              className="hidden hover:text-foyer-ink sm:inline"
            >
              Partenaires
            </Link>
            <Link href="/create" className="font-medium text-foyer-ink">
              Lancer
            </Link>
          </nav>
        </div>
      </header>

      {/* Section 1 — Hero */}
      <section className="mx-auto w-full max-w-6xl px-6 py-12 md:py-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <h1 className="font-serif text-[32px] font-medium leading-[1.1] tracking-[-0.02em] text-foyer-ink md:text-[56px]">
              Votre pièce, transformée. Réellement.
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-foyer-muted">
              De la photo aux commandes prêtes, on pense le projet avec vous. On
              garde ce qui peut l&apos;être, on chine le reste, on sélectionne le
              neuf qui dure.
            </p>
            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Button
                render={<Link href="/create" />}
                size="lg"
                className="h-12 w-full rounded-full bg-foyer-terra-deep px-6 text-white hover:bg-foyer-terra-deep/90 sm:w-auto"
              >
                Lancer ma transformation
              </Button>
              <Link
                href="#process"
                className="text-[15px] text-foyer-ink underline underline-offset-4 hover:text-foyer-terra-deep"
              >
                Voir comment ça marche
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-foyer-muted">
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-foyer-terra" aria-hidden />
                1 premier rendu offert
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-foyer-sage" aria-hidden />
                Sans abonnement
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-foyer-water" aria-hidden />
                Conçu en France
              </li>
            </ul>
          </div>
          <BeforeAfterSlider
            beforeUrl="/landing/before.jpg"
            afterUrl="/landing/after.jpg"
          />
        </div>
      </section>

      {/* Section 2 — Process */}
      <section
        id="process"
        className="scroll-mt-20 border-t border-foyer-border bg-white/40"
      >
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-24">
          <h2 className="font-serif text-2xl font-medium text-foyer-ink md:text-4xl">
            On vous accompagne de la photo au montage.
          </h2>
          <p className="mt-3 text-[17px] text-foyer-muted">
            4 étapes simples. Pas de logiciel à maîtriser.
          </p>
          <div className="mt-10 flex flex-col gap-4 md:flex-row">
            {PROCESS_STEPS.map((step) => (
              <StepCard key={step.number} {...step} />
            ))}
          </div>
        </div>
      </section>

      {/* Section 3 — La différence Foyer */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16 md:py-24">
        <h2 className="font-serif text-2xl font-medium text-foyer-ink md:text-4xl">
          On ne fait pas que générer des rendus.
        </h2>
        <p className="mt-3 text-[17px] text-foyer-muted">
          Tout ce que vous voyez existe. Et on vous dit où le trouver.
        </p>
        <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {DIFFERENCES.map((diff) => (
            <DiffCard key={diff.title} {...diff} />
          ))}
        </div>
      </section>

      {/* Section 4 — Before/after détaillé */}
      <section className="border-t border-foyer-border bg-white/40">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-24">
          <div className="grid items-start gap-10 md:grid-cols-2">
            <BeforeAfterSlider
              beforeUrl="/landing/before.jpg"
              afterUrl="/landing/after.jpg"
            />
            <div>
              <h2 className="font-serif text-2xl font-medium text-foyer-ink md:text-4xl">
                Ce que vous voyez dans le rendu
              </h2>
              <ul className="mt-6">
                {SOURCED_ITEMS.map((item) => (
                  <SourcedItem key={item.name} {...item} />
                ))}
              </ul>
              <p className="mt-6 text-[15px] leading-relaxed text-foyer-muted">
                Chaque élément est sourcé. Vous savez exactement où acheter, et à
                quel prix.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5 — Manifeste éco */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16 md:py-24">
        <h2 className="font-serif text-2xl font-medium text-foyer-ink md:text-4xl">
          Avant de proposer du neuf, on regarde ce que vous avez déjà.
        </h2>
        <p className="mt-3 max-w-3xl text-[17px] leading-relaxed text-foyer-muted">
          Un canapé peut être recouvert. Une commode repeinte. Quand il faut
          acheter, on commence par la seconde main. Et si on doit prendre du neuf,
          on vous oriente vers ce qui dure.
        </p>
        <div className="mt-10 flex flex-col gap-4 md:flex-row">
          {ECO_STEPS.map((step) => (
            <StepCard key={step.number} withDot {...step} />
          ))}
        </div>
        <p className="mt-6 text-[13px] leading-relaxed text-foyer-muted">
          Score Foyer — chaque projet est mesuré selon sa part de mobilier
          conservé, occasion et neuf, et son équivalent CO₂ évité. Méthodologie
          sourcée ADEME.
        </p>
      </section>

      {/* Section 6 — Transparence IA */}
      <section className="border-t border-foyer-border bg-white/40">
        <div className="mx-auto w-full max-w-3xl px-6 py-16 md:py-24">
          <h2 className="font-serif text-2xl font-medium text-foyer-ink md:text-4xl">
            On utilise l&apos;IA. Mais ce n&apos;est qu&apos;un outil.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-foyer-muted">
            L&apos;intelligence artificielle nous sert à générer des rendus de
            votre pièce transformée, et à retrouver des meubles d&apos;occasion qui
            correspondent visuellement à ce qu&apos;on vous propose. Le reste — la
            sélection des partenaires, le choix des matériaux, la préparation des
            listes — est pensé par notre équipe. L&apos;IA pour aller vite,
            l&apos;humain pour aller juste.
          </p>
        </div>
      </section>

      {/* Section 7 — B2B */}
      <section
        id="partenaires"
        className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-16 md:py-24"
      >
        <h2 className="font-serif text-2xl font-medium text-foyer-ink md:text-4xl">
          Partenaires : et si Foyer devenait votre canal d&apos;acquisition ?
        </h2>
        <p className="mt-3 max-w-3xl text-[17px] leading-relaxed text-foyer-muted">
          Un nouveau front-end IA pour les enseignes déco, fournitures et seconde
          main qui veulent capter le flux IA-design avant qu&apos;il ne devienne
          dominant.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PARTNERS.map((partner) => (
            <PartnerCard key={partner.title} {...partner} />
          ))}
        </div>
        <div className="mt-8">
          <Button
            render={<Link href="mailto:contact@foyer.app" />}
            size="lg"
            className="h-12 rounded-full border border-foyer-border bg-white px-6 text-foyer-ink hover:bg-foyer-cream"
          >
            Discuter d&apos;un partenariat
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      </section>

      {/* Section 8 — FAQ */}
      <section className="border-t border-foyer-border bg-white/40">
        <div className="mx-auto w-full max-w-3xl px-6 py-16 md:py-24">
          <h2 className="font-serif text-2xl font-medium text-foyer-ink md:text-4xl">
            Questions fréquentes
          </h2>
          <div className="mt-8">
            <FaqAccordion items={FAQ} />
          </div>
        </div>
      </section>

      {/* Section 9 — Footer */}
      <footer className="border-t border-foyer-border">
        <div className="mx-auto w-full max-w-6xl px-6 py-12">
          <div className="grid gap-10 md:grid-cols-4">
            <div>
              <span className="font-serif text-xl tracking-tight text-foyer-ink">
                Foyer
              </span>
              <p className="mt-2 text-[13px] text-foyer-muted">Conçu en France.</p>
            </div>
            <FooterColumn
              title="Produit"
              links={["Comment ça marche", "Tarifs", "FAQ"]}
            />
            <FooterColumn
              title="Éco"
              links={["Méthodologie", "Partenaires", "Sources"]}
            />
            <FooterColumn title="Légal" links={["CGU", "Privacy", "Mentions"]} />
          </div>
          <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-foyer-border pt-6 text-[13px] text-foyer-muted sm:flex-row sm:items-center">
            <span>© {new Date().getFullYear()} Foyer</span>
            <div className="flex items-center gap-5">
              <a href="#" className="hover:text-foyer-ink">
                Instagram
              </a>
              <a href="#" className="hover:text-foyer-ink">
                TikTok
              </a>
              <a href="#" className="hover:text-foyer-ink">
                LinkedIn
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterColumn({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-foyer-ink">
        {title}
      </h3>
      <ul className="mt-3 space-y-2 text-[14px] text-foyer-muted">
        {links.map((link) => (
          <li key={link}>
            <a href="#" className="hover:text-foyer-ink">
              {link}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
