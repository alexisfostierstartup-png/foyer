import { Fragment } from "react";
import Link from "next/link";
import {
  Camera,
  Leaf,
  Recycle,
  Search,
  Store,
  Tag,
  Building2,
  Check,
  ArrowRight,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BeforeAfterSlider } from "@/components/landing/BeforeAfterSlider";
import { FaqAccordion } from "@/components/landing/FaqAccordion";
import { Reveal } from "@/components/landing/Reveal";
import { StrokeDivider } from "@/components/landing/StrokeDivider";

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

const ECO_SEGMENTS: {
  value: number;
  color: string;
  dotClass: string;
  iconBg: string;
  iconColor: string;
  icon: LucideIcon;
  heading: string;
  subtitle: string;
  stat: string;
  statLabel: string;
}[] = [
  {
    value: 60, color: "#6B8E6F", dotClass: "bg-foyer-sage", iconBg: "bg-foyer-sage/15", iconColor: "text-foyer-sage", icon: Recycle,
    heading: "D'abord, on réutilise",
    subtitle: "Un canapé peut être recouvert. Une commode peut être repeinte. Une table peut changer de pièce.",
    stat: "~ 70 %",
    statLabel: "du mobilier conservé en moyenne",
  },
  {
    value: 15, color: "#6E8B6B", dotClass: "bg-foyer-mousse", iconBg: "bg-foyer-mousse/15", iconColor: "text-foyer-mousse", icon: Search,
    heading: "Ensuite, on chine",
    subtitle: "Sourcing seconde main intégré, depuis les plateformes que vous utilisez déjà.",
    stat: "~ 22 %",
    statLabel: "des nouvelles pièces sont chinées",
  },
  {
    value: 25, color: "#A5B8A0", dotClass: "bg-foyer-water", iconBg: "bg-foyer-water/30", iconColor: "text-foyer-sage", icon: Leaf,
    heading: "En dernier, du neuf éco-sourcé qui dure",
    subtitle: "Conseil matériaux et marques. On vous oriente vers ce qui tient dix ans, pas trois.",
    stat: "~ 8 %",
    statLabel: "neuf, choisi pour durer",
  },
];

const COMPARE_GENERATORS = [
  "Un rendu visuel agréable",
  "Plusieurs ambiances à essayer",
  "Quelques itérations de style",
];

const COMPARE_FOYER = [
  { label: "Rendu réaliste qui tient compte de votre pièce" },
  { label: "Préserve votre mobilier existant" },
  { label: "Liste d'achat sourcée et chiffrée" },
  { label: "Priorité seconde main et conservation" },
  { label: "Conception guidée étape par étape" },
  { label: "Bilan carbone du projet (ADEME)" },
];

const PARTNERS: { icon: LucideIcon; tone: Tone; title: string; promise: string; examples: string }[] = [
  { icon: Building2, tone: "mousse", title: "Enseignes fournitures", promise: "Captez le flux IA-design en France.", examples: "Leroy Merlin, Castorama, ManoMano" },
  { icon: Tag, tone: "sage", title: "Marketplaces seconde main", promise: "Augmentez la visibilité de vos vendeurs.", examples: "Leboncoin, Vinted, Selency" },
  { icon: Store, tone: "water", title: "Enseignes mobilier durable", promise: "Touchez des acheteurs qui achètent moins, mais durable.", examples: "Maisons du Monde, La Redoute, Tikamoon" },
];

const FAQ = [
  { question: "Est-ce que c'est un générateur d'images ?", answer: "Non. Chaque rendu est sourcé : les pièces que vous voyez existent vraiment chez nos partenaires, avec dimensions et prix." },
  { question: "Et si je veux tout changer quand même ?", answer: "Pas de problème — vous restez libre de remplacer autant de meubles que vous voulez. Notre priorité est la conservation, pas une obligation." },
  { question: "Combien coûte un projet ?", answer: "Le premier rendu est offert. Ensuite des crédits à partir de 4,99 €. Pas d'abonnement." },
  { question: "Vous livrez ?", answer: "Non. Foyer génère des paniers groupés par enseigne avec les liens directs. Vous achetez directement chez chaque marchand." },
  { question: "Mes données ?", answer: "Vos photos restent confidentielles et ne sont jamais utilisées pour entraîner des modèles. Vous pouvez supprimer votre compte à tout moment." },
];

const FLOW_STEPS = [
  { mockup: "camera" as const, num: "01", title: "Vous photographiez", description: "Une photo de votre pièce, choix du salon ou de la chambre." },
  { mockup: "styles" as const, num: "02", title: "Vous choisissez l'ambiance", description: "Six ambiances proposées. Une suffit pour démarrer." },
  { mockup: "render" as const, num: "03", title: "On génère votre projet", description: "Mobilier conservé, customisé, ajouté. Vous validez." },
  { mockup: "shopping" as const, num: "04", title: "Vous achetez, groupé", description: "Liste sourcée, total estimé, peu d'enseignes." },
];

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col bg-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-foyer-sage shadow-[0_2px_16px_rgba(31,27,22,0.12)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="font-serif text-xl tracking-tight text-white">Foyer</Link>
          <div className="flex flex-1 items-center gap-6 pl-10 text-[14px] font-semibold">
            <Link href="#process" className="hidden text-white transition-colors hover:text-white/75 sm:inline">Comment ça marche</Link>
            <Link href="#partenaires" className="hidden text-white transition-colors hover:text-white/75 sm:inline">Partenaires</Link>
          </div>
          <nav className="flex items-center gap-4 text-[14px] font-semibold">
            <Link href="/auth" className="hidden text-white transition-colors hover:text-white/75 sm:inline">Se connecter</Link>
            <Link href="/auth?tab=signup" className="rounded-full bg-white px-4 py-1.5 font-semibold text-foyer-sage shadow-[0_2px_8px_rgba(31,27,22,0.15)] transition-all hover:bg-white/90">S&apos;inscrire</Link>
          </nav>
        </div>
      </header>

      {/* HERO — slider stylé + callout flottant */}
      <section className="relative overflow-hidden pb-32 md:pb-44">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_85%_15%,rgba(165,184,160,0.22),transparent_60%)]" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pt-8 md:pt-12">
          <div className="grid items-center gap-12 md:grid-cols-12 md:gap-10">
            <div className="md:col-span-6">
              <Reveal>
                <p className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-foyer-sage">
                  <Leaf className="size-3.5" strokeWidth={2.2} aria-hidden />
                  Conception déco · sourcing éco
                </p>
              </Reveal>
              <Reveal delay={70}>
                <h1 className="mt-5 font-serif text-[36px] font-medium leading-[1.08] tracking-[-0.03em] text-foyer-ink md:text-[50px] lg:text-[58px]">
                  <span className="block">Une pièce{" "}
                  <span className="[background:linear-gradient(transparent_55%,rgba(107,142,111,0.22)_55%)]">transformée</span>
                  .</span>
                  <span className="block">Une empreinte{" "}
                  <span className="[background:linear-gradient(transparent_55%,rgba(107,142,111,0.22)_55%)]">préservée</span>
                  .</span>
                </h1>
              </Reveal>
              <Reveal delay={140}>
                <p className="mt-6 max-w-md text-[18px] leading-[1.55] text-foyer-muted">
                  Un bel intérieur, sans que cela soit aux dépens de la planète.
                </p>
              </Reveal>
              <Reveal delay={210}>
                <div className="mt-8">
                  <div className="flex items-center gap-3">
                    <Link href="/demo" className="inline-flex h-11 shrink-0 items-center rounded-full bg-foyer-sage px-6 text-[14px] font-semibold text-white shadow-[0_2px_8px_rgba(107,142,111,0.35)] transition-all hover:bg-foyer-sage/90 hover:shadow-[0_4px_14px_rgba(107,142,111,0.45)]">
                      Lancer ma transformation
                    </Link>
                    <Link href="#process" className="flex h-11 shrink-0 items-center rounded-full border border-foyer-border px-5 text-[13px] font-medium text-foyer-ink transition-colors hover:border-foyer-ink">
                      Voir nos réalisations
                    </Link>
                  </div>
                  <ul className="mt-5 flex flex-col gap-2 sm:flex-row sm:gap-6">
                    {["Jusqu'à 10 rendus gratuitement", "Sans abonnement"].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-[13px] text-foyer-muted">
                        <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-foyer-sage/15">
                          <svg width="8" height="6" viewBox="0 0 8 6" fill="none" aria-hidden>
                            <path d="M1 3l2 2 4-4" stroke="#6B8E6F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
            <Reveal delay={160} className="md:col-span-6">
              <div className="relative">
                <div aria-hidden className="absolute inset-0 translate-x-3 translate-y-3 rounded-3xl bg-foyer-sage/25 md:translate-x-5 md:translate-y-5" />
                <div className="relative overflow-hidden rounded-3xl bg-white p-2 shadow-[0_24px_60px_rgba(31,27,22,0.14),0_0_0_1px_rgba(31,27,22,0.04)]">
                  <div className="overflow-hidden rounded-2xl">
                    <BeforeAfterSlider beforeUrl="/landing/before.jpg" afterUrl="/landing/after.jpg" />
                  </div>
                </div>
                <div className="absolute -bottom-6 left-4 right-4 md:-bottom-8 md:left-auto md:right-6 md:w-72">
                  <div className="rounded-2xl bg-white p-3.5 shadow-[0_16px_36px_rgba(31,27,22,0.18)] ring-1 ring-foyer-border/40 backdrop-blur">
                    <div className="flex items-center gap-3">
                      <MiniDonut />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-foyer-sage">Score Foyer</p>
                        <p className="mt-0.5 text-[12px] leading-snug text-foyer-muted">60% conservé · 15% chiné · 25% neuf</p>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-baseline justify-between border-t border-foyer-border/60 pt-2.5">
                      <p className="text-[11px] font-medium text-foyer-muted">CO₂ évités</p>
                      <p className="font-serif text-[18px] font-medium leading-none tracking-[-0.02em] text-foyer-ink">
                        42 kg
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* STATS — overlap UP vers le hero */}
      <section className="relative z-10 bg-white pb-[18px]">
        <div className="mx-auto w-full max-w-6xl px-6">
          <Reveal>
            <div className="-mt-20 overflow-hidden rounded-3xl bg-foyer-cream ring-1 ring-foyer-border/40 shadow-[0_20px_60px_rgba(110,139,107,0.22),0_4px_16px_rgba(110,139,107,0.14)] md:-mt-28">
              <div className="grid divide-foyer-border/40 md:grid-cols-4 md:divide-x">
                <div className="px-5 py-5 md:px-6 md:py-7">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foyer-sage">Empreinte</p>
                  <p className="mt-3 font-serif text-[40px] font-medium leading-[0.9] tracking-[-0.04em] text-foyer-ink md:text-[50px]">
                    60<span className="text-foyer-sage">%</span>
                  </p>
                  <p className="mt-3 text-[13px] leading-snug text-foyer-muted">mobilier conservé en moyenne sur un projet Foyer</p>
                </div>
                <div className="border-t border-foyer-border/40 px-6 py-7 md:border-t-0 md:px-7 md:py-9">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foyer-muted">Budget moyen</p>
                  <p className="mt-3 font-serif text-[40px] font-medium leading-[0.9] tracking-[-0.04em] text-foyer-ink md:text-[50px]">−38<span className="text-foyer-muted/50">%</span></p>
                  <p className="mt-3 text-[13px] leading-snug text-foyer-muted">vs déco traditionnelle</p>
                </div>
                <div className="border-t border-foyer-border/40 px-6 py-7 md:border-t-0 md:px-7 md:py-9">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foyer-muted">Bilan carbone</p>
                  <p className="mt-3 font-serif text-[40px] font-medium leading-[0.9] tracking-[-0.03em] text-foyer-ink md:text-[50px]">42 kg</p>
                  <p className="mt-3 text-[13px] leading-snug text-foyer-muted">CO₂ évités par projet, base ADEME</p>
                </div>
                <div className="border-t border-foyer-border/40 px-6 py-7 md:border-t-0 md:px-7 md:py-9">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foyer-muted">Logistique</p>
                  <p className="mt-3 font-serif text-[40px] font-medium leading-[0.9] tracking-[-0.03em] text-foyer-ink md:text-[50px]">5 max</p>
                  <p className="mt-3 text-[13px] leading-snug text-foyer-muted">enseignes par projet, livraisons groupées</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* SECTION ÉCO — donut + 3 steps mappés couleur:segment */}
      <section className="bg-foyer-cream">
        <div className="mx-auto w-full max-w-6xl px-6 py-12 md:py-16">
          <div className="mx-auto max-w-2xl text-center md:text-left">
            <Reveal>
              <p className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-foyer-sage">
                <Leaf className="size-3.5" strokeWidth={2.2} aria-hidden />
                Notre parti pris
              </p>
            </Reveal>
            <Reveal delay={70}>
              <h2 className="mt-4 font-serif text-[32px] font-medium leading-[1.02] tracking-[-0.02em] text-foyer-ink md:text-[48px]">
                Garder, chiner, et n&apos;acheter neuf qu&apos;en dernier.
              </h2>
            </Reveal>
            <Reveal delay={140}>
              <p className="mt-5 font-serif text-[20px] leading-[1.4] tracking-[-0.01em] text-foyer-ink md:text-[24px]">
                La déco la plus écologique, c&apos;est celle qu&apos;on ne rachète pas.
              </p>
            </Reveal>
          </div>

          <Reveal delay={200}>
            <div className="mt-14 grid items-center gap-10 md:grid-cols-[auto_1fr] md:gap-16">
              <div className="relative mx-auto flex flex-col items-center">
                <EcoDonutLarge />
                {/* Badge ADEME qui déborde du donut */}
                <div className="absolute -top-2 right-0 rounded-full bg-foyer-ink px-3 py-1.5 shadow-[0_8px_20px_rgba(31,27,22,0.20)] ring-4 ring-foyer-cream md:-top-1 md:right-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foyer-cream">
                    Base ADEME
                  </p>
                </div>
                <p className="mt-4 max-w-xs text-center text-[11px] leading-relaxed text-foyer-muted/70">
                  Chaque projet est mesuré selon sa part de mobilier conservé, chiné et neuf, et son équivalent CO₂ évité. Méthodologie sourcée ADEME.
                </p>
              </div>
              <ul className="grid gap-4">
                {ECO_SEGMENTS.map((seg, i) => {
                  const Icon = seg.icon;
                  return (
                    <Reveal key={seg.heading} delay={i * 100}>
                      <li className="relative overflow-hidden rounded-2xl bg-white p-4 ring-1 ring-foyer-border/50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(31,27,22,0.07)] hover:ring-foyer-border">
                        <span aria-hidden className={cn("absolute inset-y-3 left-0 w-1 rounded-r-full", seg.dotClass)} />
                        <div className="flex items-start gap-3">
                          <div className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-lg", seg.iconBg)}>
                            <Icon className={cn("size-4", seg.iconColor)} strokeWidth={1.6} aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-serif text-[17px] font-medium leading-snug tracking-[-0.01em] text-foyer-ink">
                              {seg.heading}
                            </h3>
                            <p className="mt-1.5 text-[13px] leading-relaxed text-foyer-muted">{seg.subtitle}</p>
                            <p className="mt-3 border-t border-foyer-border/50 pt-2.5">
                              <span className="font-serif text-[18px] font-medium tracking-[-0.02em] text-foyer-ink">{seg.stat}</span>
                              {" "}<span className="text-[12px] text-foyer-muted">{seg.statLabel}</span>
                            </p>
                          </div>
                        </div>
                      </li>
                    </Reveal>
                  );
                })}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      <StrokeDivider dir="cream-to-white" />

      {/* PROCESS — infographie 4 phones */}
      <section id="process" className="scroll-mt-24 bg-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-12 md:py-16">
          <div className="text-center">
            <Reveal>
              <h2 className="font-serif text-[28px] font-medium leading-[1.02] tracking-[-0.02em] text-foyer-ink md:text-[40px] md:whitespace-nowrap">
                De la photo à la commande, en 4 écrans.
              </h2>
            </Reveal>
          </div>

          {/* Desktop — 4 phones alignés (même hauteur) */}
          <div className="mt-16 hidden md:flex md:items-start md:justify-between md:gap-2 lg:gap-4">
            {FLOW_STEPS.map((step, i) => (
              <Fragment key={step.num}>
                <Reveal delay={i * 100} className="w-[22%]">
                  <div className="group flex flex-col items-center">
                    <div className="relative w-full transition-transform duration-500 group-hover:-translate-y-1">
                      <Mockup variant={step.mockup} />
                      {/* Numéro qui déborde du téléphone */}
                      <span className="absolute -right-3 -top-3 inline-flex size-10 items-center justify-center rounded-full bg-foyer-ink text-foyer-cream shadow-[0_6px_16px_rgba(31,27,22,0.25)] ring-4 ring-white">
                        <span className="font-serif text-[13px] font-medium leading-none">{step.num}</span>
                      </span>
                    </div>
                    <p className="mt-6 font-serif text-[13px] text-foyer-muted">Étape {step.num}</p>
                    <h3 className="mt-2 block text-center font-serif text-[18px] leading-snug text-foyer-ink">{step.title}</h3>
                    <p className="mt-4 block text-center text-[13px] leading-relaxed text-foyer-muted">{step.description}</p>
                  </div>
                </Reveal>
                {i < FLOW_STEPS.length - 1 && (
                  <div aria-hidden className="flex shrink-0 items-center pt-44 lg:pt-52">
                    <ArrowRight className="size-5 text-foyer-border" strokeWidth={1.5} />
                  </div>
                )}
              </Fragment>
            ))}
          </div>

          {/* Mobile — stack vertical */}
          <ol className="mt-12 space-y-8 md:hidden">
            {FLOW_STEPS.map((step, i) => (
              <li key={step.num} className="relative">
                <div className="flex gap-5">
                  <div className="shrink-0">
                    <Mockup variant={step.mockup} mini />
                  </div>
                  <div>
                    <p className="font-serif text-[13px] text-foyer-muted">Étape {step.num}</p>
                    <h3 className="mt-1 font-serif text-[18px] leading-tight text-foyer-ink">{step.title}</h3>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-foyer-muted">{step.description}</p>
                  </div>
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <span aria-hidden className="absolute left-[32px] top-[120px] h-4 w-px bg-foyer-border" />
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* DIFFÉRENCIATEURS — 2 grosses cards comparatives */}
      <section className="bg-foyer-cream">
        <div className="mx-auto w-full max-w-6xl px-6 py-12 md:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal>
              <h2 className="font-serif text-[32px] font-medium leading-[1.02] tracking-[-0.02em] text-foyer-ink md:text-[48px]">
                Nous faisons plus que générer des rendus.
              </h2>
            </Reveal>
          </div>

          <div className="mt-14 grid items-start gap-5 md:grid-cols-[1fr_1.1fr] md:items-stretch md:gap-6">
            {/* Générateurs IA — card en retrait */}
            <Reveal>
              <div className="h-full rounded-3xl bg-white p-7 ring-1 ring-foyer-border/60 md:p-9">
                <h3 className="font-serif text-[24px] font-medium leading-tight tracking-[-0.01em] text-foyer-ink md:text-[28px]">
                  Générateurs IA classiques
                </h3>
                <p className="mt-3 text-[14px] leading-relaxed text-foyer-muted">
                  Un joli rendu. Et puis à vous de jouer.
                </p>
                <ul className="mt-7 space-y-3.5">
                  {COMPARE_GENERATORS.map((label) => (
                    <li key={label} className="flex items-start gap-3">
                      <Check className="mt-0.5 size-4 shrink-0 text-foyer-muted" strokeWidth={2.2} aria-hidden />
                      <span className="text-[14px] leading-snug text-foyer-ink">{label}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-8 text-[13px] italic text-foyer-muted">
                  À vous de trouver les meubles, de mesurer, de chiner, d&apos;orchestrer les livraisons.
                </p>
              </div>
            </Reveal>

            {/* Foyer — card proéminente */}
            <Reveal delay={120}>
              <div className="relative h-full overflow-hidden rounded-3xl bg-white p-7 ring-2 ring-foyer-sage shadow-[0_20px_60px_rgba(31,27,22,0.12)] md:p-9">
                <div aria-hidden className="absolute -right-12 -top-12 size-40 rounded-full bg-foyer-sage/15 blur-2xl" />
                <div className="relative">
                  <h3 className="font-serif text-[28px] font-medium leading-tight tracking-[-0.015em] text-foyer-ink md:text-[34px]">
                    Foyer
                  </h3>
                  <p className="mt-3 text-[14px] leading-relaxed text-foyer-muted">
                    Un rendu, une liste sourcée, une logique éco, un montage. Tout ce qu&apos;il faut pour passer à l&apos;achat.
                  </p>
                  <ul className="mt-7 space-y-3.5">
                    {COMPARE_FOYER.map((row) => (
                      <li key={row.label} className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-foyer-sage/15">
                          <Check className="size-3 text-foyer-sage" strokeWidth={3} aria-hidden />
                        </span>
                        <span className="text-[14px] leading-snug text-foyer-ink">{row.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* PRODUCT MOMENT — image annotée */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-12 md:py-16">
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
              <p className="mt-5 text-[15px] leading-[1.6] text-foyer-muted md:whitespace-nowrap">
                Chaque élément du rendu est rattaché à un vrai produit. Foyer génère des paniers prêts à valider chez chaque partenaire.
              </p>
            </Reveal>
          </div>

          <Reveal delay={200}>
            <div className="relative mt-10 mx-auto w-[85%] overflow-hidden rounded-3xl shadow-[0_30px_80px_rgba(31,27,22,0.14),0_0_0_1px_rgba(31,27,22,0.04)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/after.jpg" alt="Salon annoté" className="block w-full" />
              <div className="hidden md:block">
                <Annotation x="11%" y="38%" name="Bibliothèque" source="conservée, repeinte sage" price="existant" tone="sage" direction="right" />
                <Annotation x="32%" y="62%" name="Canapé en lin écru" source="Selency · seconde main" price="320 €" tone="terra" direction="right" />
                <Annotation x="51%" y="78%" name="Table basse chêne" source="Leboncoin · seconde main" price="75 €" tone="terra" direction="right" />
                <Annotation x="62%" y="32%" name="Plante verte" source="conservée" price="existant" tone="sage" direction="left" />
                <Annotation x="84%" y="44%" name="Lampadaire trépied" source="Maisons du Monde · neuf éco" price="69 €" tone="water" direction="left" />
              </div>
              <div className="absolute bottom-4 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:w-72">
                <div className="rounded-2xl bg-white/95 p-4 shadow-[0_12px_30px_rgba(31,27,22,0.18)] ring-1 ring-foyer-border/40 backdrop-blur">
                  <div className="flex items-baseline justify-between">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-foyer-muted">Total du projet</p>
                    <p className="font-serif text-[28px] font-medium leading-none tracking-[-0.02em] text-foyer-ink md:text-[32px]">~620 €</p>
                  </div>
                  <div className="mt-3 flex items-center gap-2.5 border-t border-foyer-border/60 pt-3">
                    <MiniDonut />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-foyer-sage">Score Foyer</p>
                      <p className="mt-0.5 text-[12px] leading-snug text-foyer-muted">60% conservé · 15% occasion · 25% neuf</p>
                    </div>
                  </div>
                  <Link
                    href="/demo"
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-foyer-ink py-2.5 text-[13px] font-medium text-foyer-cream transition-colors hover:bg-foyer-ink/85"
                  >
                    Essayer sur ma pièce
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Bandeau partenaires */}
          <div className="mt-10 border-y border-foyer-border/50">
            <div className="flex flex-wrap items-center gap-x-10 gap-y-3 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foyer-muted shrink-0">
                Plateformes référencées
              </p>
              {["Selency", "Bemz", "Leroy Merlin", "La Redoute Intérieurs", "Emmaüs", "Vinted"].map((name) => (
                <span key={name} className="text-[14px] text-foyer-muted/70">
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* IA */}
      <section className="bg-foyer-cream">
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
                L&apos;IA nous sert à générer des rendus et à retrouver des meubles d&apos;occasion qui correspondent visuellement.
                Le reste — sélection des partenaires, choix des matériaux, préparation des listes — est pensé par notre équipe.{" "}
                <span className="font-medium text-foyer-ink">L&apos;IA pour aller vite, l&apos;humain pour aller juste.</span>
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* B2B */}
      <section id="partenaires" className="scroll-mt-24 bg-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-12 md:py-16">
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

          <Reveal delay={200}>
            <div className="mt-12 overflow-hidden rounded-2xl bg-foyer-cream/50 ring-1 ring-foyer-border/50 shadow-[0_8px_30px_rgba(31,27,22,0.05)]">
              <div className="grid divide-foyer-border/40 md:grid-cols-3 md:divide-x">
                {PARTNERS.map((p) => {
                  const Icon = p.icon;
                  return (
                    <div key={p.title} className="flex flex-col items-center border-t border-foyer-border/40 px-6 py-7 text-center first:border-t-0 md:border-t-0 md:px-8 md:py-9">
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

      {/* FAQ — remonte légèrement dans le B2B */}
      <section className="-mt-6 bg-foyer-cream">
        <div className="mx-auto w-full max-w-4xl px-6 pb-10 pt-8 md:pb-14 md:pt-10">
          <Reveal>
            <div className="flex flex-col items-center text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-foyer-sage/15 px-4 py-1.5 text-[13px] font-semibold text-foyer-sage">
                <span className="size-1.5 rounded-full bg-foyer-sage" aria-hidden />
                FAQ
              </span>
              <h2 className="mt-6 font-serif text-[40px] font-medium leading-[1.0] tracking-[-0.03em] text-foyer-ink md:text-[56px]">
                Vos questions, nos réponses.
              </h2>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-10">
              <FaqAccordion items={FAQ} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* FOOTER */}
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

/* ----- VISUELS ----- */

function EcoDonutLarge() {
  let acc = 0;
  return (
    <div className="relative size-72 md:size-80">
      <svg viewBox="0 0 42 42" className="size-full">
        <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#E5DDD0" strokeWidth="4.5" />
        <g transform="rotate(-90 21 21)">
          {ECO_SEGMENTS.map((s) => {
            const offset = -acc;
            acc += s.value;
            return (
              <circle key={s.heading} cx="21" cy="21" r="15.9155" fill="none" stroke={s.color} strokeWidth="4.5" strokeDasharray={`${s.value} ${100 - s.value}`} strokeDashoffset={offset} />
            );
          })}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-serif text-[64px] font-medium leading-none tracking-[-0.04em] text-foyer-ink md:text-[80px]">
          60<span className="text-foyer-sage">%</span>
        </p>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-foyer-muted">de mobilier conservé</p>
        <p className="mt-4 font-serif text-[20px] text-foyer-ink">42 kg CO<sub>2</sub></p>
        <p className="text-[11px] text-foyer-muted">évités par projet</p>
      </div>
    </div>
  );
}

function MiniDonut() {
  let acc = 0;
  return (
    <svg viewBox="0 0 42 42" className="size-9 shrink-0">
      <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#E5DDD0" strokeWidth="6" />
      <g transform="rotate(-90 21 21)">
        {ECO_SEGMENTS.map((s, i) => {
          const offset = -acc;
          acc += s.value;
          return (
            <circle key={i} cx="21" cy="21" r="15.9155" fill="none" stroke={s.color} strokeWidth="6" strokeDasharray={`${s.value} ${100 - s.value}`} strokeDashoffset={offset} />
          );
        })}
      </g>
    </svg>
  );
}

/* ----- MOCKUPS ----- */

function PhoneFrame({ children, mini = false }: { children: React.ReactNode; mini?: boolean }) {
  return (
    <div
      className={cn(
        "relative aspect-[9/16] overflow-hidden rounded-[24px] bg-foyer-cream ring-1 ring-foyer-border shadow-[0_18px_40px_rgba(31,27,22,0.15)]",
        mini ? "w-16" : "w-full",
      )}
    >
      <span aria-hidden className="absolute left-1/2 top-1.5 z-10 h-1 w-8 -translate-x-1/2 rounded-full bg-foyer-ink/15" />
      <div className={cn("absolute inset-0", mini ? "p-1.5 pt-3" : "p-2.5 pt-4")}>{children}</div>
    </div>
  );
}

function Mockup({ variant, mini = false }: { variant: "camera" | "styles" | "render" | "shopping"; mini?: boolean }) {
  if (variant === "camera") {
    return (
      <PhoneFrame mini={mini}>
        <div className={cn("flex h-full flex-col", mini && "gap-1")}>
          <p className={cn("text-center font-serif text-foyer-ink", mini ? "text-[6px]" : "text-[10px]")}>Votre pièce</p>
          <div className="mt-2 flex flex-1 items-center justify-center rounded-lg border border-dashed border-foyer-border bg-white">
            <Camera className={cn("text-foyer-muted/60", mini ? "size-4" : "size-7")} strokeWidth={1.4} aria-hidden />
          </div>
          <div className={cn("mt-2 rounded-full bg-foyer-terra-deep text-center text-white", mini ? "py-0.5 text-[5px]" : "py-1.5 text-[8px]")}>
            Prendre une photo
          </div>
        </div>
      </PhoneFrame>
    );
  }
  if (variant === "styles") {
    const swatches = [
      "linear-gradient(135deg,#F5EFE6,#A8957A)",
      "linear-gradient(135deg,#2B2723,#A18671)",
      "linear-gradient(135deg,#FFFFFF,#C9B89A)",
      "linear-gradient(135deg,#C9853E,#3D6B7C)",
      "linear-gradient(135deg,#F4EDE0,#7A8B6F)",
      "linear-gradient(135deg,#C8703A,#5C4632)",
    ];
    return (
      <PhoneFrame mini={mini}>
        <div className={cn("flex h-full flex-col", mini && "gap-1")}>
          <p className={cn("text-center font-serif text-foyer-ink", mini ? "text-[6px]" : "text-[10px]")}>Ambiance</p>
          <div className={cn("mt-2 grid flex-1 grid-cols-2", mini ? "gap-0.5" : "gap-1.5")}>
            {swatches.map((bg, i) => (
              <div key={i} className={cn("rounded-md ring-1 ring-foyer-border", i === 0 && "ring-2 ring-foyer-ink")} style={{ background: bg }} />
            ))}
          </div>
        </div>
      </PhoneFrame>
    );
  }
  if (variant === "render") {
    return (
      <PhoneFrame mini={mini}>
        <div className={cn("flex h-full flex-col", mini && "gap-1")}>
          <p className={cn("text-center font-serif text-foyer-ink", mini ? "text-[6px]" : "text-[10px]")}>Votre projet</p>
          <div className="relative mt-2 flex-1 overflow-hidden rounded-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/after.jpg" alt="" className="absolute inset-0 size-full object-cover" />
            <span className={cn("absolute right-1 top-1 rounded-full bg-white/90 font-semibold uppercase tracking-wider text-foyer-ink", mini ? "px-1 py-0 text-[4px]" : "px-1.5 py-0.5 text-[6px]")}>
              Doux
            </span>
          </div>
        </div>
      </PhoneFrame>
    );
  }
  // shopping — commande groupée par enseigne
  const groups: { merchant: string; count: number; total: string }[] = [
    { merchant: "Selency", count: 2, total: "395" },
    { merchant: "Leboncoin", count: 1, total: "75" },
    { merchant: "La Redoute", count: 1, total: "89" },
  ];
  return (
    <PhoneFrame mini={mini}>
      <div className={cn("flex h-full flex-col", mini && "gap-1")}>
        <p className={cn("text-center font-serif text-foyer-ink", mini ? "text-[6px]" : "text-[10px]")}>Votre commande</p>
        <p className={cn("text-center text-foyer-muted", mini ? "text-[4px]" : "text-[6px]")}>{groups.length} enseignes</p>
        <ul className={cn("mt-2 flex-1", mini ? "space-y-0.5" : "space-y-1")}>
          {groups.map((g) => (
            <li
              key={g.merchant}
              className={cn(
                "rounded-md bg-white ring-1 ring-foyer-border/60",
                mini ? "px-1 py-0.5" : "px-1.5 py-1",
              )}
            >
              <div className="flex items-baseline justify-between">
                <span className={cn("font-medium text-foyer-ink", mini ? "text-[4.5px]" : "text-[7px]")}>{g.merchant}</span>
                <span className={cn("font-medium text-foyer-ink", mini ? "text-[4.5px]" : "text-[7px]")}>{g.total} €</span>
              </div>
              <p className={cn("text-foyer-muted", mini ? "text-[3.5px]" : "text-[5.5px]")}>
                {g.count} article{g.count > 1 ? "s" : ""} · livraison groupée
              </p>
            </li>
          ))}
        </ul>
        <div className={cn("mt-1 rounded-md bg-foyer-ink text-center font-medium text-foyer-cream", mini ? "py-0.5 text-[5px]" : "py-1.5 text-[8px]")}>
          Tout commander
        </div>
      </div>
    </PhoneFrame>
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
