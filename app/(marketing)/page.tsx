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
  Compass,
  Image as ImageIcon,
  Check,
  ArrowRight,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BeforeAfterSlider } from "@/components/landing/BeforeAfterSlider";
import { FaqAccordion } from "@/components/landing/FaqAccordion";
import { Reveal } from "@/components/landing/Reveal";

type Tone = "sage" | "terra" | "ink" | "water" | "ochre";

const ICON_BG: Record<Tone, string> = {
  sage: "bg-foyer-sage/15",
  terra: "bg-foyer-terra-deep/12",
  ink: "bg-foyer-ink/8",
  water: "bg-foyer-water/30",
  ochre: "bg-foyer-ochre/15",
};

const ICON_COLOR: Record<Tone, string> = {
  sage: "text-foyer-sage",
  terra: "text-foyer-terra-deep",
  ink: "text-foyer-ink",
  water: "text-foyer-sage",
  ochre: "text-foyer-ochre",
};

const EYEBROW_TONE: Record<Tone, string> = {
  sage: "text-foyer-sage",
  terra: "text-foyer-terra-deep",
  ink: "text-foyer-ink",
  water: "text-foyer-sage",
  ochre: "text-foyer-ochre",
};

const ECO_STEPS: { number: string; title: string; description: string; icon: LucideIcon; tone: Tone }[] = [
  {
    number: "01",
    title: "D'abord, on réutilise",
    description: "Homestaging et customisation de vos meubles.",
    icon: Recycle,
    tone: "sage",
  },
  {
    number: "02",
    title: "Ensuite, on cherche d'occasion",
    description: "Sourcing seconde main depuis les plateformes que vous utilisez déjà.",
    icon: Search,
    tone: "ochre",
  },
  {
    number: "03",
    title: "En dernier, du neuf qui dure",
    description: "Conseil matériaux et marques. Ce qui tient dix ans, pas trois.",
    icon: Leaf,
    tone: "water",
  },
];

const PROCESS_STEPS: { number: string; title: string; description: string; icon: LucideIcon; tone: Tone }[] = [
  { number: "01", title: "Vous photographiez votre pièce", description: "Une photo suffit pour commencer. Pas besoin de mesurer.", icon: Camera, tone: "ink" },
  { number: "02", title: "On imagine le projet avec vous", description: "Choisissez un style, on génère des propositions, vous ajustez.", icon: Sparkles, tone: "terra" },
  { number: "03", title: "On vérifie que tout rentre", description: "Une mesure rapide, et on adapte le projet à vos vraies dimensions.", icon: Ruler, tone: "sage" },
  { number: "04", title: "On vous dit où tout acheter", description: "Chaque élément du rendu est sourcé : seconde main d'abord, neuf durable ensuite.", icon: ShoppingBag, tone: "ochre" },
];

const DIFFERENCES: { icon: LucideIcon; tone: Tone; title: string; description: string }[] = [
  { icon: ImageIcon, tone: "terra", title: "Des rendus réels", description: "Le rendu tient compte de votre pièce. Chaque élément est sourcé et achetable." },
  { icon: Compass, tone: "ink", title: "Une conception guidée", description: "Choix du style, ajustements, validation. Vous n'êtes pas seul devant une page blanche." },
  { icon: ShoppingBag, tone: "sage", title: "Une liste d'achat réelle", description: "On vous indique où acheter chaque pièce, au meilleur compromis prix/durabilité." },
  { icon: Leaf, tone: "water", title: "Une logique éco par défaut", description: "On garde votre mobilier d'abord, on chine ensuite, on achète neuf en dernier." },
];

const SOURCED_ITEMS = [
  { tone: "terra" as const, name: "Canapé en lin écru", detail: "seconde main · Selency", price: "320 €" },
  { tone: "terra" as const, name: "Table basse chêne clair", detail: "seconde main · Leboncoin", price: "75 €" },
  { tone: "sage" as const, name: "Escalier", detail: "conservé, harmonisé au style", price: "existant" },
  { tone: "terra" as const, name: "Lampe céramique", detail: "neuf français · La Redoute", price: "119 €" },
];

const PARTNERS: { icon: LucideIcon; tone: Tone; title: string; promise: string; examples: string }[] = [
  { icon: Building2, tone: "ochre", title: "Enseignes fournitures", promise: "Captez le flux IA-design en France. Co-investissement, exclu catégorie, données agrégées.", examples: "Leroy Merlin, Castorama, ManoMano" },
  { icon: Tag, tone: "sage", title: "Marketplaces seconde main", promise: "Augmentez la visibilité de vos vendeurs auprès d'acheteurs en projet déco qualifié.", examples: "Leboncoin, Vinted, Selency" },
  { icon: Store, tone: "water", title: "Enseignes mobilier durable", promise: "Touchez des acheteurs qui achètent moins, mais durable.", examples: "Maisons du Monde, La Redoute, Tikamoon" },
];

const FAQ = [
  { question: "Combien ça coûte ?", answer: "Le premier rendu est offert. Ensuite des crédits à partir de 4,99 €. Pas d'abonnement." },
  { question: "Est-ce que vous remplacez tout mon mobilier ?", answer: "Non, on propose systématiquement de garder ce qui peut l'être. C'est notre angle de départ." },
  { question: "Comment trouvez-vous les meubles d'occasion ?", answer: "On scanne Leboncoin et Vinted Maison, et on propose ce qui correspond visuellement au rendu." },
  { question: "Et si je ne suis pas content du rendu ?", answer: "Vous pouvez itérer (changer de style, ajuster). Si vraiment ça ne va pas, on rembourse le crédit." },
  { question: "Comment se passe l'achat ?", answer: "On vous indique où acheter chaque élément (seconde main et neuf), avec les liens. Vous achetez directement chez chaque marchand." },
  { question: "C'est dispo où ?", answer: "France pour le moment. Europe à venir." },
];

const STATS = [
  { value: "60%", label: "mobilier conservé en moyenne" },
  { value: "42 kg", label: "CO₂ évités par projet" },
  { value: "5", label: "enseignes max pour livraisons groupées" },
];

const CARD_BASE = "h-full rounded-2xl bg-white p-6 ring-1 ring-foyer-border/50 shadow-[0_1px_2px_rgba(31,27,22,0.03)] transition-[transform,box-shadow,ring-color] duration-300";
const CARD_HOVER = "hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(31,27,22,0.07)] hover:ring-foyer-ink/15";

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col bg-foyer-cream">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-foyer-border/40 bg-foyer-cream/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="font-serif text-xl tracking-tight text-foyer-ink">
            Foyer
          </Link>
          <nav className="flex items-center gap-6 text-[14px] text-foyer-muted">
            <Link href="#process" className="hidden hover:text-foyer-ink sm:inline">Comment ça marche</Link>
            <Link href="#partenaires" className="hidden hover:text-foyer-ink sm:inline">Partenaires</Link>
            <Link href="/demo" className="rounded-full bg-foyer-ink px-4 py-1.5 font-medium text-foyer-cream transition-colors hover:bg-foyer-ink/85">Lancer</Link>
          </nav>
        </div>
      </header>

      {/* HERO — compact, slider qui bleed à droite */}
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

      {/* STATS BAND — bande de transition tintée eco */}
      <section className="border-y border-foyer-ink/5 bg-foyer-water/15">
        <div className="mx-auto w-full max-w-6xl px-6 py-10 md:py-14">
          <div className="grid gap-8 md:grid-cols-3 md:gap-12">
            {STATS.map((s, i) => (
              <Reveal key={s.value} delay={i * 70}>
                <div className="flex items-baseline gap-4 md:flex-col md:items-start md:gap-2">
                  <p className="font-serif text-[40px] font-medium leading-none tracking-[-0.03em] text-foyer-ink md:text-[56px]">
                    {s.value}
                  </p>
                  <p className="text-[14px] leading-snug text-foyer-muted md:text-[15px]">
                    {s.label}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* MANIFESTE — full-bleed photo à gauche, contenu à droite (Hay-style) */}
      <section className="bg-white">
        <div className="grid md:grid-cols-12 md:items-stretch">
          <div className="relative aspect-[4/3] md:col-span-5 md:aspect-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/after.jpg"
              alt="Salon transformé"
              className="absolute inset-0 size-full object-cover"
            />
          </div>
          <div className="md:col-span-7 md:flex md:items-center">
            <div className="mx-auto w-full max-w-2xl px-6 py-16 md:px-14 md:py-20">
              <Reveal>
                <p className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-foyer-sage">
                  <Leaf className="size-3.5" strokeWidth={2.2} aria-hidden />
                  Notre parti pris
                </p>
              </Reveal>
              <Reveal delay={70}>
                <h2 className="mt-4 font-serif text-[32px] font-medium leading-[1.02] tracking-[-0.02em] text-foyer-ink md:text-[44px]">
                  Avant de proposer du neuf, on regarde ce que vous avez déjà.
                </h2>
              </Reveal>
              <Reveal delay={140}>
                <p className="mt-5 text-[17px] leading-[1.6] text-foyer-muted">
                  Un canapé recouvert. Une commode repeinte. Quand il faut acheter, on commence par la seconde main.
                </p>
              </Reveal>
              <ul className="mt-10 space-y-7">
                {ECO_STEPS.map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <Reveal key={step.number} delay={200 + i * 80}>
                      <li className="flex gap-5">
                        <div className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-xl", ICON_BG[step.tone])}>
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
        </div>
      </section>

      {/* PROCESS — bg cream, 4 cards compactes */}
      <section id="process" className="scroll-mt-24 bg-foyer-cream">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <div className="grid gap-10 md:grid-cols-12 md:items-end md:gap-8">
            <div className="md:col-span-7">
              <Reveal>
                <p className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-foyer-terra-deep">
                  <span className="size-1.5 rounded-full bg-foyer-terra-deep" aria-hidden />
                  Comment ça marche
                </p>
              </Reveal>
              <Reveal delay={70}>
                <h2 className="mt-4 font-serif text-[32px] font-medium leading-[1.02] tracking-[-0.02em] text-foyer-ink md:text-[44px]">
                  De la photo au montage, en 4 étapes.
                </h2>
              </Reveal>
            </div>
            <Reveal delay={140} className="md:col-span-5">
              <p className="text-[17px] leading-[1.55] text-foyer-muted">
                Pas de logiciel à maîtriser. On fait le travail, vous validez à chaque étape.
              </p>
            </Reveal>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROCESS_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <Reveal key={step.number} delay={i * 70}>
                  <div className={cn(CARD_BASE, CARD_HOVER, "flex flex-col")}>
                    <div className="flex items-start justify-between">
                      <div className={cn("inline-flex size-11 items-center justify-center rounded-xl", ICON_BG[step.tone])}>
                        <Icon className={cn("size-5", ICON_COLOR[step.tone])} strokeWidth={1.6} aria-hidden />
                      </div>
                      <span className="font-serif text-[16px] text-foyer-muted/70">{step.number}</span>
                    </div>
                    <h3 className="mt-5 font-serif text-[19px] leading-snug text-foyer-ink">{step.title}</h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-foyer-muted">{step.description}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* DIFFÉRENCIATEURS — bg blanc */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <div className="grid gap-10 md:grid-cols-12 md:items-end md:gap-8">
            <div className="md:col-span-7">
              <Reveal>
                <p className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-foyer-ink">
                  <span className="size-1.5 rounded-full bg-foyer-ink" aria-hidden />
                  La différence Foyer
                </p>
              </Reveal>
              <Reveal delay={70}>
                <h2 className="mt-4 font-serif text-[32px] font-medium leading-[1.02] tracking-[-0.02em] text-foyer-ink md:text-[44px]">
                  On ne fait pas que générer des rendus.
                </h2>
              </Reveal>
            </div>
            <Reveal delay={140} className="md:col-span-5">
              <p className="text-[17px] leading-[1.55] text-foyer-muted">
                Tout ce que vous voyez existe. Et on vous dit où le trouver.
              </p>
            </Reveal>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {DIFFERENCES.map((diff, i) => {
              const Icon = diff.icon;
              return (
                <Reveal key={diff.title} delay={i * 70}>
                  <div className={cn(CARD_BASE, CARD_HOVER)}>
                    <div className={cn("inline-flex size-11 items-center justify-center rounded-xl", ICON_BG[diff.tone])}>
                      <Icon className={cn("size-5", ICON_COLOR[diff.tone])} strokeWidth={1.6} aria-hidden />
                    </div>
                    <h3 className="mt-5 font-serif text-[21px] leading-snug text-foyer-ink">{diff.title}</h3>
                    <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-foyer-muted">{diff.description}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* PRODUCT MOMENT — bg INK sombre, le moment "wow" */}
      <section className="bg-foyer-ink text-foyer-cream">
        <div className="mx-auto w-full max-w-6xl px-6 py-20 md:py-24">
          <div className="grid gap-10 md:grid-cols-12 md:items-end md:gap-8">
            <div className="md:col-span-7">
              <Reveal>
                <p className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-foyer-water">
                  <span className="size-1.5 rounded-full bg-foyer-water" aria-hidden />
                  Du rendu à l&apos;achat
                </p>
              </Reveal>
              <Reveal delay={70}>
                <h2 className="mt-4 font-serif text-[34px] font-medium leading-[1.02] tracking-[-0.025em] text-foyer-cream md:text-[52px]">
                  Ce que vous voyez, vous pouvez l&apos;avoir.
                </h2>
              </Reveal>
            </div>
            <Reveal delay={140} className="md:col-span-5">
              <p className="text-[17px] leading-[1.55] text-foyer-cream/65">
                Chaque élément du rendu est sourcé. Vous savez exactement où acheter, et à quel prix.
              </p>
            </Reveal>
          </div>
          <div className="mt-10 grid gap-8 md:grid-cols-12 md:items-start md:gap-8">
            <Reveal delay={120} className="md:col-span-8">
              <div className="overflow-hidden rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)]">
                <BeforeAfterSlider beforeUrl="/landing/before.jpg" afterUrl="/landing/after.jpg" />
              </div>
            </Reveal>
            <Reveal delay={200} className="md:col-span-4">
              <div className="rounded-2xl bg-foyer-cream/5 p-6 ring-1 ring-foyer-cream/15 backdrop-blur">
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-foyer-cream/55">
                  Liste sourcée
                </p>
                <ul className="mt-4 divide-y divide-foyer-cream/10">
                  {SOURCED_ITEMS.map((item) => (
                    <li key={item.name} className="flex items-start gap-3 py-3">
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          item.tone === "sage" ? "bg-foyer-sage" : "bg-foyer-terra",
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium text-foyer-cream">{item.name}</p>
                        <p className="text-[12px] text-foyer-cream/55">{item.detail}</p>
                      </div>
                      <span className="shrink-0 text-[14px] font-medium text-foyer-cream">
                        {item.price}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* IA — bg cream, court */}
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
            <p className="mt-6 text-[18px] leading-[1.65] text-foyer-muted">
              L&apos;IA nous sert à générer des rendus et à retrouver des meubles
              d&apos;occasion qui correspondent visuellement. Le reste — sélection des
              partenaires, choix des matériaux, préparation des listes — est pensé par
              notre équipe.{" "}
              <span className="font-medium text-foyer-ink">
                L&apos;IA pour aller vite, l&apos;humain pour aller juste.
              </span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* B2B — bg blanc */}
      <section id="partenaires" className="scroll-mt-24 bg-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <div className="grid gap-10 md:grid-cols-12 md:items-end md:gap-8">
            <div className="md:col-span-7">
              <Reveal>
                <p className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-foyer-ochre">
                  <span className="size-1.5 rounded-full bg-foyer-ochre" aria-hidden />
                  Partenaires
                </p>
              </Reveal>
              <Reveal delay={70}>
                <h2 className="mt-4 font-serif text-[32px] font-medium leading-[1.02] tracking-[-0.02em] text-foyer-ink md:text-[44px]">
                  Et si Foyer devenait votre canal d&apos;acquisition&nbsp;?
                </h2>
              </Reveal>
            </div>
            <Reveal delay={140} className="md:col-span-5">
              <p className="text-[17px] leading-[1.55] text-foyer-muted">
                Un nouveau front-end IA pour les enseignes qui veulent capter le flux IA-design avant qu&apos;il ne devienne dominant.
              </p>
            </Reveal>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {PARTNERS.map((p, i) => {
              const Icon = p.icon;
              return (
                <Reveal key={p.title} delay={i * 80}>
                  <div className={cn(CARD_BASE, CARD_HOVER, "flex flex-col")}>
                    <div className={cn("inline-flex size-11 items-center justify-center rounded-xl", ICON_BG[p.tone])}>
                      <Icon className={cn("size-5", ICON_COLOR[p.tone])} strokeWidth={1.6} aria-hidden />
                    </div>
                    <h3 className="mt-5 font-serif text-[19px] leading-snug text-foyer-ink">{p.title}</h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-foyer-muted">{p.promise}</p>
                    <p className="mt-auto pt-4 text-[12px] text-foyer-muted">
                      <span className="text-foyer-ink/70">ex.</span> {p.examples}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
          <Reveal delay={300}>
            <Link href="mailto:contact@foyer.app" className="group mt-8 inline-flex items-center gap-2 rounded-full bg-foyer-ink px-6 py-3 text-[15px] font-medium text-foyer-cream transition-transform hover:-translate-y-0.5">
              Discuter d&apos;un partenariat
              <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* FAQ — bg cream */}
      <section className="bg-foyer-cream">
        <div className="mx-auto w-full max-w-4xl px-6 py-16 md:py-20">
          <div className="grid gap-6 md:grid-cols-12 md:items-end md:gap-8">
            <Reveal className="md:col-span-7">
              <p className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-foyer-ink">
                <span className="size-1.5 rounded-full bg-foyer-ink" aria-hidden />
                Questions fréquentes
              </p>
              <h2 className="mt-4 font-serif text-[32px] font-medium leading-[1.02] tracking-[-0.02em] text-foyer-ink md:text-[44px]">
                On répond à tout, sans détour.
              </h2>
            </Reveal>
          </div>
          <Reveal delay={120}>
            <div className="mt-8">
              <FaqAccordion items={FAQ} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* FOOTER — clôture ink */}
      <footer className="bg-foyer-ink text-foyer-cream">
        <div className="mx-auto w-full max-w-6xl px-6 py-12">
          <div className="grid gap-10 md:grid-cols-4">
            <div>
              <span className="font-serif text-xl tracking-tight text-foyer-cream">Foyer</span>
              <p className="mt-3 text-[13px] text-foyer-cream/55">Conçu en France.</p>
            </div>
            <FooterColumn title="Produit" links={["Comment ça marche", "Tarifs", "FAQ"]} />
            <FooterColumn title="Éco" links={["Méthodologie", "Partenaires", "Sources"]} />
            <FooterColumn title="Légal" links={["CGU", "Privacy", "Mentions"]} />
          </div>
          <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-foyer-cream/15 pt-6 text-[13px] text-foyer-cream/55 sm:flex-row sm:items-center">
            <span>© {new Date().getFullYear()} Foyer</span>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-foyer-cream">Instagram</a>
              <a href="#" className="hover:text-foyer-cream">TikTok</a>
              <a href="#" className="hover:text-foyer-cream">LinkedIn</a>
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
      <h3 className="text-[12px] font-medium uppercase tracking-[0.14em] text-foyer-cream">{title}</h3>
      <ul className="mt-4 space-y-2.5 text-[14px] text-foyer-cream/55">
        {links.map((link) => (
          <li key={link}>
            <a href="#" className="hover:text-foyer-cream">{link}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
