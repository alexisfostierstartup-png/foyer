import Link from "next/link";
import {
  Image as ImageIcon,
  Compass,
  ShoppingBag,
  Leaf,
  ArrowRight,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BeforeAfterSlider } from "@/components/landing/BeforeAfterSlider";
import { SourcedItem } from "@/components/landing/SourcedItem";
import { FaqAccordion } from "@/components/landing/FaqAccordion";
import { Reveal } from "@/components/landing/Reveal";

type Tone = "terra" | "ink" | "sage" | "water" | "ochre";

const TONE_BG: Record<Tone, string> = {
  terra: "bg-foyer-terra",
  ink: "bg-foyer-ink",
  sage: "bg-foyer-sage",
  water: "bg-foyer-water",
  ochre: "bg-foyer-ochre",
};

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

const DIFFERENCES: {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  description: string;
}[] = [
  {
    icon: ImageIcon,
    tone: "terra",
    title: "Des rendus réels",
    description:
      "Le rendu tient compte de votre pièce. Chaque élément est sourcé et achetable.",
  },
  {
    icon: Compass,
    tone: "ink",
    title: "Une conception guidée",
    description:
      "Choix du style, ajustements, validation. Vous n'êtes pas seul devant une page blanche.",
  },
  {
    icon: ShoppingBag,
    tone: "sage",
    title: "Une liste d'achat réelle",
    description:
      "On vous indique où acheter chaque pièce, au meilleur compromis prix/durabilité.",
  },
  {
    icon: Leaf,
    tone: "water",
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

const PARTNERS: { title: string; promise: string; examples: string; tone: Tone }[] = [
  {
    title: "Enseignes fournitures",
    promise:
      "Captez le flux IA-design en France. Co-investissement, exclu catégorie, données agrégées.",
    examples: "Leroy Merlin, Castorama, ManoMano",
    tone: "ochre",
  },
  {
    title: "Marketplaces seconde main",
    promise:
      "Augmentez la visibilité de vos vendeurs auprès d'acheteurs en projet déco qualifié.",
    examples: "Leboncoin, Vinted, Selency",
    tone: "sage",
  },
  {
    title: "Enseignes mobilier durable",
    promise: "Touchez des acheteurs qui achètent moins, mais durable.",
    examples: "Maisons du Monde, La Redoute, Tikamoon",
    tone: "water",
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
      <header className="sticky top-0 z-30 border-b border-foyer-border/60 bg-foyer-cream/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="font-serif text-xl tracking-tight text-foyer-ink"
          >
            Foyer
          </Link>
          <nav className="flex items-center gap-5 text-[14px] text-foyer-muted">
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
              className="rounded-full bg-foyer-terra-deep px-4 py-1.5 font-medium text-white transition-transform hover:-translate-y-0.5"
            >
              Lancer
            </Link>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 top-10 size-[420px] rounded-full bg-foyer-water/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-1/2 size-72 rounded-full bg-foyer-ochre/15 blur-3xl"
        />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-16 pt-16 md:grid-cols-[1.05fr_1fr] md:pb-24 md:pt-24">
          <div>
            <Reveal>
              <p className="inline-flex items-center gap-2.5 text-[12px] font-medium uppercase tracking-[0.16em] text-foyer-ink">
                <span className="size-2 bg-foyer-sage" aria-hidden />
                Conception déco · sourcing éco
              </p>
            </Reveal>
            <Reveal delay={70}>
              <h1 className="mt-6 font-serif text-[42px] font-medium leading-[1] tracking-[-0.025em] text-foyer-ink md:text-[72px]">
                Une pièce transformée.
                <br />
                <span className="text-foyer-sage">Une empreinte préservée.</span>
              </h1>
            </Reveal>
            <Reveal delay={140}>
              <p className="mt-6 max-w-md text-[18px] leading-[1.55] text-foyer-muted">
                Un bel intérieur, sans que cela soit aux dépens de la planète.
              </p>
            </Reveal>
            <Reveal delay={210}>
              <div className="mt-8 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
                <Button
                  render={<Link href="/demo" />}
                  size="lg"
                  className="h-12 w-full rounded-full bg-foyer-terra-deep px-7 text-white transition-transform hover:-translate-y-0.5 hover:bg-foyer-terra-deep/90 sm:w-auto"
                >
                  Lancer ma transformation
                </Button>
                <Link
                  href="#process"
                  className="group inline-flex items-center gap-1.5 text-[15px] font-medium text-foyer-ink"
                >
                  Voir comment ça marche
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </div>
            </Reveal>
            <Reveal delay={280}>
              <ul className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px] text-foyer-muted">
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
            </Reveal>
          </div>

          <Reveal delay={160} className="relative">
            {/* Bloc sage en décor derrière le slider */}
            <div
              aria-hidden
              className="absolute -inset-2 translate-x-3 translate-y-3 rounded-[28px] bg-foyer-sage/20"
            />
            <div className="relative">
              <BeforeAfterSlider
                beforeUrl="/landing/before.jpg"
                afterUrl="/landing/after.jpg"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* MANIFESTE — bloc soft sage, timeline éco */}
      <section className="relative bg-foyer-water/15">
        <div className="mx-auto w-full max-w-6xl px-6 py-24 md:py-32">
          <Reveal>
            <SectionTag tone="sage" icon={Leaf} label="Notre parti pris" index="01" />
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-6 max-w-3xl font-serif text-[32px] font-medium leading-[1.05] tracking-[-0.015em] text-foyer-ink md:text-[56px]">
              Avant de proposer du neuf,
              <br className="hidden md:block" /> on regarde ce que vous avez
              déjà.
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-foyer-muted">
              Un canapé peut être recouvert. Une commode repeinte. Quand il faut
              acheter, on commence par la seconde main. Et si on doit prendre du
              neuf, on vous oriente vers ce qui dure.
            </p>
          </Reveal>

          {/* Timeline éco — 3 étapes connectées */}
          <div className="relative mt-16">
            <div
              aria-hidden
              className="pointer-events-none absolute left-7 right-7 top-7 hidden h-px bg-gradient-to-r from-foyer-sage/30 via-foyer-sage to-foyer-sage/30 md:block"
            />
            <div className="grid gap-12 md:grid-cols-3 md:gap-8">
              {ECO_STEPS.map((step, i) => (
                <Reveal key={step.number} delay={i * 110} className="relative">
                  <div className="relative flex size-14 items-center justify-center rounded-full bg-foyer-sage font-serif text-xl text-foyer-cream ring-8 ring-foyer-water/15">
                    {step.number}
                  </div>
                  <h3 className="mt-6 font-serif text-[22px] leading-snug text-foyer-ink">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-foyer-muted">
                    {step.description}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal delay={300}>
            <p className="mt-12 max-w-2xl text-[13px] leading-relaxed text-foyer-muted/80">
              <span className="font-medium text-foyer-ink">Score Foyer</span> —
              chaque projet est mesuré selon sa part de mobilier conservé,
              occasion et neuf, et son équivalent CO₂ évité. Méthodologie sourcée
              ADEME.
            </p>
          </Reveal>
        </div>
      </section>

      {/* PROCESS — chapitrage avec gros numéros terra */}
      <section id="process" className="scroll-mt-24">
        <div className="mx-auto w-full max-w-6xl px-6 py-24 md:py-32">
          <Reveal>
            <SectionTag tone="terra" label="Comment ça marche" index="02" />
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-6 max-w-3xl font-serif text-[32px] font-medium leading-[1.05] tracking-[-0.015em] text-foyer-ink md:text-[56px]">
              On vous accompagne de la photo au montage.
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-foyer-muted">
              4 étapes simples. Pas de logiciel à maîtriser.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {PROCESS_STEPS.map((step, i) => (
              <Reveal key={step.number} delay={i * 80}>
                <div className="group flex h-full flex-col rounded-2xl border border-foyer-border bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-foyer-terra-deep/30 hover:shadow-sm">
                  <div className="flex items-baseline gap-3">
                    <span className="font-serif text-[44px] leading-none text-foyer-terra-deep">
                      {step.number}
                    </span>
                    <span
                      className="h-px flex-1 bg-foyer-border transition-colors group-hover:bg-foyer-terra-deep/40"
                      aria-hidden
                    />
                  </div>
                  <h3 className="mt-6 font-serif text-[20px] leading-snug text-foyer-ink">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-foyer-muted">
                    {step.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* DIFFÉRENCIATEURS — grille 2x2 avec accent coloré par tonalité */}
      <section className="bg-foyer-cream">
        <div className="mx-auto w-full max-w-6xl px-6 pb-24 md:pb-32">
          <Reveal>
            <SectionTag tone="ink" label="La différence Foyer" index="03" />
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-6 max-w-3xl font-serif text-[32px] font-medium leading-[1.05] tracking-[-0.015em] text-foyer-ink md:text-[56px]">
              On ne fait pas que générer des rendus.
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-foyer-muted">
              Tout ce que vous voyez existe. Et on vous dit où le trouver.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-5 md:grid-cols-2">
            {DIFFERENCES.map((diff, i) => {
              const Icon = diff.icon;
              return (
                <Reveal key={diff.title} delay={i * 80}>
                  <div className="group relative h-full overflow-hidden rounded-2xl border border-foyer-border bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-foyer-ink/15 hover:shadow-sm">
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-x-0 top-0 h-1 transition-all duration-300 group-hover:h-1.5",
                        TONE_BG[diff.tone],
                      )}
                    />
                    <Icon
                      className="size-7 text-foyer-ink"
                      strokeWidth={1.4}
                      aria-hidden
                    />
                    <h3 className="mt-6 font-serif text-[22px] leading-snug text-foyer-ink">
                      {diff.title}
                    </h3>
                    <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-foyer-muted">
                      {diff.description}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* BEFORE / AFTER — moment visuel central */}
      <section className="bg-foyer-cream">
        <div className="mx-auto w-full max-w-6xl px-6 pb-24 md:pb-32">
          <Reveal>
            <SectionTag tone="water" label="Du rendu à l'achat" index="04" />
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-6 max-w-3xl font-serif text-[32px] font-medium leading-[1.05] tracking-[-0.015em] text-foyer-ink md:text-[56px]">
              Ce que vous voyez, vous pouvez l&apos;avoir.
            </h2>
          </Reveal>

          <div className="mt-14 grid gap-12 md:grid-cols-2 md:items-start">
            <Reveal className="relative">
              <div
                aria-hidden
                className="absolute -inset-2 translate-x-3 translate-y-3 rounded-[28px] bg-foyer-water/30"
              />
              <div className="relative">
                <BeforeAfterSlider
                  beforeUrl="/landing/before.jpg"
                  afterUrl="/landing/after.jpg"
                />
              </div>
            </Reveal>
            <Reveal delay={140}>
              <ul>
                {SOURCED_ITEMS.map((item) => (
                  <SourcedItem key={item.name} {...item} />
                ))}
              </ul>
              <p className="mt-6 max-w-prose text-[15px] leading-relaxed text-foyer-muted">
                Chaque élément est sourcé. Vous savez exactement où acheter, et
                à quel prix.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* IA — moment quote */}
      <section className="bg-foyer-cream">
        <div className="mx-auto w-full max-w-4xl px-6 pb-24 md:pb-32">
          <Reveal>
            <SectionTag tone="ink" label="Transparence" index="05" />
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-6 font-serif text-[32px] font-medium leading-[1.05] tracking-[-0.015em] text-foyer-ink md:text-[52px]">
              On utilise l&apos;IA. Mais ce n&apos;est qu&apos;un outil.
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-8 text-[19px] leading-[1.65] text-foyer-muted">
              L&apos;intelligence artificielle nous sert à générer des rendus de
              votre pièce transformée, et à retrouver des meubles
              d&apos;occasion qui correspondent visuellement à ce qu&apos;on
              vous propose. Le reste — la sélection des partenaires, le choix
              des matériaux, la préparation des listes — est pensé par notre
              équipe.{" "}
              <span className="font-medium text-foyer-ink">
                L&apos;IA pour aller vite, l&apos;humain pour aller juste.
              </span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* B2B */}
      <section id="partenaires" className="scroll-mt-24 bg-foyer-cream">
        <div className="mx-auto w-full max-w-6xl px-6 pb-24 md:pb-32">
          <Reveal>
            <SectionTag tone="ochre" label="Partenaires" index="06" />
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-6 max-w-3xl font-serif text-[32px] font-medium leading-[1.05] tracking-[-0.015em] text-foyer-ink md:text-[56px]">
              Et si Foyer devenait votre canal d&apos;acquisition&nbsp;?
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-foyer-muted">
              Un nouveau front-end IA pour les enseignes déco, fournitures et
              seconde main qui veulent capter le flux IA-design avant
              qu&apos;il ne devienne dominant.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {PARTNERS.map((p, i) => (
              <Reveal key={p.title} delay={i * 100}>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-foyer-border bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-foyer-ink/15 hover:shadow-sm">
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-x-0 top-0 h-1 transition-all duration-300 group-hover:h-1.5",
                      TONE_BG[p.tone],
                    )}
                  />
                  <h3 className="font-serif text-[20px] leading-snug text-foyer-ink">
                    {p.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-foyer-muted">
                    {p.promise}
                  </p>
                  <p className="mt-5 text-[13px] text-foyer-muted">
                    <span className="text-foyer-ink/70">ex.</span> {p.examples}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={300}>
            <Link
              href="mailto:contact@foyer.app"
              className="group mt-10 inline-flex items-center gap-2 rounded-full bg-foyer-ink px-6 py-3 text-[15px] font-medium text-foyer-cream transition-transform hover:-translate-y-0.5"
            >
              Discuter d&apos;un partenariat
              <ArrowUpRight
                className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-foyer-cream">
        <div className="mx-auto w-full max-w-4xl px-6 pb-24 md:pb-32">
          <Reveal>
            <SectionTag tone="ink" label="FAQ" index="07" />
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-6 font-serif text-[32px] font-medium leading-[1.05] tracking-[-0.015em] text-foyer-ink md:text-[52px]">
              Questions fréquentes.
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <div className="mt-10">
              <FaqAccordion items={FAQ} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* FOOTER — clôture sombre */}
      <footer className="bg-foyer-ink text-foyer-cream">
        <div className="mx-auto w-full max-w-6xl px-6 py-14">
          <div className="grid gap-12 md:grid-cols-4">
            <div>
              <span className="font-serif text-xl tracking-tight text-foyer-cream">
                Foyer
              </span>
              <p className="mt-3 text-[13px] text-foyer-cream/55">
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
          <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-foyer-cream/15 pt-6 text-[13px] text-foyer-cream/55 sm:flex-row sm:items-center">
            <span>© {new Date().getFullYear()} Foyer</span>
            <div className="flex items-center gap-6">
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

function SectionTag({
  index,
  label,
  tone,
  icon: Icon,
}: {
  index: string;
  label: string;
  tone: Tone;
  icon?: LucideIcon;
}) {
  return (
    <p className="inline-flex items-center gap-3 text-[12px] font-medium uppercase tracking-[0.16em] text-foyer-ink">
      <span
        className={cn("size-2.5 shrink-0", TONE_BG[tone])}
        aria-hidden
      />
      <span className="font-serif normal-case tracking-normal text-foyer-muted">
        {index}
      </span>
      {Icon && <Icon className="size-3.5 text-foyer-sage" strokeWidth={1.6} aria-hidden />}
      {label}
    </p>
  );
}

function FooterColumn({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h3 className="text-[12px] font-medium uppercase tracking-[0.14em] text-foyer-cream">
        {title}
      </h3>
      <ul className="mt-4 space-y-2.5 text-[14px] text-foyer-cream/55">
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
