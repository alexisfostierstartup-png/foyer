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
  title: string;
  description: string;
}[] = [
  {
    icon: ImageIcon,
    title: "Des rendus réels",
    description:
      "Le rendu tient compte de votre pièce. Chaque élément est sourcé et achetable.",
  },
  {
    icon: Compass,
    title: "Une conception guidée",
    description:
      "Choix du style, ajustements, validation. Vous n'êtes pas seul devant une page blanche.",
  },
  {
    icon: ShoppingBag,
    title: "Une liste d'achat réelle",
    description:
      "On vous indique où acheter chaque pièce, au meilleur compromis prix/durabilité.",
  },
  {
    icon: Leaf,
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
      <header className="sticky top-0 z-30 border-b border-foyer-border/60 bg-foyer-cream/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="font-serif text-xl tracking-tight text-foyer-ink"
          >
            Foyer
          </Link>
          <nav className="flex items-center gap-6 text-[14px] text-foyer-muted">
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
              className="rounded-full bg-foyer-ink px-4 py-1.5 text-foyer-cream transition-colors hover:bg-foyer-ink/85"
            >
              Lancer
            </Link>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto w-full max-w-6xl px-6 pt-16 md:pt-24">
        <div className="grid items-end gap-12 md:grid-cols-12">
          <div className="md:col-span-7">
            <Reveal>
              <p className="flex items-center gap-2.5 text-[12px] uppercase tracking-[0.16em] text-foyer-muted">
                <span className="size-1 rounded-full bg-foyer-ink" aria-hidden />
                Conception déco · sourcing éco
              </p>
            </Reveal>
            <Reveal delay={60}>
              <h1 className="mt-6 font-serif text-[40px] font-medium leading-[0.98] tracking-[-0.025em] text-foyer-ink md:text-[76px]">
                Une pièce transformée. Une empreinte préservée.
              </h1>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-7 max-w-md text-[18px] leading-[1.55] text-foyer-muted">
                Un bel intérieur, sans que cela soit aux dépens de la planète.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <div className="mt-9 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
                <Button
                  render={<Link href="/demo" />}
                  size="lg"
                  className="h-12 w-full rounded-full bg-foyer-terra-deep px-6 text-white hover:bg-foyer-terra-deep/90 sm:w-auto"
                >
                  Lancer ma transformation
                </Button>
                <Link
                  href="#process"
                  className="group inline-flex items-center gap-1.5 text-[15px] text-foyer-ink"
                >
                  Voir comment ça marche
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </div>
            </Reveal>
          </div>
          <Reveal delay={140} className="md:col-span-5">
            <BeforeAfterSlider
              beforeUrl="/landing/before.jpg"
              afterUrl="/landing/after.jpg"
            />
          </Reveal>
        </div>
        <Reveal delay={240}>
          <ul className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-foyer-border/60 pt-6 text-[13px] text-foyer-muted">
            <li>1 premier rendu offert</li>
            <li className="text-foyer-border" aria-hidden>·</li>
            <li>Sans abonnement</li>
            <li className="text-foyer-border" aria-hidden>·</li>
            <li>Conçu en France</li>
          </ul>
        </Reveal>
      </section>

      {/* MANIFESTE — moment éditorial */}
      <section className="mx-auto w-full max-w-6xl px-6 py-28 md:py-40">
        <div className="grid gap-12 md:grid-cols-12">
          <Reveal className="md:col-span-3">
            <Eyebrow index="01" label="Notre parti pris" />
          </Reveal>
          <div className="md:col-span-9">
            <Reveal>
              <h2 className="font-serif text-[30px] font-medium leading-[1.05] tracking-[-0.015em] text-foyer-ink md:text-[52px]">
                Avant de proposer du neuf, on regarde ce que vous avez déjà.
              </h2>
            </Reveal>
            <Reveal delay={80}>
              <p className="mt-6 max-w-2xl text-[18px] leading-[1.6] text-foyer-muted">
                Un canapé peut être recouvert. Une commode repeinte. Quand il
                faut acheter, on commence par la seconde main. Et si on doit
                prendre du neuf, on vous oriente vers ce qui dure.
              </p>
            </Reveal>
            <div className="mt-16 grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-foyer-border">
              {ECO_STEPS.map((step, i) => (
                <Reveal
                  key={step.number}
                  delay={i * 80}
                  className={cn(
                    "md:px-8",
                    "md:first:pl-0",
                    "md:last:pr-0",
                  )}
                >
                  <p className="font-serif text-[15px] text-foyer-muted">
                    {step.number}
                  </p>
                  <h3 className="mt-2 font-serif text-[22px] leading-snug text-foyer-ink">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-foyer-muted">
                    {step.description}
                  </p>
                </Reveal>
              ))}
            </div>
            <Reveal delay={200}>
              <p className="mt-12 max-w-2xl text-[13px] leading-relaxed text-foyer-muted/80">
                Score Foyer — chaque projet est mesuré selon sa part de mobilier
                conservé, occasion et neuf, et son équivalent CO₂ évité.
                Méthodologie sourcée ADEME.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* PROCESS — chapitrage numéroté */}
      <section
        id="process"
        className="scroll-mt-24 border-t border-foyer-border/60"
      >
        <div className="mx-auto w-full max-w-6xl px-6 py-24 md:py-32">
          <div className="grid gap-12 md:grid-cols-12">
            <Reveal className="md:col-span-3">
              <Eyebrow index="02" label="Comment ça marche" />
            </Reveal>
            <div className="md:col-span-9">
              <Reveal>
                <h2 className="font-serif text-[30px] font-medium leading-[1.05] tracking-[-0.015em] text-foyer-ink md:text-[52px]">
                  On vous accompagne de la photo au montage.
                </h2>
              </Reveal>
              <Reveal delay={80}>
                <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-foyer-muted">
                  4 étapes simples. Pas de logiciel à maîtriser.
                </p>
              </Reveal>
              <div className="mt-16 divide-y divide-foyer-border">
                {PROCESS_STEPS.map((step, i) => (
                  <Reveal key={step.number} delay={i * 60}>
                    <div className="grid gap-2 py-8 md:grid-cols-[88px_1fr] md:gap-12 md:py-10">
                      <p className="font-serif text-[44px] leading-none text-foyer-muted/70 md:text-[56px]">
                        {step.number}
                      </p>
                      <div>
                        <h3 className="font-serif text-[22px] leading-snug text-foyer-ink md:text-[26px]">
                          {step.title}
                        </h3>
                        <p className="mt-3 max-w-prose text-[16px] leading-relaxed text-foyer-muted">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DIFFÉRENCIATEURS — grille calme */}
      <section className="border-t border-foyer-border/60">
        <div className="mx-auto w-full max-w-6xl px-6 py-24 md:py-32">
          <div className="grid gap-12 md:grid-cols-12">
            <Reveal className="md:col-span-3">
              <Eyebrow index="03" label="La différence Foyer" />
            </Reveal>
            <div className="md:col-span-9">
              <Reveal>
                <h2 className="font-serif text-[30px] font-medium leading-[1.05] tracking-[-0.015em] text-foyer-ink md:text-[52px]">
                  On ne fait pas que générer des rendus.
                </h2>
              </Reveal>
              <Reveal delay={80}>
                <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-foyer-muted">
                  Tout ce que vous voyez existe. Et on vous dit où le trouver.
                </p>
              </Reveal>
              <div className="mt-16 grid gap-y-14 md:grid-cols-2 md:gap-x-16 md:gap-y-16">
                {DIFFERENCES.map((diff, i) => {
                  const Icon = diff.icon;
                  return (
                    <Reveal key={diff.title} delay={i * 60}>
                      <Icon
                        className="size-5 text-foyer-ink"
                        strokeWidth={1.4}
                        aria-hidden
                      />
                      <h3 className="mt-5 font-serif text-[22px] leading-snug text-foyer-ink md:text-[26px]">
                        {diff.title}
                      </h3>
                      <p className="mt-3 max-w-prose text-[16px] leading-relaxed text-foyer-muted">
                        {diff.description}
                      </p>
                    </Reveal>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BEFORE / AFTER — moment photographique */}
      <section className="border-t border-foyer-border/60">
        <div className="mx-auto w-full max-w-6xl px-6 py-24 md:py-32">
          <div className="grid gap-12 md:grid-cols-12">
            <Reveal className="md:col-span-3">
              <Eyebrow index="04" label="Du rendu à l'achat" />
            </Reveal>
            <div className="md:col-span-9">
              <Reveal>
                <h2 className="font-serif text-[30px] font-medium leading-[1.05] tracking-[-0.015em] text-foyer-ink md:text-[52px]">
                  Ce que vous voyez dans le rendu.
                </h2>
              </Reveal>
              <div className="mt-12 grid gap-12 md:grid-cols-2">
                <Reveal>
                  <BeforeAfterSlider
                    beforeUrl="/landing/before.jpg"
                    afterUrl="/landing/after.jpg"
                  />
                </Reveal>
                <Reveal delay={120}>
                  <ul>
                    {SOURCED_ITEMS.map((item) => (
                      <SourcedItem key={item.name} {...item} />
                    ))}
                  </ul>
                  <p className="mt-6 max-w-prose text-[15px] leading-relaxed text-foyer-muted">
                    Chaque élément est sourcé. Vous savez exactement où acheter,
                    et à quel prix.
                  </p>
                </Reveal>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* IA — long format */}
      <section className="border-t border-foyer-border/60">
        <div className="mx-auto w-full max-w-6xl px-6 py-24 md:py-32">
          <div className="grid gap-12 md:grid-cols-12">
            <Reveal className="md:col-span-3">
              <Eyebrow index="05" label="Transparence" />
            </Reveal>
            <div className="md:col-span-9">
              <Reveal>
                <h2 className="max-w-3xl font-serif text-[30px] font-medium leading-[1.05] tracking-[-0.015em] text-foyer-ink md:text-[52px]">
                  On utilise l&apos;IA. Mais ce n&apos;est qu&apos;un outil.
                </h2>
              </Reveal>
              <Reveal delay={80}>
                <p className="mt-8 max-w-2xl text-[18px] leading-[1.65] text-foyer-muted">
                  L&apos;intelligence artificielle nous sert à générer des
                  rendus de votre pièce transformée, et à retrouver des meubles
                  d&apos;occasion qui correspondent visuellement à ce
                  qu&apos;on vous propose. Le reste — la sélection des
                  partenaires, le choix des matériaux, la préparation des listes
                  — est pensé par notre équipe.{" "}
                  <span className="text-foyer-ink">
                    L&apos;IA pour aller vite, l&apos;humain pour aller juste.
                  </span>
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* B2B */}
      <section
        id="partenaires"
        className="scroll-mt-24 border-t border-foyer-border/60"
      >
        <div className="mx-auto w-full max-w-6xl px-6 py-24 md:py-32">
          <div className="grid gap-12 md:grid-cols-12">
            <Reveal className="md:col-span-3">
              <Eyebrow index="06" label="Partenaires" />
            </Reveal>
            <div className="md:col-span-9">
              <Reveal>
                <h2 className="max-w-3xl font-serif text-[30px] font-medium leading-[1.05] tracking-[-0.015em] text-foyer-ink md:text-[52px]">
                  Et si Foyer devenait votre canal d&apos;acquisition ?
                </h2>
              </Reveal>
              <Reveal delay={80}>
                <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-foyer-muted">
                  Un nouveau front-end IA pour les enseignes déco, fournitures
                  et seconde main qui veulent capter le flux IA-design avant
                  qu&apos;il ne devienne dominant.
                </p>
              </Reveal>
              <div className="mt-16 grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-foyer-border">
                {PARTNERS.map((p, i) => (
                  <Reveal
                    key={p.title}
                    delay={i * 80}
                    className={cn("md:px-8", "md:first:pl-0", "md:last:pr-0")}
                  >
                    <h3 className="font-serif text-[20px] leading-snug text-foyer-ink">
                      {p.title}
                    </h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-foyer-muted">
                      {p.promise}
                    </p>
                    <p className="mt-5 text-[13px] text-foyer-muted">
                      <span className="text-foyer-ink/70">ex.</span>{" "}
                      {p.examples}
                    </p>
                  </Reveal>
                ))}
              </div>
              <Reveal delay={200}>
                <Link
                  href="mailto:contact@foyer.app"
                  className="group mt-12 inline-flex items-center gap-2 border-b border-foyer-ink/40 pb-1 text-[15px] text-foyer-ink"
                >
                  Discuter d&apos;un partenariat
                  <ArrowUpRight
                    className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-foyer-border/60">
        <div className="mx-auto w-full max-w-6xl px-6 py-24 md:py-32">
          <div className="grid gap-12 md:grid-cols-12">
            <Reveal className="md:col-span-3">
              <Eyebrow index="07" label="FAQ" />
            </Reveal>
            <div className="md:col-span-9">
              <Reveal>
                <h2 className="font-serif text-[30px] font-medium leading-[1.05] tracking-[-0.015em] text-foyer-ink md:text-[52px]">
                  Questions fréquentes.
                </h2>
              </Reveal>
              <Reveal delay={80}>
                <div className="mt-10">
                  <FaqAccordion items={FAQ} />
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-foyer-border/60">
        <div className="mx-auto w-full max-w-6xl px-6 py-14">
          <div className="grid gap-12 md:grid-cols-4">
            <div>
              <span className="font-serif text-xl tracking-tight text-foyer-ink">
                Foyer
              </span>
              <p className="mt-3 text-[13px] text-foyer-muted">
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
          <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-foyer-border/60 pt-6 text-[13px] text-foyer-muted sm:flex-row sm:items-center">
            <span>© {new Date().getFullYear()} Foyer</span>
            <div className="flex items-center gap-6">
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

function Eyebrow({ index, label }: { index: string; label: string }) {
  return (
    <p className="text-[12px] uppercase tracking-[0.16em] text-foyer-muted">
      <span className="font-serif normal-case tracking-normal text-foyer-ink">
        {index}
      </span>
      <span className="mx-2 text-foyer-border" aria-hidden>
        /
      </span>
      {label}
    </p>
  );
}

function FooterColumn({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h3 className="text-[12px] font-medium uppercase tracking-[0.14em] text-foyer-ink">
        {title}
      </h3>
      <ul className="mt-4 space-y-2.5 text-[14px] text-foyer-muted">
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
