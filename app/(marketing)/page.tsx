import Link from "next/link";
import {
  Image as ImageIcon,
  Compass,
  ShoppingBag,
  Leaf,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BeforeAfterSlider } from "@/components/landing/BeforeAfterSlider";
import { StepCard } from "@/components/landing/StepCard";
import { DiffCard } from "@/components/landing/DiffCard";
import { SourcedItem } from "@/components/landing/SourcedItem";
import { PartnerCard } from "@/components/landing/PartnerCard";
import { FaqAccordion } from "@/components/landing/FaqAccordion";
import { Reveal } from "@/components/landing/Reveal";

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

const MARQUEE = [
  "Conserver",
  "Customiser",
  "Chiner",
  "Seconde main",
  "Neuf qui dure",
  "Moins de CO₂",
  "Sourcé, achetable",
];

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col overflow-x-clip">
      {/* Header (sticky) */}
      <header className="sticky top-0 z-30 border-b border-foyer-border/60 bg-foyer-cream/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="font-serif text-xl tracking-tight text-foyer-ink"
          >
            Foyer
          </Link>
          <nav className="flex items-center gap-2 text-sm text-foyer-muted sm:gap-5">
            <Link
              href="#process"
              className="hidden hover:text-foyer-ink sm:inline"
            >
              Comment ça marche
            </Link>
            <Link
              href="#partenaires"
              className="hidden hover:text-foyer-ink sm:inline"
            >
              Partenaires
            </Link>
            <Link
              href="/demo"
              className="rounded-full bg-foyer-ink px-4 py-1.5 font-medium text-foyer-cream transition-transform hover:-translate-y-0.5"
            >
              Lancer
            </Link>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -right-28 -top-28 size-80 rounded-full bg-foyer-water/25 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-24 top-48 size-72 rounded-full bg-foyer-ochre/20 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-[1.05fr_1fr] md:py-24">
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-foyer-border bg-white/60 px-3 py-1 text-[12px] font-medium uppercase tracking-[0.12em] text-foyer-muted">
                <span className="size-1.5 rounded-full bg-foyer-sage" aria-hidden />
                Conception déco · sourcing éco
              </span>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-5 font-serif text-[40px] font-medium leading-[0.98] tracking-[-0.03em] text-foyer-ink md:text-[68px]">
                Une pièce transformée.{" "}
                <span className="italic text-foyer-terra-deep">
                  Une empreinte préservée.
                </span>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-6 max-w-md text-[18px] leading-relaxed text-foyer-muted">
                Un bel intérieur, sans que cela soit aux dépens de la planète.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <Button
                  render={<Link href="/demo" />}
                  size="lg"
                  className="h-12 w-full rounded-full bg-foyer-terra-deep px-6 text-white transition-transform hover:-translate-y-0.5 hover:bg-foyer-terra-deep/90 sm:w-auto"
                >
                  Lancer ma transformation
                </Button>
                <Link
                  href="#process"
                  className="group inline-flex items-center gap-1.5 text-[15px] text-foyer-ink"
                >
                  Voir comment ça marche
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </div>
            </Reveal>
          </div>

          <Reveal delay={200} className="relative">
            <div
              className="absolute -inset-3 -rotate-2 rounded-[32px] bg-foyer-sage/15"
              aria-hidden
            />
            <div className="relative rotate-1 transition-transform duration-500 hover:rotate-0">
              <BeforeAfterSlider
                beforeUrl="/landing/before.jpg"
                afterUrl="/landing/after.jpg"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* MARQUEE — bandeau défilant */}
      <div
        className="overflow-hidden bg-foyer-terra-deep py-3.5"
        aria-hidden
      >
        <div className="flex w-max animate-[marquee_26s_linear_infinite] gap-10 pr-10">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex shrink-0 items-center gap-10">
              {MARQUEE.map((word) => (
                <span
                  key={word}
                  className="flex items-center gap-10 font-serif text-lg text-foyer-cream md:text-xl"
                >
                  {word}
                  <span className="size-1.5 rounded-full bg-foyer-cream/50" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* MANIFESTE ÉCO — bloc sombre, bord en diagonale */}
      <section className="relative bg-foyer-ink text-foyer-cream [clip-path:polygon(0_24px,100%_0,100%_100%,0_100%)] md:[clip-path:polygon(0_56px,100%_0,100%_100%,0_100%)]">
        <div className="mx-auto w-full max-w-6xl px-6 pb-20 pt-24 md:pb-28 md:pt-36">
          <Reveal>
            <SectionEyebrow index="01" label="Notre parti pris" dark />
            <h2 className="mt-4 max-w-3xl font-serif text-[30px] font-medium leading-[1.05] tracking-[-0.01em] md:text-5xl">
              Avant de proposer du neuf, on regarde ce que vous avez déjà.
            </h2>
            <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-foyer-cream/70">
              Un canapé peut être recouvert. Une commode repeinte. Quand il faut
              acheter, on commence par la seconde main. Et si on doit prendre du
              neuf, on vous oriente vers ce qui dure.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {ECO_STEPS.map((step, i) => (
              <Reveal key={step.number} delay={i * 110}>
                <div className="h-full rounded-2xl border border-foyer-cream/15 bg-foyer-cream/5 p-6 transition-colors hover:bg-foyer-cream/10">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-foyer-sage" aria-hidden />
                    <span className="font-serif text-2xl text-foyer-water">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-foyer-cream">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-foyer-cream/65">
                    {step.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={120}>
            <p className="mt-8 max-w-2xl text-[13px] leading-relaxed text-foyer-cream/45">
              Score Foyer — chaque projet est mesuré selon sa part de mobilier
              conservé, occasion et neuf, et son équivalent CO₂ évité.
              Méthodologie sourcée ADEME.
            </p>
          </Reveal>
        </div>
      </section>

      {/* PROCESS */}
      <section id="process" className="scroll-mt-24">
        <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28">
          <Reveal>
            <SectionEyebrow index="02" label="Comment ça marche" />
            <h2 className="mt-4 font-serif text-[28px] font-medium leading-tight text-foyer-ink md:text-5xl">
              On vous accompagne de la photo au montage.
            </h2>
            <p className="mt-3 text-[17px] text-foyer-muted">
              4 étapes simples. Pas de logiciel à maîtriser.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROCESS_STEPS.map((step, i) => (
              <Reveal
                key={step.number}
                delay={i * 90}
                className={cn("flex", i % 2 === 1 && "lg:translate-y-8")}
              >
                <StepCard {...step} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* DIFFÉRENCIATEURS */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-20 md:pb-28">
        <Reveal>
          <SectionEyebrow index="03" label="La différence Foyer" />
          <h2 className="mt-4 max-w-2xl font-serif text-[28px] font-medium leading-tight text-foyer-ink md:text-5xl">
            On ne fait pas que générer des rendus.
          </h2>
          <p className="mt-3 text-[17px] text-foyer-muted">
            Tout ce que vous voyez existe. Et on vous dit où le trouver.
          </p>
        </Reveal>
        <div className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {DIFFERENCES.map((diff, i) => (
            <Reveal
              key={diff.title}
              delay={i * 90}
              className={cn("flex", i % 2 === 1 && "md:translate-y-8")}
            >
              <DiffCard {...diff} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* BEFORE/AFTER — bloc teinté, bord en diagonale inverse */}
      <section className="relative bg-foyer-water/15 [clip-path:polygon(0_0,100%_24px,100%_100%,0_100%)] md:[clip-path:polygon(0_0,100%_56px,100%_100%,0_100%)]">
        <div className="mx-auto w-full max-w-6xl px-6 pb-20 pt-24 md:pb-28 md:pt-36">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <Reveal className="relative">
              <div
                className="absolute -inset-3 rotate-2 rounded-[32px] bg-white/50"
                aria-hidden
              />
              <div className="relative">
                <BeforeAfterSlider
                  beforeUrl="/landing/before.jpg"
                  afterUrl="/landing/after.jpg"
                />
              </div>
            </Reveal>
            <Reveal delay={120}>
              <SectionEyebrow index="04" label="Du rendu à l'achat" />
              <h2 className="mt-4 font-serif text-[28px] font-medium leading-tight text-foyer-ink md:text-5xl">
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
            </Reveal>
          </div>
        </div>
      </section>

      {/* TRANSPARENCE IA */}
      <section className="mx-auto w-full max-w-3xl px-6 py-20 md:py-28">
        <Reveal>
          <SectionEyebrow index="05" label="Transparence" />
          <h2 className="mt-4 font-serif text-[28px] font-medium leading-tight text-foyer-ink md:text-5xl">
            On utilise l&apos;IA. Mais ce n&apos;est qu&apos;un outil.
          </h2>
          <p className="mt-5 text-[19px] leading-relaxed text-foyer-muted">
            L&apos;intelligence artificielle nous sert à générer des rendus de
            votre pièce transformée, et à retrouver des meubles d&apos;occasion
            qui correspondent visuellement à ce qu&apos;on vous propose. Le reste
            — la sélection des partenaires, le choix des matériaux, la préparation
            des listes — est pensé par notre équipe.{" "}
            <span className="font-medium text-foyer-ink">
              L&apos;IA pour aller vite, l&apos;humain pour aller juste.
            </span>
          </p>
        </Reveal>
      </section>

      {/* B2B — bloc sombre, bord en diagonale */}
      <section
        id="partenaires"
        className="relative scroll-mt-24 bg-foyer-ink text-foyer-cream [clip-path:polygon(0_24px,100%_0,100%_100%,0_100%)] md:[clip-path:polygon(0_56px,100%_0,100%_100%,0_100%)]"
      >
        <div className="mx-auto w-full max-w-6xl px-6 pb-20 pt-24 md:pb-28 md:pt-36">
          <Reveal>
            <SectionEyebrow index="06" label="Partenaires" dark />
            <h2 className="mt-4 max-w-3xl font-serif text-[28px] font-medium leading-tight md:text-5xl">
              Partenaires : et si Foyer devenait votre canal d&apos;acquisition ?
            </h2>
            <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-foyer-cream/70">
              Un nouveau front-end IA pour les enseignes déco, fournitures et
              seconde main qui veulent capter le flux IA-design avant qu&apos;il
              ne devienne dominant.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {PARTNERS.map((partner, i) => (
              <Reveal key={partner.title} delay={i * 100}>
                <div className="h-full rounded-2xl border border-foyer-cream/15 bg-foyer-cream/5 p-6 transition-colors hover:bg-foyer-cream/10">
                  <h3 className="text-lg font-semibold text-foyer-cream">
                    {partner.title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-foyer-cream/70">
                    {partner.promise}
                  </p>
                  <p className="mt-4 text-[13px] text-foyer-cream/50">
                    <span className="text-foyer-cream/70">ex.</span>{" "}
                    {partner.examples}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={120}>
            <Link
              href="mailto:contact@foyer.app"
              className="mt-10 inline-flex h-12 items-center gap-2 rounded-full bg-foyer-cream px-6 font-medium text-foyer-ink transition-transform hover:-translate-y-0.5"
            >
              Discuter d&apos;un partenariat
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto w-full max-w-3xl px-6 py-20 md:py-28">
        <Reveal>
          <SectionEyebrow index="07" label="FAQ" />
          <h2 className="mt-4 font-serif text-[28px] font-medium leading-tight text-foyer-ink md:text-5xl">
            Questions fréquentes
          </h2>
        </Reveal>
        <Reveal delay={100}>
          <div className="mt-8">
            <FaqAccordion items={FAQ} />
          </div>
        </Reveal>
      </section>

      {/* FOOTER — clôture sombre */}
      <footer className="bg-foyer-ink text-foyer-cream">
        <div className="mx-auto w-full max-w-6xl px-6 py-14">
          <div className="grid gap-10 md:grid-cols-4">
            <div>
              <span className="font-serif text-xl tracking-tight text-foyer-cream">
                Foyer
              </span>
              <p className="mt-2 text-[13px] text-foyer-cream/50">
                Conçu en France.
              </p>
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
          <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-foyer-cream/10 pt-6 text-[13px] text-foyer-cream/50 sm:flex-row sm:items-center">
            <span>© {new Date().getFullYear()} Foyer</span>
            <div className="flex items-center gap-5">
              <a href="#" className="hover:text-foyer-cream">
                Instagram
              </a>
              <a href="#" className="hover:text-foyer-cream">
                TikTok
              </a>
              <a href="#" className="hover:text-foyer-cream">
                LinkedIn
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionEyebrow({
  index,
  label,
  dark = false,
}: {
  index: string;
  label: string;
  dark?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "font-serif text-sm",
          dark ? "text-foyer-terra" : "text-foyer-terra-deep",
        )}
      >
        {index}
      </span>
      <span
        className={cn("h-px w-8", dark ? "bg-foyer-cream/25" : "bg-foyer-border")}
        aria-hidden
      />
      <span
        className={cn(
          "text-[12px] font-medium uppercase tracking-[0.14em]",
          dark ? "text-foyer-cream/70" : "text-foyer-muted",
        )}
      >
        {label}
      </span>
    </div>
  );
}

function FooterColumn({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-foyer-cream/90">
        {title}
      </h3>
      <ul className="mt-3 space-y-2 text-[14px] text-foyer-cream/55">
        {links.map((link) => (
          <li key={link}>
            <a href="#" className="hover:text-foyer-cream">
              {link}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
