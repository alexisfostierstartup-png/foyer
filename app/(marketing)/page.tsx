import type { Metadata } from "next";
import Link from "next/link";
import {
  Leaf,
  ArrowUpRight,
  ArrowRight,
  Camera,
  Sparkles,
  Recycle,
  Package,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RevealV2, BeforeAfterV2, FaqV2 } from "@/components/landing/v2/parts";

/* ============================================================================
 * Landing v2 — réplique éditoriale, marque « Héra » (charte de marque Héra).
 * Deux écarts volontaires vs l'original :
 *   1. Le hero n'a plus la ligne « Studio · Paris / N°07 / Faites défiler ».
 *   2. La section « Impact mesuré / Moins de neuf » est remplacée par
 *      « Ce que vous voyez, vous pouvez l'avoir » (rendu shoppable).
 * L'ancienne landing (/) n'est pas touchée.
 * ========================================================================== */

export const metadata: Metadata = {
  title: "Héra — Votre pièce, transformée. Durablement.",
};

const CTA = "/create";

const IMG = {
  before: "/landing/v2/before-living.jpg",
  after: "/landing/v2/after-living.jpg",
  arch1: "/landing/v2/arch-1.jpg",
  arch2: "/landing/v2/arch-2.jpg",
  arch3: "/landing/v2/arch-3.jpg",
  arch4: "/landing/v2/arch-4.jpg",
  // Photos réelles (Wizard-of-Oz)
  heroBefore: "/landing/test1.jpg",
  heroAfter: "/landing/test1_apres.png",
  salonParisienBefore: "/landing/test4.jpeg",
  salonParisien: "/landing/test4_apres.png",
  japandiBefore: "/landing/test9.png",
  japandi: "/landing/test9_apres.png",
};

const NAV = [
  { label: "Manifeste", href: "#manifesto" },
  { label: "Méthode", href: "#process" },
  { label: "Projets", href: "#gallery" },
  { label: "Partenaires", href: "#partners" },
  { label: "Tarifs", href: "#pricing" },
];

export default function LandingV2() {
  return (
    <div className="foyer-v2 min-h-screen bg-paper text-foreground overflow-x-hidden">
      <Header />
      <Hero />
      <WaveDivider variant="bone" />
      <Manifesto />
      <WaveDivider variant="to-bg" />
      <Process />
      <DottedDivider />
      <Gallery />
      <WaveDivider variant="bone-clay" />
      <Shoppable />
      <WaveDivider variant="to-bg" />
      <Partners />
      <WaveDivider variant="bone" flip />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* -------------------------------- HEADER -------------------------------- */

function Header() {
  return (
    <header className="fixed top-4 left-0 right-0 z-50 px-4">
      <div
        className="mx-auto max-w-6xl rounded-full bg-cream/60 backdrop-blur-xl backdrop-saturate-150 ring-1 ring-white/40 shadow-[0_8px_32px_rgba(31,27,22,0.12),inset_0_1px_0_rgba(255,255,255,0.6)] flex items-center justify-between pl-5 pr-2 py-2"
        style={{ WebkitBackdropFilter: "blur(20px) saturate(1.5)" }}
      >
        <Link href={CTA} className="flex items-center gap-2 ml-2" aria-label="Héra">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/v2/brand/hera-logo-mark-bold.png" alt="" className="h-6 w-auto" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/v2/brand/hera-wordmark-regular-alpha.png" alt="Héra" className="h-5 w-auto" />
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-[13px] text-muted-foreground">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="hover:text-foreground transition">
              {n.label}
            </a>
          ))}
        </nav>
        <Link
          href={CTA}
          className="rounded-full bg-ink text-cream px-4 py-2 text-[13px] font-medium hover:opacity-90 transition flex items-center gap-1.5"
        >
          Commencer <span aria-hidden>→</span>
        </Link>
      </div>
    </header>
  );
}

/* --------------------------------- HERO --------------------------------- */

function Hero() {
  return (
    <section className="relative pt-32 sm:pt-40 pb-20 sm:pb-28 grain">
      <div className="mx-auto max-w-7xl px-5 grid lg:grid-cols-12 gap-10 lg:gap-10 items-center">
        <div className="lg:col-span-6 relative z-10">
          <RevealV2 instant>
            <h1 className="font-display text-[13vw] sm:text-[8.5vw] lg:text-[100px] leading-[0.9] tracking-[-0.04em] text-balance">
              Votre <em className="italic font-light text-foreground">pièce</em>,<br />
              transformée.<br />
              <span className="text-clay">Durablement.</span>
            </h1>
          </RevealV2>
          <RevealV2 instant delay={80}>
            <p className="mt-8 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              Héra est un studio de design d&apos;intérieur augmenté par l&apos;IA. On part de votre pièce, telle
              qu&apos;elle est. On garde, on chine, on sélectionne le neuf qui dure — puis on prépare les commandes
              chez les bonnes maisons.
            </p>
          </RevealV2>
          <RevealV2 instant delay={160}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={CTA}
                className="group inline-flex items-center gap-3 rounded-full bg-clay text-cream pl-5 pr-2 py-2 text-[14px] font-medium hover:opacity-90 transition shadow-card"
              >
                Commencer un projet
                <span className="grid place-items-center h-8 w-8 rounded-full bg-forest text-cream group-hover:rotate-45 transition-transform">
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </span>
              </Link>
              <a href="#gallery" className="text-[14px] underline underline-offset-4 decoration-stone hover:decoration-foreground">
                Voir les projets
              </a>
            </div>
          </RevealV2>
          <RevealV2 instant delay={240}>
            <div className="mt-6 inline-flex flex-wrap items-center gap-x-4 gap-y-2 rounded-full bg-cream ring-1 ring-line shadow-card px-5 py-2.5 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-forest" />62 % conservé</span>
              <span className="h-3.5 w-px bg-line" aria-hidden />
              <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-clay" />−340 kg CO₂</span>
              <span className="h-3.5 w-px bg-line" aria-hidden />
              <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-ocre" />9 jours</span>
            </div>
          </RevealV2>
        </div>

        <div className="lg:col-span-6 relative">
          <RevealV2 instant from="translateY(40px)" delay={120}>
            <div className="relative">
              <div className="rounded-3xl overflow-hidden shadow-card-lg ring-1 ring-line bg-cream">
                <BeforeAfterV2 beforeSrc={IMG.heroBefore} afterSrc={IMG.heroAfter} />
              </div>
              <div className="absolute -bottom-6 -left-4 sm:-left-8 flex flex-col items-center justify-center gap-0.5 rounded-full bg-clay text-cream h-24 w-24 sm:h-28 sm:w-28 text-center shadow-card-lg ring-4 ring-paper">
                <span className="text-[9px] uppercase tracking-[0.2em] opacity-80">Score Éco</span>
                <span className="font-display text-3xl leading-none">A+</span>
                <span className="text-[10px] opacity-90">68 / 22 / 10</span>
              </div>
              <div className="absolute -top-4 -right-3 sm:-right-6 bg-cream ring-1 ring-line rounded-xl shadow-card px-3 py-2 text-[11px] uppercase tracking-[0.18em]">
                <span className="text-muted-foreground">Projet 07 ·</span> <span className="text-forest">−240 kg CO₂</span>
              </div>
            </div>
          </RevealV2>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- MANIFESTO ------------------------------- */

const INVENTORY: { n: string; name: string; note: string; tag: string; cls: string }[] = [
  { n: "01", name: "Canapé en lin", note: "Bon état, structure massive", tag: "Conservé", cls: "bg-clay/10 text-clay ring-clay/30" },
  { n: "02", name: "Table basse chêne", note: "À huiler, garder", tag: "Conservé", cls: "bg-clay/10 text-clay ring-clay/30" },
  { n: "03", name: "Lampadaire 70's", note: "Trouvé chez Selency", tag: "Chiné", cls: "bg-ocre/15 text-terre ring-ocre/30" },
  { n: "04", name: "Tapis berbère", note: "Atelier Beni Ouarain", tag: "Neuf durable", cls: "bg-forest/10 text-forest ring-forest/20" },
];

function Manifesto() {
  return (
    <section id="manifesto" className="relative py-16 sm:py-20 px-5 bg-bone">
      <div className="mx-auto max-w-6xl grid lg:grid-cols-12 gap-12 lg:gap-16">
        <div className="lg:col-span-5 lg:sticky lg:top-32 lg:self-start">
          <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-clay">
            <span className="h-px w-6 bg-current opacity-60" />Avant tout
          </span>
          <RevealV2>
            <h2 className="mt-6 font-display text-5xl sm:text-6xl lg:text-7xl text-balance">
              D&apos;abord, on regarde <em className="italic text-clay font-light">ce que vous avez déjà.</em>
            </h2>
          </RevealV2>
          <RevealV2 delay={80}>
            <p className="mt-6 text-[15px] text-muted-foreground max-w-md leading-relaxed">
              Avant de proposer du neuf, Héra identifie chaque meuble de votre pièce et propose la décision la plus
              juste : <strong className="text-foreground">garder</strong>, customiser, chiner ou remplacer. Parce
              qu&apos;un meuble déjà chez vous, c&apos;est zéro carbone, zéro emballage, zéro camion.
            </p>
          </RevealV2>
          <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-cream ring-1 ring-line px-4 py-2 text-[12px] shadow-card">
            <span className="h-2 w-2 rounded-full bg-clay animate-pulse" />En moyenne,&nbsp;
            <strong className="text-foreground">62 % des meubles</strong>&nbsp;sont conservés
          </div>
        </div>

        <div className="lg:col-span-7 relative">
          <div className="relative space-y-5">
            {INVENTORY.map((item, i) => {
              const even = i % 2 === 1;
              return (
                <RevealV2
                  key={item.n}
                  delay={i * 70}
                  from={`translateX(${even ? 16 : -8}px) translateY(24px) rotate(${even ? 0.6 : -0.6}deg)`}
                  style={{ marginLeft: i * 14 }}
                  className="group relative bg-card rounded-2xl ring-1 ring-line shadow-card p-5 sm:p-6 flex items-center gap-5 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-card-lg hover:ring-clay/40"
                >
                  <span className="font-display text-4xl text-clay leading-none w-14">{item.n}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-xl">{item.name}</h3>
                    <p className="text-[12px] text-muted-foreground mt-0.5">{item.note}</p>
                  </div>
                  <span className={`text-[11px] uppercase tracking-[0.18em] px-3 py-1 rounded-full ring-1 whitespace-nowrap ${item.cls}`}>
                    {item.tag}
                  </span>
                </RevealV2>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- PROCESS -------------------------------- */

const STEPS: { n: string; img: string; icon: LucideIcon; title: string; body: string }[] = [
  { n: "01", img: IMG.arch4, icon: Camera, title: "Photographiez", body: "Une pièce, une photo. Le plus naturel possible." },
  { n: "02", img: IMG.arch1, icon: Sparkles, title: "Générons ensemble", body: "L'IA propose une ambiance fidèle à votre style." },
  { n: "03", img: IMG.arch2, icon: Recycle, title: "Décidez meuble par meuble", body: "Garder, customiser, chiner, remplacer." },
  { n: "04", img: IMG.arch3, icon: Package, title: "Recevez vos commandes", body: "Préparées chez les bons partenaires, groupées." },
];

function Process() {
  return (
    <section id="process" className="relative py-16 sm:py-20 overflow-hidden">
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex items-end justify-between flex-wrap gap-6 mb-16">
          <div>
            <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-clay">
              <span className="h-px w-6 bg-current opacity-60" />Méthode
            </span>
            <h2 className="mt-5 font-display text-4xl sm:text-5xl lg:text-[52px] lg:whitespace-nowrap">
              Quatre temps. <em className="italic text-clay font-light">Zéro friction.</em>
            </h2>
          </div>
          <p className="text-[14px] text-muted-foreground max-w-xs">
            De la photo à la livraison, Héra orchestre chaque étape — vous gardez la décision.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map((s, i) => (
            <RevealV2
              key={s.n}
              delay={i * 90}
              from="translateY(30px)"
              className="group relative rounded-2xl bg-card ring-1 ring-line shadow-card overflow-hidden hover:shadow-card-lg transition"
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.img} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-linear-to-t from-forest/90 via-forest/30 to-transparent" />
                <span className="absolute top-4 left-4 font-display text-5xl text-cream">{s.n}</span>
                <span className="absolute top-5 right-4 grid place-items-center h-8 w-8 rounded-full bg-cream/90 backdrop-blur">
                  <s.icon className="h-4 w-4 text-forest" aria-hidden />
                </span>
                <div className="absolute bottom-5 left-5 right-5 text-cream">
                  <h3 className="font-display text-2xl">{s.title}</h3>
                  <p className="mt-2 text-[13px] text-cream/85 leading-snug">{s.body}</p>
                </div>
              </div>
            </RevealV2>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- GALLERY -------------------------------- */

const PROJECTS: { img: string; before?: string; tag: string; name: string; surface: string; conserve: string }[] = [
  { img: IMG.salonParisien, before: IMG.salonParisienBefore, tag: "Haussmann", name: "Salon Parisien", surface: "32 m²", conserve: "68%" },
  { img: IMG.japandi, before: IMG.japandiBefore, tag: "Studio", name: "Chambre Japandi", surface: "14 m²", conserve: "55%" },
  { img: IMG.arch4, tag: "Maison", name: "Salle à manger", surface: "22 m²", conserve: "72%" },
];

function Gallery() {
  return (
    <section id="gallery" className="relative pt-8 pb-16 sm:pt-10 sm:pb-24 px-5 grain">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl mb-12">
          <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-forest">
            <span className="h-px w-6 bg-current opacity-60" />Exemples de projets
          </span>
          <p className="mt-5 text-[15px] text-muted-foreground leading-relaxed">
            Ces projets sont fictifs, créés à titre d&apos;illustration. Héra ne fait aucun usage des
            photos que vous téléversez sur la plateforme — elles servent uniquement à générer votre rendu.
          </p>
        </div>

        <RevealV2 from="translateY(40px)" className="relative rounded-3xl overflow-hidden ring-1 ring-line shadow-card-lg bg-card">
          <div className="grid sm:grid-cols-2 gap-0 relative">
            <div className="relative aspect-[4/5] sm:aspect-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG.before} alt="Salon avant transformation" className="absolute inset-0 w-full h-full object-cover" />
            </div>
            <div className="relative aspect-[4/5] sm:aspect-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG.after} alt="Salon après transformation" className="absolute inset-0 w-full h-full object-cover" />
            </div>
          </div>
          <div className="p-6 sm:p-8 flex flex-wrap items-end justify-between gap-6 bg-bone">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Projet 07 · Haussmann</p>
              <h3 className="mt-2 font-display text-3xl sm:text-4xl">Salon parisien, conservé à 68 %</h3>
            </div>
            <div className="flex flex-wrap items-end gap-8 sm:gap-10">
              <div className="flex items-center gap-8 text-[12px]">
                <div>
                  <p className="text-muted-foreground uppercase tracking-wider">Surface</p>
                  <p className="font-display text-2xl mt-1">32 m²</p>
                </div>
                <div>
                  <p className="text-muted-foreground uppercase tracking-wider">CO₂ évité</p>
                  <p className="font-display text-2xl mt-1 text-clay">−380 kg</p>
                </div>
                <div>
                  <p className="text-muted-foreground uppercase tracking-wider">Budget</p>
                  <p className="font-display text-2xl mt-1">1 240 €</p>
                </div>
              </div>
              <Link
                href={CTA}
                className="group inline-flex items-center gap-2 rounded-full bg-ink text-cream px-5 py-2.5 text-[13px] font-medium hover:opacity-90 transition"
              >
                Découvrir
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:rotate-45" aria-hidden />
              </Link>
            </div>
          </div>
        </RevealV2>

        <div className="mt-8 grid sm:grid-cols-3 gap-5">
          {PROJECTS.map((p, i) => (
            <RevealV2
              key={p.name}
              delay={i * 90}
              from="translateY(30px)"
              className="group relative rounded-2xl overflow-hidden ring-1 ring-line bg-card shadow-card cursor-pointer"
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                {p.before ? (
                  <BeforeAfterV2 beforeSrc={p.before} afterSrc={p.img} beforeAlt={`${p.name} — avant`} afterAlt={`${p.name} — après`} fill compact />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={p.img} alt={p.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                )}
                <span className="absolute top-3 left-3 z-10 bg-cream/90 backdrop-blur px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[0.18em]">{p.tag}</span>
                {!p.before && (
                  <span className="absolute top-3 right-3 grid place-items-center h-8 w-8 rounded-full bg-clay text-cream opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition">
                    <ArrowUpRight className="h-4 w-4" aria-hidden />
                  </span>
                )}
              </div>
              <div className="p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg">{p.name}</h3>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{p.surface}</p>
                </div>
                <span className="text-[11px] text-clay font-medium">Conservé {p.conserve}</span>
              </div>
            </RevealV2>
          ))}
        </div>

        <div className="mt-10 flex justify-end">
          <a href="#" className="text-[13px] underline underline-offset-4 decoration-stone hover:decoration-foreground">
            Voir toutes les transformations →
          </a>
        </div>
      </div>
    </section>
  );
}

/* ---------- SHOPPABLE (remplace « Impact mesuré / Moins de neuf ») ---------- */

const HOTSPOTS: { x: string; y: string; name: string; source: string; price: string; dot: string; dir: "right" | "left" }[] = [
  { x: "13%", y: "36%", name: "Bibliothèque vintage", source: "Conservée, repeinte sage", price: "existant", dot: "bg-clay", dir: "right" },
  { x: "38%", y: "60%", name: "Canapé en lin écru", source: "Selency · seconde main", price: "320 €", dot: "bg-ocre", dir: "right" },
  { x: "50%", y: "74%", name: "Table basse verre & laiton", source: "Leboncoin · seconde main", price: "75 €", dot: "bg-ocre", dir: "right" },
  { x: "58%", y: "34%", name: "Olivier d'intérieur", source: "Pépinière locale · neuf", price: "59 €", dot: "bg-forest", dir: "left" },
  { x: "88%", y: "50%", name: "Lampe céramique", source: "Maisons du Monde · neuf éco", price: "69 €", dot: "bg-forest", dir: "left" },
];

function Shoppable() {
  return (
    <section className="relative py-10 sm:py-12 px-5 bg-bone">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-clay">
            <span className="h-px w-6 bg-current opacity-60" />Du rendu à l&apos;achat
          </span>
          <RevealV2>
            <h2 className="mt-5 font-display text-5xl sm:text-7xl text-balance">
              Ce que vous voyez, <em className="italic font-light text-clay">vous pouvez l&apos;avoir.</em>
            </h2>
          </RevealV2>
          <RevealV2 delay={80}>
            <p className="mt-5 text-[15px] text-muted-foreground max-w-xl leading-relaxed">
              Chaque élément du rendu est rattaché à un vrai produit — conservé, chiné ou neuf durable. Héra génère
              des paniers prêts à valider chez chaque partenaire, livrés groupés.
            </p>
          </RevealV2>
        </div>

        <RevealV2 from="translateY(40px)" delay={120} className="relative mt-12 rounded-3xl overflow-hidden ring-1 ring-line shadow-card-lg grain">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={IMG.after} alt="Salon Héra — rendu annoté" className="block w-full" />

          <div className="hidden md:block">
            {HOTSPOTS.map((h) => {
              const labelPos = h.dir === "left" ? "right-full mr-4" : "left-full ml-4";
              return (
                <div key={h.name} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: h.x, top: h.y }}>
                  <span className="relative inline-flex">
                    <span className={`absolute inset-0 animate-ping rounded-full opacity-60 ${h.dot}`} />
                    <span className={`relative h-3 w-3 rounded-full ring-[3px] ring-cream shadow-[0_0_0_1px_rgba(31,27,22,0.15)] ${h.dot}`} />
                  </span>
                  <div className={`absolute top-1/2 w-48 -translate-y-1/2 rounded-xl bg-cream/95 ring-1 ring-line shadow-card backdrop-blur p-3 ${labelPos}`}>
                    <p className="font-display text-[13px] leading-tight">{h.name}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {h.source} · <span className="text-foreground font-medium">{h.price}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="absolute inset-x-4 bottom-4 md:inset-x-auto md:bottom-6 md:right-6 md:w-72">
            <div className="rounded-2xl bg-cream/95 ring-1 ring-line shadow-card backdrop-blur p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Total du projet</p>
                <p className="font-display text-3xl leading-none">~620 €</p>
              </div>
              <div className="mt-3 flex items-center gap-2.5 border-t border-line pt-3">
                <span className="grid place-items-center h-9 w-9 shrink-0 rounded-full bg-clay/12 text-clay font-display text-[13px]">A+</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-forest">Score Héra</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">62% conservé · 22% occasion · 16% neuf</p>
                </div>
              </div>
              <Link
                href={CTA}
                className="mt-3 flex items-center justify-center gap-1.5 w-full rounded-full bg-ink py-2.5 text-[13px] font-medium text-cream hover:opacity-90 transition"
              >
                Essayer sur ma pièce <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </div>
        </RevealV2>

        <div className="mt-8 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground shrink-0">
            Selency · Emmaüs · Leboncoin Pro · Maisons du Monde · La Redoute Intérieurs
          </p>
          <span className="h-px flex-1 bg-line" />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- PARTNERS ------------------------------- */

const PARTNERS = ["Selency", "Emmaüs", "Maisons du Monde", "La Redoute Intérieurs", "Tikamoon", "AM.PM", "Made.com", "Bobochic"];

function Partners() {
  return (
    <section id="partners" className="relative py-16 px-5">
      <div className="mx-auto max-w-6xl">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-forest">
              <span className="h-px w-6 bg-current opacity-60" />Partenaires
            </span>
            <h2 className="mt-5 font-display text-4xl sm:text-5xl text-balance">
              Une sélection <em className="italic font-light text-clay">curatée.</em>
            </h2>
            <p className="mt-4 text-[14px] text-muted-foreground max-w-sm">
              Brocantes en ligne, ateliers d&apos;artisans, marques de mobilier durable. Nous commandons pour vous, vous
              recevez tout en une fois.
            </p>
          </div>
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PARTNERS.map((name, i) => (
              <RevealV2
                key={name}
                delay={i * 50}
                from="scale(0.9)"
                className="aspect-[3/2] rounded-xl bg-card ring-1 ring-line shadow-card grid place-items-center font-display text-lg text-center px-2"
              >
                {name}
              </RevealV2>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- PRICING -------------------------------- */

const PLANS: {
  name: string;
  desc: string;
  price: string;
  per: string;
  feats: string[];
  cta: string;
  featured?: boolean;
}[] = [
  { name: "Découverte", desc: "Pour tester Héra sur une pièce.", price: "0€", per: "/ premier projet", feats: ["1 projet", "1 ambiance", "Inventaire IA", "Liste de courses"], cta: "Commencer" },
  { name: "Héra", desc: "Pour transformer pièce après pièce.", price: "29€", per: "/ projet", feats: ["Projets illimités", "Ambiances illimitées", "Sourcing seconde main", "Commandes groupées", "Suivi livraison"], cta: "Choisir Héra", featured: true },
  { name: "Studio Pro", desc: "Architectes, agences, hôtellerie.", price: "Sur devis", per: "B2B", feats: ["Multi-utilisateurs", "Marque blanche", "API", "Account manager"], cta: "Nous parler" },
];

function Pricing() {
  return (
    <section id="pricing" className="relative py-16 px-5 bg-bone">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-clay">
            <span className="h-px w-6 bg-current opacity-60" />Tarifs simples
          </span>
          <h2 className="mt-5 font-display text-5xl sm:text-7xl text-balance">
            Sans <em className="italic font-light text-clay">abonnement.</em>
          </h2>
        </div>
        <div className="grid lg:grid-cols-3 gap-4 lg:items-start">
          {PLANS.map((plan, i) => (
            <RevealV2
              key={plan.name}
              delay={i * 80}
              from="translateY(30px)"
              className={cn(
                "group relative rounded-3xl p-7 ring-1 transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.03] hover:shadow-card-lg",
                plan.featured ? "bg-clay text-cream ring-clay shadow-card-lg" : "bg-card ring-line shadow-card",
              )}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-7 bg-forest text-cream text-[10px] uppercase tracking-[0.2em] px-3 py-1 rounded-full">
                  Recommandé
                </span>
              )}
              <h3 className="font-display text-2xl">{plan.name}</h3>
              <p className={cn("mt-1 text-[13px]", plan.featured ? "text-cream/80" : "text-muted-foreground")}>{plan.desc}</p>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-5xl">{plan.price}</span>
                <span className={cn("text-[13px]", plan.featured ? "text-cream/80" : "text-muted-foreground")}>{plan.per}</span>
              </div>
              <ul className="mt-6 space-y-2 text-[14px]">
                {plan.feats.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full", plan.featured ? "bg-cream" : "bg-clay")} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={CTA}
                className={cn(
                  "mt-8 inline-flex items-center justify-center gap-2 w-full rounded-full px-5 py-2.5 text-[14px] font-medium transition hover:opacity-90",
                  plan.featured ? "bg-cream text-clay" : "bg-clay text-cream",
                )}
              >
                {plan.cta} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </RevealV2>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------- FAQ ---------------------------------- */

const FAQ_ITEMS = [
  { q: "Héra remplace-t-il un architecte d'intérieur ?", a: "Non. Héra est un studio augmenté : nous pré-mâchons le travail (inventaire, sourcing, commandes) pour que vous gardiez la décision. Pour un projet complexe, nous travaillons avec un réseau d'architectes partenaires." },
  { q: "Comment êtes-vous rémunérés ?", a: "Sur le projet (29€) et via une commission transparente chez nos partenaires marchands. Aucune publicité, aucun upsell caché." },
  { q: "Et si je préfère tout garder ?", a: "Parfait. Héra fonctionne aussi en mode « conserver à 100% » : on vous propose alors customisations, retapissage, peinture, lumière." },
  { q: "Comment fonctionne la seconde main ?", a: "Nous scannons Selency, Emmaüs, Leboncoin Pro et nos brocantes partenaires pour trouver les meubles qui matchent votre ambiance — vous validez avant la commande." },
];

function Faq() {
  return (
    <section id="faq" className="relative py-16 px-5">
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-forest">
            <span className="h-px w-6 bg-current opacity-60" />FAQ
          </span>
          <h2 className="mt-5 font-display text-5xl sm:text-6xl">
            Questions <em className="italic font-light text-clay">honnêtes.</em>
          </h2>
        </div>
        <FaqV2 items={FAQ_ITEMS} />
      </div>
    </section>
  );
}

/* ------------------------------- FINAL CTA ------------------------------- */

function FinalCta() {
  return (
    <section className="relative py-16 sm:py-20 px-5">
      <div className="mx-auto max-w-6xl relative rounded-3xl overflow-hidden bg-forest text-cream p-10 sm:p-20 grain">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-cream">
            <span className="h-px w-6 bg-current opacity-60" />Prêt ?
          </span>
          <h2 className="mt-5 font-display text-5xl sm:text-7xl leading-[0.95] text-balance">
            Prenez une photo. <em className="italic font-light" style={{ color: "var(--sage)" }}>On s&apos;occupe du reste.</em>
          </h2>
          <Link href={CTA} className="mt-10 group inline-flex items-center gap-3 rounded-full bg-cream text-forest pl-6 pr-2 py-2.5 text-[15px] font-medium hover:opacity-90 transition">
            Commencer mon projet
            <span className="grid place-items-center h-9 w-9 rounded-full bg-clay text-cream group-hover:rotate-45 transition-transform">
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={IMG.arch2}
          alt=""
          aria-hidden
          className="hidden md:block absolute -bottom-10 -right-6 w-56 h-56 object-cover rounded-2xl ring-1 ring-cream/20 shadow-card-lg"
          style={{ transform: "rotate(8deg)" }}
        />
      </div>
    </section>
  );
}

/* -------------------------------- FOOTER -------------------------------- */

function Footer() {
  return (
    <footer className="border-t border-line bg-cream py-14 px-5">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-10">
          <div>
            <Link href={CTA} className="flex items-center gap-1.5" aria-label="Héra">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/v2/brand/hera-logo-mark-bold.png" alt="" className="h-7 w-auto" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/v2/brand/hera-wordmark-regular-alpha.png" alt="Héra" className="h-6 w-auto" />
            </Link>
            <p className="mt-3 text-[12px] text-muted-foreground max-w-xs">
              Studio de design d&apos;intérieur augmenté par l&apos;IA. Paris — Made with care.
            </p>
          </div>
          <nav className="grid grid-cols-2 sm:grid-cols-3 gap-x-10 gap-y-2 text-[13px]">
            {[...NAV, { label: "FAQ", href: "#faq" }].map((n) => (
              <a key={n.href} href={n.href} className="hover:text-foreground text-muted-foreground">
                {n.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="mt-12 pt-6 border-t border-line flex flex-wrap items-center justify-between gap-4 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>© 2026 Héra Studio</span>
          <span>Édition N°07</span>
          <span>Paris · 48.85° N</span>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------- DIVIDERS ------------------------------- */

function WaveDivider({ variant, flip }: { variant: "bone" | "to-bg" | "bone-clay"; flip?: boolean }) {
  if (variant === "bone") {
    // background -> bone (vague descendante)
    return (
      <div className="relative w-full -mb-px" style={{ background: "var(--background)" }} aria-hidden>
        <svg viewBox="0 0 1440 90" preserveAspectRatio="none" className="block w-full h-[60px] sm:h-[90px]" style={flip ? { transform: "scaleX(-1)" } : undefined}>
          <path d="M0,40 C240,90 480,0 720,30 C960,60 1200,80 1440,20 L1440,90 L0,90 Z" fill="var(--bone)" />
        </svg>
      </div>
    );
  }
  if (variant === "to-bg") {
    // bone -> background (vague remontante)
    return (
      <div className="relative w-full -mb-px" style={{ background: "var(--bone)" }} aria-hidden>
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className="block w-full h-[60px] sm:h-[80px]">
          <path d="M0,80 L0,40 Q360,-30 720,40 T1440,40 L1440,80 Z" fill="var(--background)" />
        </svg>
      </div>
    );
  }
  // background -> bone, biseau diagonal + liseré clay
  return (
    <div className="relative w-full -mb-px" style={{ background: "var(--background)" }} aria-hidden>
      <svg viewBox="0 0 1440 100" preserveAspectRatio="none" className="block w-full h-[70px] sm:h-[100px]">
        <polygon points="0,100 1440,30 1440,100" fill="var(--bone)" />
        <polygon points="0,100 1440,30 1440,40 0,100" fill="var(--clay)" opacity="0.12" />
      </svg>
    </div>
  );
}

function DottedDivider() {
  return (
    <div className="relative w-full py-2" aria-hidden>
      <div className="mx-auto max-w-6xl px-5 flex items-center gap-5">
        <span className="h-px flex-1 bg-line" />
        <Leaf className="h-4 w-4 shrink-0 text-clay" />
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
