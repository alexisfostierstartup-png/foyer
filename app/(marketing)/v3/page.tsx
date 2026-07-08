import type { Metadata } from "next";
import Link from "next/link";
import {
  Armchair,
  ArrowRight,
  ArrowUpRight,
  Camera,
  ClipboardCheck,
  Package,
  RefreshCw,
  ScrollText,
  Search,
  Sprout,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BeforeAfterV2 } from "@/components/landing/v2/parts";
import { ManageCookiesButton } from "@/components/shared/manage-cookies-button";
import {
  Checkpoint,
  CountUp,
  FaqV3,
  LifecycleLoop,
  OrganicDivider,
  PassportCard,
  RevealV3,
  ScoreBar,
  StampSeal,
} from "@/components/landing/v3/parts";
import "./v3.css";

/* ============================================================================
 * Landing v3 — « Le dossier de traçabilité »
 * Angle écologie/traçabilité : la page se lit comme un audit d'impact
 * plutôt qu'une vitrine lifestyle. Chaque section documente une preuve
 * (origine, distance, matière, CO₂) au lieu d'illustrer une ambiance.
 * ========================================================================== */

export const metadata: Metadata = {
  title: "Héra — Le dossier de traçabilité de votre intérieur",
  description:
    "Origine, distance parcourue, matière, CO₂ évité : chaque meuble de votre projet documenté comme une pièce à conviction, pas comme un moodboard.",
};

const CTA = "/create";

const WORDMARK = "/landing/v2/brand/hera-wordmark-regular-alpha.png";

const PASSPORT_ITEMS = [
  {
    swatchSrc: "/landing/test1_apres.png",
    swatchAlt: "Canapé en lin conservé dans le salon rénové",
    status: "CONSERVÉ",
    statusTone: "forest" as const,
    title: "Canapé en lin écru",
    code: "HR-CNP-014",
    rows: [
      { label: "Origine", value: "Existant, Roubaix · 340 km" },
      { label: "Matériau", value: "Lin lavé, piètement hêtre" },
      { label: "Intervention", value: "Aucune — juste repositionné" },
      { label: "Impact évité", value: "≈ 65 kg CO₂ (rachat évité)" },
    ],
  },
  {
    swatchSrc: "/landing/v2/after-living.jpg",
    swatchAlt: "Table basse en chêne conservée",
    status: "CONSERVÉ",
    statusTone: "forest" as const,
    title: "Table basse chêne massif",
    code: "HR-TBL-022",
    rows: [
      { label: "Origine", value: "Existant, atelier local" },
      { label: "Matériau", value: "Chêne massif huilé" },
      { label: "Intervention", value: "Ponçage + huile naturelle" },
      { label: "Impact évité", value: "≈ 40 kg CO₂ (rachat évité)" },
    ],
  },
  {
    swatchSrc: "/landing/test4_apres.png",
    swatchAlt: "Lampadaire vintage chiné sur Selency",
    status: "CHINÉ",
    statusTone: "rust" as const,
    title: "Lampadaire trépied 70's",
    code: "HR-LMP-031",
    rows: [
      { label: "Origine", value: "Selency · vendeur à Lille · 220 km" },
      { label: "Matériau", value: "Laiton brossé, verre opalin" },
      { label: "État", value: "Bon état, testé électriquement" },
      { label: "Impact évité", value: "≈ 18 kg CO₂ vs neuf équivalent" },
    ],
  },
  {
    swatchSrc: "/landing/test9_apres.png",
    swatchAlt: "Tapis berbère neuf durable, atelier Beni Ouarain",
    status: "NEUF DURABLE",
    statusTone: "rust" as const,
    title: "Tapis berbère Beni Ouarain",
    code: "HR-TAP-045",
    rows: [
      { label: "Origine", value: "Atelier Beni Ouarain, Maroc" },
      { label: "Matériau", value: "Laine vierge, noué main" },
      { label: "Sourcing", value: "Import direct, sans intermédiaire" },
      { label: "Garantie", value: "Conçu pour durer 20 ans" },
    ],
  },
];

const CHECKPOINT_ICON_CLS = "size-[18px] text-[var(--v3-forest)] sm:size-5";

const CHECKPOINTS = [
  {
    timestamp: "T+0 JOUR",
    title: "Photographiez",
    description: "Une photo de votre pièce suffit à ouvrir le dossier.",
    icon: <Camera className={CHECKPOINT_ICON_CLS} strokeWidth={1.7} aria-hidden />,
  },
  {
    timestamp: "T+0 JOUR",
    title: "Générons ensemble",
    description: "Un rendu réaliste, construit à partir de ce que vous avez déjà.",
    icon: <ScrollText className={CHECKPOINT_ICON_CLS} strokeWidth={1.7} aria-hidden />,
  },
  {
    timestamp: "T+1 À 5 JOURS",
    title: "Décidez meuble par meuble",
    description: "Gardez, chinez ou remplacez — élément par élément, à votre rythme.",
    icon: <ClipboardCheck className={CHECKPOINT_ICON_CLS} strokeWidth={1.7} aria-hidden />,
  },
  {
    timestamp: "T+9 JOURS EN MOYENNE",
    title: "Recevez vos commandes",
    description: "Paniers groupés par enseigne, livrés directement chez vous.",
    icon: <Package className={CHECKPOINT_ICON_CLS} strokeWidth={1.7} aria-hidden />,
  },
];

const PARTNERS = [
  "Selency",
  "Emmaüs",
  "Maisons du Monde",
  "La Redoute Intérieurs",
  "Tikamoon",
  "AM.PM",
  "Made.com",
  "Bobochic",
];

const PRICING = [
  {
    tab: "Découverte",
    price: "0 €",
    period: "1er dossier",
    features: [
      "1 dossier complet, offert",
      "Passeport matière par meuble",
      "Sourcing multi-enseignes",
    ],
    featured: false,
  },
  {
    tab: "Héra",
    price: "29 €",
    period: "par projet",
    features: [
      "Dossiers illimités",
      "Mode expert, élément par élément",
      "Export PDF du dossier de traçabilité",
      "Priorité reprise et don du mobilier écarté",
    ],
    featured: true,
  },
  {
    tab: "Studio Pro",
    price: "Sur devis",
    period: "B2B",
    features: [
      "Volumétrie et API dédiées",
      "Canal de vente white-label",
      "Reporting impact par enseigne",
    ],
    featured: false,
  },
];

const FAQ = [
  {
    q: "Le score et les kg de CO₂, c'est vérifié ?",
    a: "Basés sur la méthode ADEME (base carbone mobilier), recalculés à chaque dossier selon la part réellement conservée, chinée ou achetée neuve. Nous documentons la méthode de calcul, pas seulement le résultat — elle est consultable dans chaque dossier.",
  },
  {
    q: "Est-ce un simple générateur d'images ?",
    a: "Non. Chaque élément visible dans le rendu est relié à une fiche produit réelle chez un partenaire — avec origine, matière et prix. Ce que vous voyez, vous pouvez le commander.",
  },
  {
    q: "Et si je veux tout remplacer quand même ?",
    a: "Le dossier reste une recommandation, jamais une obligation. Vous décidez meuble par meuble ce qui reste, ce qui se répare, ce qui change.",
  },
  {
    q: "Combien coûte un dossier ?",
    a: "Le premier est offert. Ensuite, 29 € par projet — sans abonnement, sans engagement.",
  },
  {
    q: "Mes photos sont-elles conservées ?",
    a: "Elles restent confidentielles, ne servent jamais à entraîner un modèle, et sont supprimables à tout moment depuis votre compte.",
  },
];

export default function LandingPageV3() {
  return (
    <div className="foyer-v3 v3-grain flex flex-1 flex-col">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-[var(--v3-line)] bg-[var(--v3-paper)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3.5">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={WORDMARK} alt="Héra" className="h-[19px] w-auto" />
          </Link>
          <div className="hidden min-w-0 flex-1 items-center justify-center gap-7 lg:flex">
            <Link href="#passeport" className="v3-mono-label whitespace-nowrap text-[11px] text-[var(--v3-ink)]/65 transition-colors hover:text-[var(--v3-ink)]">
              Passeport matière
            </Link>
            <Link href="#process" className="v3-mono-label whitespace-nowrap text-[11px] text-[var(--v3-ink)]/65 transition-colors hover:text-[var(--v3-ink)]">
              Traçabilité
            </Link>
            <Link href="#partenaires" className="v3-mono-label whitespace-nowrap text-[11px] text-[var(--v3-ink)]/65 transition-colors hover:text-[var(--v3-ink)]">
              Sources
            </Link>
          </div>
          <nav className="flex shrink-0 items-center gap-4">
            <Link href="/auth" className="hidden v3-mono-label whitespace-nowrap text-[11px] text-[var(--v3-ink)]/65 transition-colors hover:text-[var(--v3-ink)] lg:inline">
              Se connecter
            </Link>
            <Link
              href={CTA}
              className="v3-mono-label inline-flex h-9 items-center rounded-full bg-[var(--v3-forest)] px-4 text-[11px] text-[var(--v3-paper)] shadow-[0_2px_10px_rgba(30,40,30,0.25)] transition-colors hover:bg-[var(--v3-forest-bright)]"
            >
              Ouvrir un dossier
            </Link>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden bg-[var(--v3-paper)] pb-16 pt-10 md:pb-24 md:pt-14">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-6">
            <RevealV3 instant>
              <p className="v3-mono-label text-[11px] text-[var(--v3-moss)]">
                Dossier Nº HR-2026-0417 · Salon, Paris 11e
              </p>
            </RevealV3>
            <RevealV3 instant delay={80}>
              <h1 className="font-display-v3 mt-5 text-[36px] leading-[1.06] text-[var(--v3-ink)] md:text-[48px] lg:text-[54px]">
                Chaque meuble a une fiche.
                <br />
                Chaque fiche, une preuve.
              </h1>
            </RevealV3>
            <RevealV3 instant delay={160}>
              <p className="mt-6 max-w-md text-[17px] leading-[1.6] text-[var(--v3-ink)]/65">
                Avant de vous montrer un rendu, nous documentons ce qu&apos;il y a dedans&nbsp;:
                origine, distance parcourue, matière, CO₂ évité. Pas un moodboard —
                un dossier que vous pouvez vérifier, ligne par ligne.
              </p>
            </RevealV3>
            <RevealV3 instant delay={240}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href={CTA}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--v3-forest)] px-6 text-[14px] font-semibold text-[var(--v3-paper)] shadow-[0_4px_18px_rgba(30,45,30,0.35)] transition-colors hover:bg-[var(--v3-forest-bright)]"
                >
                  Ouvrir mon dossier
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link
                  href="#passeport"
                  className="inline-flex h-11 items-center rounded-full border border-[var(--v3-line)] px-5 text-[13px] font-medium text-[var(--v3-ink)] transition-colors hover:border-[var(--v3-forest)]"
                >
                  Voir un exemple de fiche
                </Link>
              </div>
              <p className="v3-mono-label mt-5 text-[10px] text-[var(--v3-ink)]/40">
                Premier dossier offert · sans abonnement
              </p>
            </RevealV3>
          </div>

          <RevealV3 instant delay={200} className="md:col-span-6">
            <div className="relative">
              <span className="v3-mono-label absolute -top-3 left-5 z-10 -rotate-2 rounded-sm bg-[var(--v3-ink)] px-2.5 py-1 text-[9px] text-[var(--v3-paper)] shadow-[0_4px_10px_rgba(20,24,18,0.3)]">
                Pièce jointe Nº1
              </span>
              <div className="overflow-hidden rounded-[10px] bg-[var(--v3-card)] p-2 ring-1 ring-[var(--v3-line)] shadow-[0_28px_60px_-24px_rgba(20,24,18,0.5)]">
                <div className="overflow-hidden rounded-[6px]">
                  <BeforeAfterV2
                    beforeSrc="/landing/test1.jpg"
                    afterSrc="/landing/test1_apres.png"
                    beforeAlt="Salon avant intervention"
                    afterAlt="Salon après le dossier Héra"
                  />
                </div>
              </div>
              <div className="absolute -bottom-5 -right-3 md:-right-5">
                <StampSeal label="Audité" sub="Score A+" tone="forest" className="bg-[var(--v3-paper)]" />
              </div>
            </div>
          </RevealV3>
        </div>
      </section>

      <OrganicDivider dir="to-deep" />

      {/* LE RELEVÉ — compteurs incrémentés au scroll */}
      <section className="bg-[var(--v3-paper-deep)]">
        <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
          <RevealV3>
            <p className="v3-mono-label text-[11px] text-[var(--v3-moss)]">Le relevé</p>
          </RevealV3>
          <RevealV3 delay={60}>
            <h2 className="font-display-v3 mt-3 max-w-2xl text-[26px] leading-[1.1] text-[var(--v3-ink)] md:text-[36px]">
              Ce que documente un dossier Héra, en moyenne.
            </h2>
          </RevealV3>

          <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4 md:gap-8">
            {[
              { value: 62, suffix: "%", label: "du mobilier conservé, pas remplacé" },
              { value: 340, prefix: "− ", suffix: " kg", label: "CO₂ évités par projet (de −240 à −380 kg selon le mobilier existant)" },
              { value: 9, suffix: " jours", label: "entre la photo et la première commande" },
              { value: 1240, prefix: "≈ ", suffix: " €", label: "budget moyen investi, tous postes confondus" },
            ].map((s, i) => (
              <RevealV3 key={s.label} delay={i * 90}>
                <p className="font-display-v3 text-[34px] leading-none text-[var(--v3-ink)] md:text-[44px]">
                  <CountUp value={s.value} prefix={s.prefix} suffix={s.suffix} />
                </p>
                <p className="mt-3 text-[12.5px] leading-snug text-[var(--v3-ink)]/55">{s.label}</p>
              </RevealV3>
            ))}
          </div>
        </div>
      </section>

      <OrganicDivider dir="to-paper" />

      {/* PASSEPORT MATIÈRE */}
      <section id="passeport" className="scroll-mt-24 bg-[var(--v3-paper)]">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
          <div className="max-w-2xl">
            <RevealV3>
              <p className="v3-mono-label text-[11px] text-[var(--v3-moss)]">Passeport matière</p>
            </RevealV3>
            <RevealV3 delay={60}>
              <h2 className="font-display-v3 mt-3 text-[28px] leading-[1.08] text-[var(--v3-ink)] md:text-[40px]">
                Ce qui compose ce salon, ligne par ligne.
              </h2>
            </RevealV3>
            <RevealV3 delay={120}>
              <p className="mt-4 text-[15px] leading-[1.6] text-[var(--v3-ink)]/60">
                Pas un inventaire décoratif — une fiche d&apos;audit par meuble. Origine,
                distance parcourue, matière, et l&apos;impact réellement évité ou réduit.
              </p>
            </RevealV3>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PASSPORT_ITEMS.map((item, i) => (
              <PassportCard key={item.code} {...item} delay={i * 90} />
            ))}
          </div>
        </div>
      </section>

      {/* EXHIBIT PHOTO — full-bleed, pause visuelle documentaire */}
      <section className="relative">
        <div className="relative h-[46vh] min-h-[280px] w-full overflow-hidden md:h-[56vh]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/v2/arch-3.jpg"
            alt="Relevé terrain avant intervention"
            className="h-full w-full object-cover"
            style={{ filter: "grayscale(10%) contrast(1.04)" }}
          />
          <div aria-hidden className="absolute inset-0 bg-linear-to-t from-[var(--v3-ink)]/70 via-transparent to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4 md:bottom-8 md:left-8 md:right-8">
            <p className="v3-mono-label text-[10px] text-white/85 md:text-[11px]">
              Pièce jointe Nº2 · Relevé terrain avant intervention
            </p>
            <p className="v3-mono-label hidden text-[10px] text-white/60 sm:block">
              Lat. 48.86 · Long. 2.35
            </p>
          </div>
        </div>
      </section>

      <OrganicDivider dir="to-deep" />

      {/* CYCLE DE VIE — boucle, pas une grille à 4 colonnes */}
      <section className="bg-[var(--v3-paper-deep)]">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
          <div className="mx-auto max-w-xl text-center">
            <RevealV3>
              <p className="v3-mono-label text-[11px] text-[var(--v3-moss)]">Le principe</p>
            </RevealV3>
            <RevealV3 delay={60}>
              <h2 className="font-display-v3 mt-3 text-[28px] leading-[1.1] text-[var(--v3-ink)] md:text-[38px]">
                Garder, chiner, réparer — et n&apos;acheter neuf qu&apos;en dernier recours.
              </h2>
            </RevealV3>
            <RevealV3 delay={120}>
              <p className="mt-4 text-[14.5px] leading-[1.6] text-[var(--v3-ink)]/60">
                Un principe simple guide chaque recommandation du dossier&nbsp;: on ne
                remplace que ce qui doit vraiment l&apos;être — et dans cet ordre.
              </p>
            </RevealV3>
          </div>

          <div className="mt-14">
            <LifecycleLoop
              nodes={[
                { icon: <Armchair className="size-5 text-[var(--v3-forest)] sm:size-6" strokeWidth={1.6} aria-hidden />, num: "01", title: "Garder", sub: "Ce qui tient encore reste en place." },
                { icon: <Search className="size-5 text-[var(--v3-forest)] sm:size-6" strokeWidth={1.6} aria-hidden />, num: "02", title: "Chiner", sub: "Seconde main d'abord, sur nos plateformes." },
                { icon: <RefreshCw className="size-5 text-[var(--v3-forest)] sm:size-6" strokeWidth={1.6} aria-hidden />, num: "03", title: "Réparer", sub: "Reprise, don ou remise en état." },
                { icon: <Sprout className="size-5 text-[var(--v3-forest)] sm:size-6" strokeWidth={1.6} aria-hidden />, num: "04", title: "Neuf durable", sub: "En dernier — et choisi pour durer." },
              ]}
            />
          </div>
        </div>
      </section>

      <OrganicDivider dir="to-paper" />

      {/* PROCESS — chaîne de traçabilité horodatée */}
      <section id="process" className="scroll-mt-24 bg-[var(--v3-paper)]">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
          <div className="max-w-2xl">
            <RevealV3>
              <p className="v3-mono-label text-[11px] text-[var(--v3-moss)]">Chaîne de traçabilité</p>
            </RevealV3>
            <RevealV3 delay={60}>
              <h2 className="font-display-v3 mt-3 text-[28px] leading-[1.1] text-[var(--v3-ink)] md:text-[38px]">
                De la photo à la commande, horodaté.
              </h2>
            </RevealV3>
          </div>

          <div className="relative mt-14">
            <span
              aria-hidden
              className="pointer-events-none absolute left-[22px] top-2 bottom-2 z-0 w-px bg-[var(--v3-line)] sm:left-0 sm:right-0 sm:top-[22px] sm:bottom-auto sm:h-px sm:w-auto"
            />
            <div className="relative flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              {CHECKPOINTS.map((c, i) => (
                <div key={c.title} className="sm:flex-1">
                  <Checkpoint {...c} index={i} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <OrganicDivider dir="to-deep" />

      {/* MÉTHODOLOGIE — comment le score est calculé */}
      <section className="bg-[var(--v3-paper-deep)]">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-16">
          <div className="grid gap-10 md:grid-cols-[1fr_1.2fr] md:gap-14">
            <div>
              <RevealV3>
                <p className="v3-mono-label text-[11px] text-[var(--v3-moss)]">Méthodologie</p>
              </RevealV3>
              <RevealV3 delay={60}>
                <h2 className="font-display-v3 mt-3 text-[26px] leading-[1.12] text-[var(--v3-ink)] md:text-[32px]">
                  Comment le score est calculé.
                </h2>
              </RevealV3>
              <RevealV3 delay={120}>
                <p className="mt-4 text-[14px] leading-[1.6] text-[var(--v3-ink)]/60">
                  Chaque dossier est noté selon la part de mobilier conservé, chiné et
                  neuf, pondérée par son impact carbone estimé (base ADEME). Le transport
                  compte aussi&nbsp;: un meuble chiné à 400&nbsp;km n&apos;est pas neutre.
                </p>
              </RevealV3>
            </div>

            <RevealV3 delay={140}>
              <div className="rounded-[10px] bg-[var(--v3-card)] p-6 ring-1 ring-[var(--v3-line)] md:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="v3-mono-label text-[10px] text-[var(--v3-ink)]/45">
                      Exemple de dossier
                    </p>
                    <p className="mt-1 text-[14px] text-[var(--v3-ink)]">Salon parisien, 24 m²</p>
                  </div>
                  <StampSeal label="A+" sub="Score dossier" tone="forest" />
                </div>
                <div className="mt-6">
                  <ScoreBar
                    segments={[
                      { value: 68, color: "var(--v3-forest)", label: "Conservé" },
                      { value: 22, color: "var(--v3-moss)", label: "Occasion" },
                      { value: 10, color: "var(--v3-sage)", label: "Neuf durable" },
                    ]}
                  />
                </div>
                <p className="v3-mono-label mt-6 border-t border-dashed border-[var(--v3-line)] pt-4 text-[9px] text-[var(--v3-ink)]/35">
                  Méthode ADEME · Base carbone mobilier · Révisée annuellement
                </p>
              </div>
            </RevealV3>
          </div>
        </div>
      </section>

      <OrganicDivider dir="to-paper" />

      {/* SOURCES DOCUMENTÉES — partenaires */}
      <section id="partenaires" className="scroll-mt-24 bg-[var(--v3-paper)]">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-16">
          <RevealV3>
            <p className="v3-mono-label text-[11px] text-[var(--v3-moss)]">Sources documentées</p>
          </RevealV3>
          <RevealV3 delay={60}>
            <h2 className="font-display-v3 mt-3 max-w-2xl text-[26px] leading-[1.12] text-[var(--v3-ink)] md:text-[34px]">
              Chaque produit du dossier est traçable jusqu&apos;à son enseigne.
            </h2>
          </RevealV3>

          <RevealV3 delay={120}>
            <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-dashed border-[var(--v3-line)] pt-6 sm:grid-cols-4">
              {PARTNERS.map((name, i) => (
                <li key={name} className="flex items-baseline gap-2">
                  <span className="v3-mono-label text-[9px] text-[var(--v3-ink)]/30">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[14px] text-[var(--v3-ink)]/75">{name}</span>
                </li>
              ))}
            </ul>
          </RevealV3>
        </div>
      </section>

      <OrganicDivider dir="to-deep" />

      {/* GRILLE TARIFAIRE */}
      <section className="bg-[var(--v3-paper-deep)]">
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
          <RevealV3>
            <p className="v3-mono-label text-[11px] text-[var(--v3-moss)]">Grille tarifaire</p>
          </RevealV3>
          <RevealV3 delay={60}>
            <h2 className="font-display-v3 mt-3 max-w-2xl text-[26px] leading-[1.12] text-[var(--v3-ink)] md:text-[34px]">
              Un dossier, trois façons de l&apos;ouvrir.
            </h2>
          </RevealV3>

          <div className="mt-14 grid gap-x-6 gap-y-12 sm:grid-cols-3">
            {PRICING.map((plan, i) => (
              <RevealV3 key={plan.tab} delay={i * 100} className="relative">
                <div className="relative mt-5">
                  <span
                    className={cn(
                      "v3-mono-label absolute -top-5 left-5 z-10 rounded-t-[5px] px-3 py-1.5 text-[10px]",
                      plan.featured
                        ? "bg-[var(--v3-forest)] text-[var(--v3-paper)]"
                        : "bg-[var(--v3-card)] text-[var(--v3-ink)]/70 ring-1 ring-[var(--v3-line)]",
                    )}
                  >
                    {plan.tab}
                  </span>
                  <div
                    className={cn(
                      "flex h-full flex-col rounded-b-[8px] rounded-tr-[8px] p-6 pt-8",
                      plan.featured
                        ? "bg-[var(--v3-ink)] text-[var(--v3-paper)] shadow-[0_20px_50px_-20px_rgba(20,24,18,0.55)]"
                        : "bg-[var(--v3-card)] ring-1 ring-[var(--v3-line)]",
                    )}
                  >
                    <p className={cn("font-display-v3 text-[30px]", plan.featured ? "text-[var(--v3-paper)]" : "text-[var(--v3-ink)]")}>
                      {plan.price}
                    </p>
                    <p className={cn("v3-mono-label text-[10px]", plan.featured ? "text-[var(--v3-paper)]/55" : "text-[var(--v3-ink)]/40")}>
                      {plan.period}
                    </p>
                    <ul className="mt-6 flex-1 space-y-3">
                      {plan.features.map((f) => (
                        <li
                          key={f}
                          className={cn(
                            "flex items-start gap-2.5 text-[13px] leading-snug",
                            plan.featured ? "text-[var(--v3-paper)]/85" : "text-[var(--v3-ink)]/70",
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn("mt-1.5 size-1 shrink-0 rounded-full", plan.featured ? "bg-[var(--v3-sage)]" : "bg-[var(--v3-forest)]")}
                          />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={CTA}
                      className={cn(
                        "mt-7 inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-[13px] font-medium transition-colors",
                        plan.featured
                          ? "bg-[var(--v3-paper)] text-[var(--v3-ink)] hover:bg-[var(--v3-paper)]/90"
                          : "border border-[var(--v3-line)] text-[var(--v3-ink)] hover:border-[var(--v3-forest)]",
                      )}
                    >
                      Choisir
                      <ArrowUpRight className="size-3.5" aria-hidden />
                    </Link>
                  </div>
                </div>
              </RevealV3>
            ))}
          </div>
        </div>
      </section>

      <OrganicDivider dir="to-paper" />

      {/* FAQ — annexes de dossier */}
      <section id="faq" className="scroll-mt-24 bg-[var(--v3-paper)]">
        <div className="mx-auto max-w-4xl px-6 py-14 md:py-20">
          <RevealV3>
            <p className="v3-mono-label text-center text-[11px] text-[var(--v3-moss)]">
              Annexes de dossier
            </p>
          </RevealV3>
          <RevealV3 delay={60}>
            <h2 className="font-display-v3 mt-3 text-center text-[30px] leading-[1.08] text-[var(--v3-ink)] md:text-[42px]">
              Notes de bas de dossier.
            </h2>
          </RevealV3>
          <RevealV3 delay={120}>
            <div className="mt-10">
              <FaqV3 items={FAQ} />
            </div>
          </RevealV3>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="bg-[var(--v3-paper)] px-6 pb-16">
        <RevealV3>
          <div className="relative mx-auto max-w-[760px] overflow-hidden rounded-[14px] bg-[var(--v3-ink)] px-8 py-14 text-center md:px-14 md:py-16">
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{
              backgroundImage: "radial-gradient(circle at 20% 20%, white 0, transparent 45%)",
            }} />
            <div className="relative flex justify-center">
              <StampSeal label="Approuvé" sub="Dossier complet" tone="rust" className="!bg-transparent" />
            </div>
            <h2 className="font-display-v3 mt-7 text-[32px] leading-[1.05] text-[var(--v3-paper)] md:text-[46px]">
              Ouvrez votre dossier.
            </h2>
            <p className="mx-auto mt-4 max-w-sm text-[14.5px] leading-relaxed text-[var(--v3-paper)]/60">
              Une photo suffit pour démarrer le vôtre — origine, matière et CO₂
              évité, documentés dès le premier rendu.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={CTA}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--v3-forest-bright)] px-8 py-3.5 text-[15px] font-semibold text-[var(--v3-paper)] shadow-[0_4px_20px_rgba(90,130,90,0.4)] transition-colors hover:bg-[var(--v3-moss)]"
              >
                Ouvrir mon dossier
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="#faq"
                className="inline-flex items-center rounded-full bg-white/10 px-8 py-3.5 text-[15px] font-semibold text-[var(--v3-paper)] transition-colors hover:bg-white/15"
              >
                Voir les annexes
              </Link>
            </div>
            <p className="v3-mono-label mt-6 text-[10px] text-[var(--v3-paper)]/35">
              Premier dossier offert · sans abonnement
            </p>
          </div>
        </RevealV3>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[var(--v3-line)] bg-[var(--v3-paper)]">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid gap-10 md:grid-cols-4">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={WORDMARK} alt="Héra" className="h-[18px] w-auto" />
              <p className="mt-3 text-[13px] text-[var(--v3-ink)]/55">
                Conçu en France. Documenté partout.
              </p>
            </div>
            <FooterColumn
              title="Produit"
              links={[
                { label: "Passeport matière", href: "#passeport" },
                { label: "Grille tarifaire", href: "#" },
                { label: "Annexes / FAQ", href: "#faq" },
              ]}
            />
            <FooterColumn
              title="Plans"
              links={[
                { label: "Foyer Expert", href: "/features" },
                { label: "Foyer Pro", href: "/pro" },
              ]}
            />
            <div>
              <h3 className="v3-mono-label text-[11px] text-[var(--v3-ink)]/70">Légal</h3>
              <ul className="mt-4 space-y-2.5 text-[14px] text-[var(--v3-ink)]/55">
                <li>
                  <Link href="/mentions-legales" className="hover:text-[var(--v3-ink)]">
                    Mentions légales
                  </Link>
                </li>
                <li>
                  <Link href="/confidentialite" className="hover:text-[var(--v3-ink)]">
                    Confidentialité
                  </Link>
                </li>
                <li>
                  <Link href="/cookies" className="hover:text-[var(--v3-ink)]">
                    Cookies
                  </Link>
                </li>
                <li>
                  <ManageCookiesButton className="hover:text-[var(--v3-ink)]" />
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-dashed border-[var(--v3-line)] pt-6 text-[13px] text-[var(--v3-ink)]/50 sm:flex-row sm:items-center">
            <span>© {new Date().getFullYear()} Héra</span>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-[var(--v3-ink)]">Instagram</a>
              <a href="#" className="hover:text-[var(--v3-ink)]">TikTok</a>
              <a href="#" className="hover:text-[var(--v3-ink)]">LinkedIn</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h3 className="v3-mono-label text-[11px] text-[var(--v3-ink)]/70">{title}</h3>
      <ul className="mt-4 space-y-2.5 text-[14px] text-[var(--v3-ink)]/55">
        {links.map((link) => (
          <li key={link.label}>
            <Link href={link.href} className="hover:text-[var(--v3-ink)]">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
