import { Fragment } from "react";
import Link from "next/link";
import {
  Camera,
  Sparkles,
  Ruler,
  ShoppingBag,
  Recycle,
  Search,
  Leaf,
  Store,
  Tag,
  Building2,
  Check,
  Minus,
  ArrowRight,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BeforeAfterSlider } from "@/components/landing/BeforeAfterSlider";
import { FaqAccordion } from "@/components/landing/FaqAccordion";
import { Reveal } from "@/components/landing/Reveal";

type Tone = "sage" | "terra" | "ink" | "water" | "mousse";

const ICON_BG: Record<Tone, string> = {
  sage: "bg-foyer-sage/15",
  terra: "bg-foyer-terra-deep/12",
  ink: "bg-foyer-ink/8",
  water: "bg-foyer-water/30",
  mousse: "bg-foyer-mousse/15",
};

const ICON_COLOR: Record<Tone, string> = {
  sage: "text-foyer-sage",
  terra: "text-foyer-terra-deep",
  ink: "text-foyer-ink",
  water: "text-foyer-sage",
  mousse: "text-foyer-mousse",
};

const SOLID_BG: Record<"sage" | "terra" | "water", string> = {
  sage: "bg-foyer-sage",
  terra: "bg-foyer-terra-deep",
  water: "bg-foyer-water",
};

const ECO_STEPS: { number: string; title: string; description: string; icon: LucideIcon; tone: Tone }[] = [
  { number: "01", title: "D'abord, on réutilise", description: "Homestaging et customisation de vos meubles.", icon: Recycle, tone: "sage" },
  { number: "02", title: "Ensuite, on cherche d'occasion", description: "Sourcing seconde main depuis les plateformes que vous utilisez déjà.", icon: Search, tone: "mousse" },
  { number: "03", title: "En dernier, du neuf qui dure", description: "Conseil matériaux et marques. Ce qui tient dix ans, pas trois.", icon: Leaf, tone: "water" },
];

const PROCESS_STEPS: { number: string; title: string; description: string; icon: LucideIcon; tone: Tone }[] = [
  { number: "01", title: "Vous photographiez", description: "Une photo suffit. Pas besoin de mesurer.", icon: Camera, tone: "ink" },
  { number: "02", title: "On imagine avec vous", description: "Choisissez un style, on génère, vous ajustez.", icon: Sparkles, tone: "terra" },
  { number: "03", title: "On vérifie les dimensions", description: "Une mesure rapide, on adapte aux vraies cotes.", icon: Ruler, tone: "sage" },
  { number: "04", title: "On dit où tout acheter", description: "Chaque élément est sourcé, marchand et prix.", icon: ShoppingBag, tone: "mousse" },
];

const COMPARE_ROWS: { criterion: string; ia: boolean; foyer: boolean }[] = [
  { criterion: "Rendu réaliste de votre pièce", ia: true, foyer: true },
  { criterion: "Préserve votre mobilier existant", ia: false, foyer: true },
  { criterion: "Liste d'achat sourcée et chiffrée", ia: false, foyer: true },
  { criterion: "Priorité seconde main", ia: false, foyer: true },
  { criterion: "Conception guidée étape par étape", ia: false, foyer: true },
  { criterion: "Bilan carbone du projet (ADEME)", ia: false, foyer: true },
  { criterion: "Achat consolidé chez peu d'enseignes", ia: false, foyer: true },
];

const PARTNERS: { icon: LucideIcon; tone: Tone; title: string; promise: string; examples: string }[] = [
  { icon: Building2, tone: "mousse", title: "Enseignes fournitures", promise: "Captez le flux IA-design en France.", examples: "Leroy Merlin, Castorama, ManoMano" },
  { icon: Tag, tone: "sage", title: "Marketplaces seconde main", promise: "Augmentez la visibilité de vos vendeurs.", examples: "Leboncoin, Vinted, Selency" },
  { icon: Store, tone: "water", title: "Enseignes mobilier durable", promise: "Touchez des acheteurs qui achètent moins, mais durable.", examples: "Maisons du Monde, La Redoute, Tikamoon" },
];

const FAQ = [
  { question: "Combien ça coûte ?", answer: "Le premier rendu est offert. Ensuite des crédits à partir de 4,99 €. Pas d'abonnement." },
  { question: "Est-ce que vous remplacez tout mon mobilier ?", answer: "Non, on propose systématiquement de garder ce qui peut l'être. C'est notre angle de départ." },
  { question: "Comment trouvez-vous les meubles d'occasion ?", answer: "On scanne Leboncoin et Vinted Maison, et on propose ce qui correspond visuellement au rendu." },
  { question: "Et si je ne suis pas content du rendu ?", answer: "Vous pouvez itérer (changer de style, ajuster). Si vraiment ça ne va pas, on rembourse le crédit." },
  { question: "Comment se passe l'achat ?", answer: "On vous indique où acheter chaque élément, avec les liens. Vous achetez directement chez chaque marchand." },
  { question: "C'est dispo où ?", answer: "France pour le moment. Europe à venir." },
];

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col bg-foyer-cream">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-foyer-border/40 bg-foyer-cream/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="font-serif text-xl tracking-tight text-foyer-ink">Foyer</Link>
          <nav className="flex items-center gap-6 text-[14px] text-foyer-muted">
            <Link href="#process" className="hidden hover:text-foyer-ink sm:inline">Comment ça marche</Link>
            <Link href="#partenaires" className="hidden hover:text-foyer-ink sm:inline">Partenaires</Link>
            <Link href="/demo" className="rounded-full bg-foyer-ink px-4 py-1.5 font-medium text-foyer-cream transition-colors hover:bg-foyer-ink/85">Lancer</Link>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_85%_15%,rgba(165,184,160,0.22),transparent_60%)]" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pt-14 pb-16 md:pt-20 md:pb-20">
          <div className="grid items-center gap-12 md:grid-cols-12 md:gap-10">
            <div className="md:col-span-5">
              <Reveal>
                <p className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-foyer-sage">
                  <Leaf className="size-3.5" strokeWidth={2.2} aria-hidden />
                  Conception déco · sourcing éco
                </p>
              </Reveal>
              <Reveal delay={70}>
                <h1 className="mt-5 font-serif text-[42px] font-medium leading-[0.96] tracking-[-0.03em] text-foyer-ink md:text-[60px] lg:text-[72px]">
                  Une pièce transformée. Une empreinte préservée.
                </h1>
              </Reveal>
              <Reveal delay={140}>
                <p className="mt-6 max-w-md text-[18px] leading-[1.55] text-foyer-muted">
                  Un bel intérieur, sans que cela soit aux dépens de la planète.
                </p>
              </Reveal>
              <Reveal delay={210}>
                <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                  <Button render={<Link href="/demo" />} size="lg" className="h-12 w-full rounded-full bg-foyer-terra-deep px-7 text-white transition-transform hover:-translate-y-0.5 hover:bg-foyer-terra-deep/90 sm:w-auto">
                    Lancer ma transformation
                  </Button>
                  <Link href="#process" className="group inline-flex h-12 items-center gap-1.5 rounded-full border border-foyer-border bg-white px-5 text-[15px] font-medium text-foyer-ink transition-colors hover:border-foyer-ink/30">
                    Comment ça marche
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </div>
              </Reveal>
            </div>
            <Reveal delay={160} className="md:col-span-7">
              <div className="overflow-hidden rounded-3xl shadow-[0_24px_60px_rgba(31,27,22,0.10),0_0_0_1px_rgba(31,27,22,0.04)]">
                <BeforeAfterSlider beforeUrl="/landing/before.jpg" afterUrl="/landing/after.jpg" />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* STATS — card asymétrique */}
      <section className="bg-foyer-cream">
        <div className="mx-auto w-full max-w-6xl px-6 pb-16 md:pb-20">
          <Reveal>
            <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-foyer-border/50 shadow-[0_8px_40px_rgba(31,27,22,0.06)]">
              <div className="grid divide-foyer-border/40 md:grid-cols-[1.4fr_1fr_1fr] md:divide-x">
                <div className="px-7 py-8 md:px-10 md:py-10">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foyer-sage">Empreinte</p>
                  <p className="mt-3 font-serif text-[68px] font-medium leading-[0.9] tracking-[-0.04em] text-foyer-ink md:text-[88px]">
                    60<span className="text-foyer-sage">%</span>
                  </p>
                  <p className="mt-3 text-[14px] leading-snug text-foyer-muted">mobilier conservé en moyenne sur un projet Foyer</p>
                </div>
                <div className="border-t border-foyer-border/40 px-7 py-8 md:border-t-0 md:px-8 md:py-10">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foyer-muted">Bilan carbone</p>
                  <p className="mt-3 font-serif text-[44px] font-medium leading-[0.9] tracking-[-0.03em] text-foyer-ink md:text-[56px]">42 kg</p>
                  <p className="mt-3 text-[13px] leading-snug text-foyer-muted">CO₂ évités par projet, base ADEME</p>
                </div>
                <div className="border-t border-foyer-border/40 px-7 py-8 md:border-t-0 md:px-8 md:py-10">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foyer-muted">Logistique</p>
                  <p className="mt-3 font-serif text-[44px] font-medium leading-[0.9] tracking-[-0.03em] text-foyer-ink md:text-[56px]">5 max</p>
                  <p className="mt-3 text-[13px] leading-snug text-foyer-muted">enseignes par projet, livraisons groupées</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* MANIFESTE — DONUT + steps verticaux (pas de photo, c'est la proposition éco) */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <div className="grid gap-14 md:grid-cols-12 md:items-center md:gap-16">
            <div className="md:col-span-7">
              <Reveal>
                <p className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-foyer-sage">
                  <Leaf className="size-3.5" strokeWidth={2.2} aria-hidden />
                  Notre parti pris
                </p>
              </Reveal>
              <Reveal delay={70}>
                <h2 className="mt-4 font-serif text-[32px] font-medium leading-[1.02] tracking-[-0.02em] text-foyer-ink md:text-[48px]">
                  Avant de proposer du neuf, on regarde ce que vous avez déjà.
                </h2>
              </Reveal>
              <Reveal delay={140}>
                <p className="mt-5 text-[17px] leading-[1.6] text-foyer-muted">
                  Un canapé recouvert. Une commode repeinte. Quand il faut acheter, on commence par la seconde main.
                </p>
              </Reveal>
              <div className="mt-10 flex gap-6">
                <div aria-hidden className="relative w-[2px] shrink-0">
                  <span className="absolute inset-y-0 left-0 w-full bg-gradient-to-b from-foyer-sage via-foyer-sage to-foyer-sage/30" />
                </div>
                <ul className="space-y-7">
                  {ECO_STEPS.map((step, i) => {
                    const Icon = step.icon;
                    return (
                      <Reveal key={step.number} delay={180 + i * 80}>
                        <li className="flex gap-4">
                          <div className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-xl", ICON_BG[step.tone])}>
                            <Icon className={cn("size-5", ICON_COLOR[step.tone])} strokeWidth={1.6} aria-hidden />
                          </div>
                          <div>
                            <p className="font-serif text-[13px] text-foyer-muted">{step.number}</p>
                            <h3 className="font-serif text-[19px] leading-snug text-foyer-ink">{step.title}</h3>
                            <p className="mt-1 text-[14px] leading-relaxed text-foyer-muted">{step.description}</p>
                          </div>
                        </li>
                      </Reveal>
                    );
                  })}
                </ul>
              </div>
            </div>
            <Reveal delay={200} className="md:col-span-5">
              <EcoDonut />
            </Reveal>
          </div>
        </div>
      </section>

      {/* PROCESS — flow horizontal avec flèches (pas de grid de cartes) */}
      <section id="process" className="scroll-mt-24 bg-foyer-cream">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <Reveal>
            <p className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-foyer-terra-deep">
              <span className="size-1.5 rounded-full bg-foyer-terra-deep" aria-hidden />
              Comment ça marche
            </p>
          </Reveal>
          <Reveal delay={70}>
            <h2 className="mt-4 max-w-2xl font-serif text-[32px] font-medium leading-[1.02] tracking-[-0.02em] text-foyer-ink md:text-[44px]">
              De la photo au montage, en 4 étapes.
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-4 max-w-xl text-[17px] leading-[1.55] text-foyer-muted">
              Pas de logiciel à maîtriser. On fait le travail, vous validez à chaque étape.
            </p>
          </Reveal>

          {/* Desktop : flow horizontal */}
          <div className="mt-12 hidden md:flex md:items-stretch md:gap-3 lg:gap-5">
            {PROCESS_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <Fragment key={step.number}>
                  <Reveal delay={i * 80} className="flex-1">
                    <div className="group flex h-full flex-col p-5">
                      <div className={cn("inline-flex size-12 items-center justify-center rounded-xl transition-transform group-hover:scale-105", ICON_BG[step.tone])}>
                        <Icon className={cn("size-6", ICON_COLOR[step.tone])} strokeWidth={1.6} aria-hidden />
                      </div>
                      <p className="mt-5 font-serif text-[13px] text-foyer-muted">Étape {step.number}</p>
                      <h3 className="mt-1 font-serif text-[19px] leading-tight text-foyer-ink">{step.title}</h3>
                      <p className="mt-2 text-[14px] leading-relaxed text-foyer-muted">{step.description}</p>
                    </div>
                  </Reveal>
                  {i < PROCESS_STEPS.length - 1 && (
                    <div aria-hidden className="flex shrink-0 items-center pt-8">
                      <span className="inline-block h-px w-6 bg-foyer-border lg:w-10" />
                      <ArrowRight className="size-4 text-foyer-border" />
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>

          {/* Mobile : stack vertical avec connecteurs */}
          <ol className="mt-10 space-y-5 md:hidden">
            {PROCESS_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.number} className="relative">
                  <div className="flex gap-4">
                    <div className={cn("inline-flex size-12 shrink-0 items-center justify-center rounded-xl", ICON_BG[step.tone])}>
                      <Icon className={cn("size-6", ICON_COLOR[step.tone])} strokeWidth={1.6} aria-hidden />
                    </div>
                    <div>
                      <p className="font-serif text-[13px] text-foyer-muted">Étape {step.number}</p>
                      <h3 className="mt-1 font-serif text-[19px] leading-tight text-foyer-ink">{step.title}</h3>
                      <p className="mt-1.5 text-[14px] leading-relaxed text-foyer-muted">{step.description}</p>
                    </div>
                  </div>
                  {i < PROCESS_STEPS.length - 1 && (
                    <span aria-hidden className="absolute left-6 top-12 h-5 w-px bg-foyer-border" />
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* DIFFÉRENCIATEURS — TABLEAU COMPARATIF (pas de cards en grid) */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <Reveal>
            <p className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-foyer-ink">
              <span className="size-1.5 rounded-full bg-foyer-ink" aria-hidden />
              La différence Foyer
            </p>
          </Reveal>
          <Reveal delay={70}>
            <h2 className="mt-4 max-w-3xl font-serif text-[32px] font-medium leading-[1.02] tracking-[-0.02em] text-foyer-ink md:text-[44px]">
              On ne fait pas que générer des rendus.
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-4 max-w-xl text-[17px] leading-[1.55] text-foyer-muted">
              Tout ce que vous voyez existe. Et on vous dit où le trouver.
            </p>
          </Reveal>

          <Reveal delay={200}>
            <div className="mt-12 overflow-hidden rounded-2xl bg-white ring-1 ring-foyer-border/60 shadow-[0_10px_40px_rgba(31,27,22,0.06)]">
              <div className="grid grid-cols-[1.4fr_1fr_1fr] border-b border-foyer-border/60 text-[12px] font-semibold uppercase tracking-[0.12em]">
                <div className="px-5 py-4 text-foyer-muted md:px-7 md:py-5">Capacité</div>
                <div className="border-l border-foyer-border/60 px-5 py-4 text-center text-foyer-muted md:px-7 md:py-5">
                  Générateurs IA
                </div>
                <div className="border-l border-foyer-border/60 bg-foyer-sage/8 px-5 py-4 text-center text-foyer-sage md:px-7 md:py-5">
                  Foyer
                </div>
              </div>
              {COMPARE_ROWS.map((row, i) => (
                <div
                  key={row.criterion}
                  className={cn(
                    "grid grid-cols-[1.4fr_1fr_1fr] items-center text-[14px]",
                    i < COMPARE_ROWS.length - 1 && "border-b border-foyer-border/40",
                  )}
                >
                  <div className="px-5 py-4 text-foyer-ink md:px-7 md:py-5 md:text-[15px]">
                    {row.criterion}
                  </div>
                  <div className="border-l border-foyer-border/60 px-5 py-4 text-center md:px-7 md:py-5">
                    {row.ia ? (
                      <Check className="mx-auto size-4 text-foyer-muted/70" strokeWidth={2.2} aria-hidden />
                    ) : (
                      <Minus className="mx-auto size-4 text-foyer-muted/40" strokeWidth={2} aria-hidden />
                    )}
                  </div>
                  <div className="border-l border-foyer-border/60 bg-foyer-sage/[0.04] px-5 py-4 text-center md:px-7 md:py-5">
                    {row.foyer ? (
                      <Check className="mx-auto size-5 text-foyer-sage" strokeWidth={2.4} aria-hidden />
                    ) : (
                      <Minus className="mx-auto size-4 text-foyer-muted/40" strokeWidth={2} aria-hidden />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* PRODUCT MOMENT — image annotée + carte flottante Total/Score */}
      <section className="bg-foyer-cream">
        <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-24">
          <div className="max-w-2xl">
            <Reveal>
              <p className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-foyer-sage">
                <span className="size-1.5 rounded-full bg-foyer-sage" aria-hidden />
                Du rendu à l&apos;achat
              </p>
            </Reveal>
            <Reveal delay={70}>
              <h2 className="mt-4 font-serif text-[34px] font-medium leading-[1.02] tracking-[-0.025em] text-foyer-ink md:text-[52px]">
                Ce que vous voyez, vous pouvez l&apos;avoir.
              </h2>
            </Reveal>
            <Reveal delay={140}>
              <p className="mt-5 text-[17px] leading-[1.6] text-foyer-muted">
                Chaque élément du rendu est rattaché à un vrai produit. Cliquez, vous tombez sur le marchand.
              </p>
            </Reveal>
          </div>

          <Reveal delay={200}>
            <div className="relative mt-12 overflow-hidden rounded-3xl shadow-[0_30px_80px_rgba(31,27,22,0.14),0_0_0_1px_rgba(31,27,22,0.04)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/after.jpg" alt="Salon annoté" className="block w-full" />

              {/* Annotations — desktop seulement */}
              <div className="hidden md:block">
                <Annotation x="11%" y="38%" name="Bibliothèque" source="conservée, repeinte sage" price="existant" tone="sage" direction="right" />
                <Annotation x="32%" y="62%" name="Canapé en lin écru" source="Selency · seconde main" price="320 €" tone="terra" direction="right" />
                <Annotation x="51%" y="78%" name="Table basse chêne" source="Leboncoin · seconde main" price="75 €" tone="terra" direction="right" />
                <Annotation x="62%" y="32%" name="Plante verte" source="conservée" price="existant" tone="sage" direction="left" />
                <Annotation x="84%" y="44%" name="Lampadaire trépied" source="Maisons du Monde · neuf éco" price="69 €" tone="water" direction="left" />
              </div>

              {/* Total / Score — carte flottante */}
              <div className="absolute bottom-4 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:w-72">
                <div className="rounded-2xl bg-white/95 p-4 shadow-[0_12px_30px_rgba(31,27,22,0.18)] ring-1 ring-foyer-border/40 backdrop-blur">
                  <div className="flex items-baseline justify-between">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-foyer-muted">Total du projet</p>
                    <p className="font-serif text-[28px] font-medium leading-none tracking-[-0.02em] text-foyer-ink md:text-[32px]">
                      ~620 €
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-2.5 border-t border-foyer-border/60 pt-3">
                    <MiniDonut />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-foyer-sage">
                        Score Foyer
                      </p>
                      <p className="mt-0.5 text-[12px] leading-snug text-foyer-muted">
                        60% conservé · 15% occasion · 25% neuf
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* IA — pull-quote */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-4xl px-6 py-16 md:py-20">
          <Reveal>
            <p className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-foyer-ink">
              <span className="size-1.5 rounded-full bg-foyer-ink" aria-hidden />
              Transparence
            </p>
          </Reveal>
          <Reveal delay={70}>
            <h2 className="mt-4 font-serif text-[32px] font-medium leading-[1.02] tracking-[-0.02em] text-foyer-ink md:text-[48px]">
              On utilise l&apos;IA. Mais ce n&apos;est qu&apos;un outil.
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <div className="mt-8 flex gap-6">
              <div aria-hidden className="w-[3px] shrink-0 rounded-full bg-foyer-terra-deep" />
              <p className="text-[18px] leading-[1.65] text-foyer-muted">
                L&apos;IA nous sert à générer des rendus et à retrouver des meubles
                d&apos;occasion qui correspondent visuellement. Le reste — sélection des
                partenaires, choix des matériaux, préparation des listes — est pensé par
                notre équipe.{" "}
                <span className="font-medium text-foyer-ink">
                  L&apos;IA pour aller vite, l&apos;humain pour aller juste.
                </span>
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* B2B */}
      <section id="partenaires" className="scroll-mt-24 bg-foyer-cream">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <Reveal>
            <p className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-foyer-mousse">
              <span className="size-1.5 rounded-full bg-foyer-mousse" aria-hidden />
              Partenaires
            </p>
          </Reveal>
          <Reveal delay={70}>
            <h2 className="mt-4 max-w-3xl font-serif text-[32px] font-medium leading-[1.02] tracking-[-0.02em] text-foyer-ink md:text-[44px]">
              Et si Foyer devenait votre canal d&apos;acquisition&nbsp;?
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-4 max-w-2xl text-[17px] leading-[1.55] text-foyer-muted">
              Un nouveau front-end IA pour les enseignes qui veulent capter le flux IA-design avant qu&apos;il ne devienne dominant.
            </p>
          </Reveal>

          {/* 3 partenaires en flow horizontal divisé par hairlines (pas en cards) */}
          <Reveal delay={200}>
            <div className="mt-12 overflow-hidden rounded-2xl bg-white ring-1 ring-foyer-border/50 shadow-[0_8px_30px_rgba(31,27,22,0.05)]">
              <div className="grid divide-foyer-border/40 md:grid-cols-3 md:divide-x">
                {PARTNERS.map((p) => {
                  const Icon = p.icon;
                  return (
                    <div key={p.title} className="border-t border-foyer-border/40 px-6 py-7 first:border-t-0 md:border-t-0 md:px-8 md:py-9">
                      <div className={cn("inline-flex size-11 items-center justify-center rounded-xl", ICON_BG[p.tone])}>
                        <Icon className={cn("size-5", ICON_COLOR[p.tone])} strokeWidth={1.6} aria-hidden />
                      </div>
                      <h3 className="mt-5 font-serif text-[19px] leading-snug text-foyer-ink">{p.title}</h3>
                      <p className="mt-2 text-[14px] leading-relaxed text-foyer-muted">{p.promise}</p>
                      <p className="mt-4 text-[12px] text-foyer-muted">
                        <span className="text-foyer-ink/70">ex.</span> {p.examples}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </Reveal>
          <Reveal delay={300}>
            <Link href="mailto:contact@foyer.app" className="group mt-8 inline-flex items-center gap-2 rounded-full bg-foyer-ink px-6 py-3 text-[15px] font-medium text-foyer-cream transition-transform hover:-translate-y-0.5">
              Discuter d&apos;un partenariat
              <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-4xl px-6 py-16 md:py-20">
          <Reveal>
            <p className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-foyer-ink">
              <span className="size-1.5 rounded-full bg-foyer-ink" aria-hidden />
              Questions fréquentes
            </p>
          </Reveal>
          <Reveal delay={70}>
            <h2 className="mt-4 font-serif text-[32px] font-medium leading-[1.02] tracking-[-0.02em] text-foyer-ink md:text-[44px]">
              On répond à tout, sans détour.
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-8">
              <FaqAccordion items={FAQ} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* FOOTER — cream */}
      <footer className="border-t border-foyer-border/60 bg-foyer-cream">
        <div className="mx-auto w-full max-w-6xl px-6 py-12">
          <div className="grid gap-10 md:grid-cols-4">
            <div>
              <span className="font-serif text-xl tracking-tight text-foyer-ink">Foyer</span>
              <p className="mt-3 text-[13px] text-foyer-muted">Conçu en France.</p>
            </div>
            <FooterColumn title="Produit" links={["Comment ça marche", "Tarifs", "FAQ"]} />
            <FooterColumn title="Éco" links={["Méthodologie", "Partenaires", "Sources"]} />
            <FooterColumn title="Légal" links={["CGU", "Privacy", "Mentions"]} />
          </div>
          <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-foyer-border/60 pt-6 text-[13px] text-foyer-muted sm:flex-row sm:items-center">
            <span>© {new Date().getFullYear()} Foyer</span>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-foyer-ink">Instagram</a>
              <a href="#" className="hover:text-foyer-ink">TikTok</a>
              <a href="#" className="hover:text-foyer-ink">LinkedIn</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ---------- composants visuels ---------- */

function EcoDonut() {
  // 60% conservé (sage) · 15% occasion (mousse) · 25% neuf durable (water)
  const SEG = [
    { v: 60, c: "#6B8E6F", label: "conservé", dot: "bg-foyer-sage" },
    { v: 15, c: "#C89B6A", label: "occasion", dot: "bg-foyer-mousse" },
    { v: 25, c: "#A5B8A0", label: "neuf durable", dot: "bg-foyer-water" },
  ];
  let acc = 0;
  return (
    <div className="rounded-3xl bg-foyer-cream/60 p-6 ring-1 ring-foyer-border/50 md:p-8">
      <div className="flex items-center gap-6">
        <div className="relative size-44 shrink-0 md:size-52">
          <svg viewBox="0 0 42 42" className="size-full">
            <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#E5DDD0" strokeWidth="4" />
            <g transform="rotate(-90 21 21)">
              {SEG.map((s) => {
                const offset = -acc;
                acc += s.v;
                return (
                  <circle
                    key={s.label}
                    cx="21"
                    cy="21"
                    r="15.9155"
                    fill="none"
                    stroke={s.c}
                    strokeWidth="4"
                    strokeDasharray={`${s.v} ${100 - s.v}`}
                    strokeDashoffset={offset}
                    strokeLinecap="butt"
                  />
                );
              })}
            </g>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="font-serif text-[44px] font-medium leading-none tracking-[-0.03em] text-foyer-ink md:text-[52px]">
              60<span className="text-foyer-sage">%</span>
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-foyer-muted">
              Conservé
            </p>
          </div>
        </div>
        <div className="flex-1">
          <ul className="space-y-2.5">
            {SEG.map((s) => (
              <li key={s.label} className="flex items-center gap-2.5">
                <span className={cn("size-2.5 rounded-full", s.dot)} aria-hidden />
                <span className="text-[14px] text-foyer-ink">
                  <span className="font-medium">{s.v}%</span>{" "}
                  <span className="text-foyer-muted">{s.label}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-6 border-t border-foyer-border/50 pt-5">
        <p className="font-serif text-[20px] text-foyer-ink">
          42 kg CO<sub>2</sub>{" "}
          <span className="text-[14px] font-sans text-foyer-muted">évités par projet</span>
        </p>
        <p className="mt-2 text-[12px] text-foyer-muted">
          Méthodologie sourcée ADEME, par rapport à un projet 100% neuf équivalent.
        </p>
      </div>
    </div>
  );
}

function MiniDonut() {
  const SEG = [
    { v: 60, c: "#6B8E6F" },
    { v: 15, c: "#C89B6A" },
    { v: 25, c: "#A5B8A0" },
  ];
  let acc = 0;
  return (
    <svg viewBox="0 0 42 42" className="size-9 shrink-0">
      <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#E5DDD0" strokeWidth="6" />
      <g transform="rotate(-90 21 21)">
        {SEG.map((s, i) => {
          const offset = -acc;
          acc += s.v;
          return (
            <circle
              key={i}
              cx="21"
              cy="21"
              r="15.9155"
              fill="none"
              stroke={s.c}
              strokeWidth="6"
              strokeDasharray={`${s.v} ${100 - s.v}`}
              strokeDashoffset={offset}
            />
          );
        })}
      </g>
    </svg>
  );
}

function Annotation({
  x,
  y,
  name,
  source,
  price,
  tone,
  direction = "right",
}: {
  x: string;
  y: string;
  name: string;
  source: string;
  price: string;
  tone: "sage" | "terra" | "water";
  direction?: "right" | "left";
}) {
  const labelPos = direction === "left" ? "right-full mr-4" : "left-full ml-4";
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: x, top: y }}>
      <span className="relative inline-flex">
        <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60", SOLID_BG[tone])} />
        <span className={cn("relative size-3 rounded-full ring-[3px] ring-white shadow-[0_0_0_1px_rgba(31,27,22,0.15)]", SOLID_BG[tone])} />
      </span>
      <div className={cn("absolute top-1/2 w-48 -translate-y-1/2 rounded-xl bg-white/95 p-3 shadow-[0_8px_30px_rgba(31,27,22,0.15)] ring-1 ring-foyer-border/40 backdrop-blur-sm", labelPos)}>
        <p className="text-[12px] font-medium leading-tight text-foyer-ink">{name}</p>
        <p className="mt-1 text-[11px] text-foyer-muted">
          {source} · <span className="font-medium text-foyer-ink">{price}</span>
        </p>
      </div>
    </div>
  );
}

function FooterColumn({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h3 className="text-[12px] font-medium uppercase tracking-[0.14em] text-foyer-ink">{title}</h3>
      <ul className="mt-4 space-y-2.5 text-[14px] text-foyer-muted">
        {links.map((link) => (
          <li key={link}>
            <a href="#" className="hover:text-foyer-ink">{link}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
