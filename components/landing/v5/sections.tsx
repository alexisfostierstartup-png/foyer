"use client";

/* =============================================================================
 * Landing v5 — "Studio, pas app".
 * Sections assemblées dans app/(marketing)/v5/page.tsx.
 * ========================================================================== */

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import {
  CursorTarget,
  Counter,
  Magnetic,
  MaskReveal,
  ParallaxImage,
  RevealV5,
} from "./parts";

const CTA = "/create";

const IMG = {
  heroAfter: "/landing/test1_apres.png",
  heroBefore: "/landing/test1.jpg",
  salonParisien: "/landing/test4_apres.png",
  salonParisienBefore: "/landing/test4.jpeg",
  japandi: "/landing/test9_apres.png",
  japandiBefore: "/landing/test9.png",
  livingAfter: "/landing/v2/after-living.jpg",
  livingBefore: "/landing/v2/before-living.jpg",
  arch1: "/landing/v2/arch-1.jpg",
  arch2: "/landing/v2/arch-2.jpg",
  arch3: "/landing/v2/arch-3.jpg",
  arch4: "/landing/v2/arch-4.jpg",
  logoMark: "/landing/v2/brand/hera-logo-mark-bold.png",
  wordmark: "/landing/v2/brand/hera-wordmark-regular-alpha.png",
  wordmarkBold: "/landing/v2/brand/hera-wordmark-bold-alpha.png",
};

export const NAV = [
  { n: "01", label: "Manifeste", href: "#manifeste" },
  { n: "02", label: "Méthode", href: "#methode" },
  { n: "03", label: "Résultats", href: "#resultats" },
  { n: "04", label: "Projets", href: "#projets" },
  { n: "05", label: "Tarifs", href: "#tarifs" },
];

/* --------------------------------- HEADER --------------------------------- */

export function Header() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-[var(--v5-line)]/70 bg-[var(--v5-paper)]/75 backdrop-blur-md">
      <div className="mx-auto max-w-[1400px] px-6 sm:px-10 h-[64px] flex items-center justify-between">
        <Link href={CTA} className="flex items-center gap-2" aria-label="Héra">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={IMG.logoMark} alt="" className="h-5 w-auto" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={IMG.wordmark} alt="Héra" className="h-4 w-auto" />
        </Link>
        <nav className="hidden lg:flex items-center gap-8">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="group inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-[var(--v5-muted)] hover:text-[var(--v5-ink)] transition-colors"
            >
              <span className="font-mono text-[9px] text-[var(--v5-gold-deep)]">{n.n}</span>
              {n.label}
            </a>
          ))}
        </nav>
        <Magnetic className="inline-block">
          <Link
            href={CTA}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--v5-ink)] text-[var(--v5-paper)] pl-4 pr-1.5 py-1.5 text-[12px] font-medium tracking-tight hover:opacity-90 transition"
          >
            Démarrer
            <span className="grid place-items-center h-6 w-6 rounded-full bg-[var(--v5-gold)] text-[var(--v5-ink)]">
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            </span>
          </Link>
        </Magnetic>
      </div>
    </header>
  );
}

/* ---------------------------------- HERO ----------------------------------- */

export function Hero() {
  // Scroll-linked, pas un simple reveal au montage : le titre se masque
  // progressivement pendant qu'on quitte le premier viewport, pendant que
  // ParallaxImage (dans le panneau photo) scale/translate l'"après" en
  // profondeur. Les deux motions restent indépendantes.
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const titleY = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const kickerOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);

  return (
    <section ref={sectionRef} className="relative pt-[124px] pb-8 px-6 sm:px-10 bg-[var(--v5-paper)]">
      <div className="mx-auto max-w-[1400px]">
        <motion.span
          style={{ opacity: kickerOpacity }}
          className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--v5-muted)]"
        >
          <span className="h-px w-6 bg-[var(--v5-gold-deep)]" />
          Studio de design d&apos;intérieur augmenté — Paris
        </motion.span>

        <motion.h1
          style={{ y: titleY, opacity: titleOpacity }}
          className="mt-6 font-display text-[13vw] sm:text-[7.4vw] lg:text-[92px] leading-[0.92] tracking-[-0.03em] text-[var(--v5-ink)]"
        >
          <MaskReveal>Votre intérieur,</MaskReveal>
          <br />
          <MaskReveal delay={90}>
            réinventé avec <em className="italic font-light text-[var(--v5-gold-deep)]">précision.</em>
          </MaskReveal>
        </motion.h1>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-8">
          <RevealV5 delay={260} className="max-w-sm">
            <p className="text-[14px] leading-relaxed text-[var(--v5-muted)]">
              Héra fonctionne comme un studio, pas comme une application. Une photo, une direction claire, un
              résultat qui tient — matière par matière, meuble par meuble.
            </p>
          </RevealV5>
          <RevealV5 delay={340}>
            <Magnetic>
              <Link
                href={CTA}
                className="group inline-flex items-center gap-4 rounded-full border border-[var(--v5-ink)] pl-6 pr-2 py-2 text-[13px] font-medium text-[var(--v5-ink)] hover:bg-[var(--v5-ink)] hover:text-[var(--v5-paper)] transition-colors"
              >
                Commencer un projet
                <span className="grid place-items-center h-9 w-9 rounded-full bg-[var(--v5-ink)] text-[var(--v5-paper)] group-hover:bg-[var(--v5-gold)] group-hover:text-[var(--v5-ink)] transition-colors">
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </span>
              </Link>
            </Magnetic>
          </RevealV5>
        </div>
      </div>

      <RevealV5 delay={180} y={40} className="relative mt-10">
        <CursorTarget variant="view" label="Voir le projet">
          <div className="relative h-[58vh] sm:h-[78vh] w-full overflow-hidden rounded-[4px] ring-1 ring-[var(--v5-line)]">
            <ParallaxImage src={IMG.heroAfter} alt="Salon transformé par Héra" className="absolute inset-0 h-full w-full" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--v5-ink)]/35 via-transparent to-transparent" />
            <div className="absolute left-6 bottom-6 sm:left-8 sm:bottom-8 flex items-center gap-3 rounded-full bg-[var(--v5-paper)]/90 backdrop-blur px-4 py-2">
              <span className="font-mono text-[10px] tracking-[0.18em] text-[var(--v5-muted)]">N°07</span>
              <span className="h-3 w-px bg-[var(--v5-line)]" />
              <span className="text-[12px] text-[var(--v5-ink)]">Salon haussmannien, 32 m²</span>
            </div>
          </div>
        </CursorTarget>
      </RevealV5>
    </section>
  );
}

/* ---------------------------- MANIFESTE / STUDIO ---------------------------- *
 * Section plein-bleed quasi-noire — le process, pas le pitch. Numéraux
 * Fraunces démesurés + filets fins ochre, photos process traitées en
 * duotone CSS (aucune image générée). Signature v5, contraste fort avec le
 * reste de la page qui reste clair.
 * -------------------------------------------------------------------------- */

const MANIFESTO_STEPS = [
  { n: "01", title: "Photographiez", body: "Une pièce, une photo. Le plus naturel possible — pas de mise en scène.", img: IMG.arch1 },
  { n: "02", title: "Générons ensemble", body: "L'IA propose une direction fidèle à votre style, pas un template générique.", img: IMG.arch2 },
  { n: "03", title: "Décidez meuble par meuble", body: "Garder, customiser, chiner ou remplacer — la décision reste la vôtre.", img: IMG.arch3 },
  { n: "04", title: "Recevez vos commandes", body: "Groupées, préparées chez les bons partenaires, prêtes à valider.", img: IMG.arch4 },
];

export function Manifesto() {
  return (
    <section
      id="manifeste"
      className="v5-grain relative py-24 sm:py-32 px-6 sm:px-10 bg-[var(--v5-ink)] text-[var(--v5-paper)] overflow-hidden"
    >
      <div className="relative mx-auto max-w-[1400px]">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 mb-20">
          <div className="lg:col-span-5">
            <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--v5-muted-dark)]">
              <span className="h-px w-6 bg-[var(--v5-gold)]" />
              Manifeste
            </span>
            <h2 className="mt-5 font-display text-4xl sm:text-5xl text-balance">
              Quatre temps. <em className="italic font-light text-[var(--v5-gold)]">Aucune improvisation.</em>
            </h2>
          </div>
          <div className="lg:col-span-6 lg:col-start-7 flex items-end">
            <p id="methode" className="text-[14px] leading-relaxed text-[var(--v5-muted-dark)] max-w-md scroll-mt-24">
              Pas d&apos;IA qui invente un décor hors-sol. Héra part de ce qui existe déjà chez vous, et n&apos;ajoute
              que ce qui a du sens.
            </p>
          </div>
        </div>

        <div className="border-t border-[var(--v5-line-dark)]">
          {MANIFESTO_STEPS.map((s, i) => (
            <RevealV5 key={s.n} delay={i * 90} y={28}>
              <div className="group flex flex-col gap-6 border-b border-[var(--v5-line-dark)] py-10 lg:flex-row lg:items-center lg:gap-10 lg:py-12">
                <span className="font-display text-[var(--v5-gold-deep)]/60 text-[20vw] leading-[0.78] transition-colors duration-500 group-hover:text-[var(--v5-gold)] sm:text-[11vw] lg:w-[240px] lg:shrink-0 lg:text-[6.4vw]">
                  {s.n}
                </span>
                <div className="flex-1">
                  <h3 className="font-display text-2xl sm:text-3xl text-[var(--v5-paper)]">{s.title}</h3>
                  <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-[var(--v5-muted-dark)]">{s.body}</p>
                </div>
                <div className="h-28 w-full shrink-0 overflow-hidden rounded-[2px] lg:h-24 lg:w-40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.img}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    className="v5-duotone h-full w-full object-cover opacity-70 transition-opacity duration-500 group-hover:opacity-100"
                  />
                </div>
              </div>
            </RevealV5>
          ))}
        </div>

        <RevealV5 delay={120} className="mt-14 flex gap-6">
          <span aria-hidden className="mt-1 w-px shrink-0 bg-[var(--v5-gold)]/50" />
          <p className="max-w-2xl font-display text-xl sm:text-2xl leading-[1.4] text-[var(--v5-paper)]/90">
            L&apos;IA génère le rendu et retrouve le mobilier qui correspond.
            <span className="text-[var(--v5-gold)]"> Le reste — partenaires, matières, arbitrages — reste pensé par une équipe.</span>
          </p>
        </RevealV5>
      </div>
    </section>
  );
}

/* --------------------------------- RÉSULTATS -------------------------------- */

const STATS = [
  { to: 62, prefix: "", suffix: "%", label: "du mobilier conservé", decimals: 0 },
  { to: 340, prefix: "−", suffix: " kg", label: "de CO₂ évités en moyenne", decimals: 0 },
  { to: 9, prefix: "", suffix: " jours", label: "entre la photo et la livraison", decimals: 0 },
  { to: 1240, prefix: "", suffix: " €", label: "budget moyen d'un projet", decimals: 0 },
];

export function Stats() {
  return (
    <section id="resultats" className="relative py-24 sm:py-32 px-6 sm:px-10 bg-[var(--v5-paper)]">
      <div className="mx-auto max-w-[1400px]">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--v5-muted)]">
            <span className="h-px w-6 bg-[var(--v5-gold-deep)]" />
            Résultats
          </span>
          <h2 className="mt-5 font-display text-4xl sm:text-5xl text-[var(--v5-ink)] text-balance">
            La preuve, <em className="italic font-light text-[var(--v5-gold-deep)]">chiffrée.</em>
          </h2>
        </div>

        <div className="mt-16 grid grid-cols-2 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <RevealV5 key={s.label} delay={i * 90}>
              <div
                className={`py-8 pr-6 ${i % 2 === 0 ? "border-r" : ""} ${
                  i < 2 ? "border-b lg:border-b-0" : ""
                } ${i % 4 !== 0 ? "lg:border-l" : ""} border-[var(--v5-line)]`}
              >
                <Counter
                  to={s.to}
                  prefix={s.prefix}
                  suffix={s.suffix}
                  decimals={s.decimals}
                  className="font-display text-4xl sm:text-5xl text-[var(--v5-ink)]"
                />
                <p className="mt-3 text-[12px] leading-snug text-[var(--v5-muted)] max-w-[16ch]">{s.label}</p>
              </div>
            </RevealV5>
          ))}
        </div>

        <RevealV5 delay={200} className="mt-14 flex flex-wrap items-center gap-6 border-t border-[var(--v5-line)] pt-10">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full border border-[var(--v5-gold-deep)]/50 font-display text-2xl text-[var(--v5-gold-deep)]">
            A+
          </span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--v5-muted)]">Score éco Héra</p>
            <p className="mt-1 text-[13px] text-[var(--v5-ink)]/80">68 % conservé · 22 % chiné · 10 % neuf durable</p>
          </div>
        </RevealV5>
      </div>
    </section>
  );
}

/* --------------------------------- PROJETS ---------------------------------- */

const PROJECTS = [
  { n: "01", img: IMG.salonParisien, before: IMG.salonParisienBefore, name: "Salon parisien", tag: "Haussmann", surface: "32 m²", conserve: "68%" },
  { n: "02", img: IMG.japandi, before: IMG.japandiBefore, name: "Chambre japandi", tag: "Studio", surface: "14 m²", conserve: "55%" },
  { n: "03", img: IMG.livingAfter, before: IMG.livingBefore, name: "Séjour, lumière basse", tag: "Maison", surface: "26 m²", conserve: "61%" },
];

export function Gallery() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setProgress(max > 0 ? el.scrollLeft / max : 0);
  };

  return (
    <section id="projets" className="relative py-24 sm:py-32 bg-[var(--v5-paper)]">
      <div className="mx-auto max-w-[1400px] px-6 sm:px-10 flex items-end justify-between gap-6 mb-12">
        <div>
          <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--v5-muted)]">
            <span className="h-px w-6 bg-[var(--v5-gold-deep)]" />
            Projets
          </span>
          <h2 className="mt-5 font-display text-4xl sm:text-5xl text-[var(--v5-ink)] text-balance">
            Trois pièces, <em className="italic font-light text-[var(--v5-gold-deep)]">trois décisions.</em>
          </h2>
        </div>
        <p className="hidden sm:block text-[12px] text-[var(--v5-muted)] max-w-[22ch] text-right">
          Glissez pour parcourir la galerie.
        </p>
      </div>

      <div
        ref={trackRef}
        onScroll={onScroll}
        className={`flex gap-5 overflow-x-auto px-6 sm:px-10 pb-4 snap-x snap-mandatory v5-horizontal-track`}
      >
        {PROJECTS.map((p) => (
          <div
            key={p.n}
            className="group relative shrink-0 snap-start w-[82vw] sm:w-[46vw] lg:w-[32vw] max-w-[560px]"
          >
            <CursorTarget variant="view" label="Voir">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[4px] ring-1 ring-[var(--v5-line)]">
                {/* "Avant" — reste dessous, révélé quand l'"après" se dissout au survol. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.before}
                  alt={`${p.name} — avant`}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.img}
                  alt={`${p.name} — après`}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-700 ease-out group-hover:scale-[1.04] group-hover:opacity-0"
                />
                <span className="absolute top-4 left-4 font-display text-3xl text-[var(--v5-paper)] drop-shadow-[0_1px_6px_rgba(0,0,0,0.4)]">
                  {p.n}
                </span>
                <span className="absolute top-5 right-4 bg-[var(--v5-paper)]/90 backdrop-blur px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[0.16em] text-[var(--v5-ink)] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  Avant
                </span>
                <span className="absolute top-5 right-4 bg-[var(--v5-paper)]/90 backdrop-blur px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[0.16em] text-[var(--v5-ink)] transition-opacity duration-300 group-hover:opacity-0">
                  {p.tag}
                </span>
              </div>
            </CursorTarget>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-xl text-[var(--v5-ink)]">{p.name}</h3>
                <p className="text-[11px] uppercase tracking-wider text-[var(--v5-muted)]">{p.surface}</p>
              </div>
              <span className="text-[11px] font-medium text-[var(--v5-gold-deep)]">Conservé {p.conserve}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-[1400px] px-6 sm:px-10 mt-6">
        <div className="h-px w-full bg-[var(--v5-line)] relative overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-[var(--v5-gold-deep)] transition-[width] duration-150 ease-out"
            style={{ width: `${Math.max(8, progress * 100)}%` }}
          />
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- MARQUEE ---------------------------------- */

const PARTNERS = ["Selency", "Emmaüs", "Maisons du Monde", "La Redoute Intérieurs", "Tikamoon", "AM.PM", "Made.com", "Bobochic"];

export function MarqueeStrip() {
  const items = [...PARTNERS, ...PARTNERS];
  return (
    <section className="relative py-8 border-y border-[var(--v5-line)] bg-[var(--v5-paper-dim)] overflow-hidden">
      <div className="v5-marquee-track">
        {items.map((name, i) => (
          <span
            key={`${name}-${i}`}
            className="flex items-center gap-8 pr-8 font-display text-2xl sm:text-3xl text-[var(--v5-ink)]/70 whitespace-nowrap"
          >
            {name}
            <span className="text-[var(--v5-gold-deep)] text-base" aria-hidden>
              ✦
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------- PRICING ---------------------------------- */

const PLANS = [
  { n: "01", name: "Découverte", desc: "Pour tester Héra sur une pièce.", price: "0€", per: "premier projet", feats: ["1 projet", "1 ambiance", "Inventaire IA", "Liste de courses"], featured: false },
  { n: "02", name: "Héra", desc: "Pour transformer pièce après pièce.", price: "29€", per: "par projet", feats: ["Projets illimités", "Sourcing seconde main", "Commandes groupées", "Suivi livraison"], featured: true },
  { n: "03", name: "Studio Pro", desc: "Architectes, agences, hôtellerie.", price: "Sur devis", per: "B2B", feats: ["Multi-utilisateurs", "Marque blanche", "API", "Account manager"], featured: false },
];

export function Pricing() {
  return (
    <section id="tarifs" className="relative py-24 sm:py-32 px-6 sm:px-10 bg-[var(--v5-paper)]">
      <div className="mx-auto max-w-[1400px]">
        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--v5-muted)]">
          <span className="h-px w-6 bg-[var(--v5-gold-deep)]" />
          Tarifs
        </span>
        <h2 className="mt-5 font-display text-4xl sm:text-5xl text-[var(--v5-ink)] text-balance">
          Simples. <em className="italic font-light text-[var(--v5-gold-deep)]">Sans abonnement.</em>
        </h2>

        <div className="mt-14 grid lg:grid-cols-3">
          {PLANS.map((p, i) => (
            <RevealV5 key={p.n} delay={i * 90}>
              <div
                className={`relative h-full p-8 border-t lg:border-t-0 lg:border-l first:border-l-0 border-[var(--v5-line)] ${
                  p.featured ? "ring-1 ring-[var(--v5-gold-deep)] ring-inset" : ""
                }`}
              >
                {p.featured && (
                  <span className="absolute top-0 right-8 -translate-y-1/2 bg-[var(--v5-gold-deep)] text-[var(--v5-paper)] text-[10px] uppercase tracking-[0.18em] px-3 py-1 rounded-full">
                    Recommandé
                  </span>
                )}
                <span className="font-mono text-[10px] text-[var(--v5-gold-deep)]">{p.n}</span>
                <h3 className="mt-3 font-display text-2xl text-[var(--v5-ink)]">{p.name}</h3>
                <p className="mt-1 text-[13px] text-[var(--v5-muted)]">{p.desc}</p>
                <div className="mt-8 flex items-baseline gap-2">
                  <span className="font-display text-4xl text-[var(--v5-ink)]">{p.price}</span>
                  <span className="text-[12px] text-[var(--v5-muted)]">/ {p.per}</span>
                </div>
                <ul className="mt-6 space-y-2.5 text-[13px] text-[var(--v5-ink)]">
                  {p.feats.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1 w-1 rounded-full bg-[var(--v5-gold-deep)] shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={CTA}
                  className={`mt-9 inline-flex items-center justify-center gap-2 w-full rounded-full px-5 py-2.5 text-[13px] font-medium transition ${
                    p.featured
                      ? "bg-[var(--v5-ink)] text-[var(--v5-paper)] hover:opacity-90"
                      : "border border-[var(--v5-ink)] text-[var(--v5-ink)] hover:bg-[var(--v5-ink)] hover:text-[var(--v5-paper)]"
                  }`}
                >
                  Choisir <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            </RevealV5>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------- FAQ ------------------------------------ */

const FAQ_ITEMS = [
  { q: "Héra remplace-t-il un architecte d'intérieur ?", a: "Non. Héra pré-mâche le travail — inventaire, sourcing, commandes — pour que vous gardiez la décision. Pour un projet complexe, nous travaillons avec un réseau d'architectes partenaires." },
  { q: "Comment êtes-vous rémunérés ?", a: "Sur le projet (29€) et via une commission transparente chez nos partenaires marchands. Aucune publicité, aucun upsell caché." },
  { q: "Et si je préfère tout garder ?", a: "Parfait. Héra fonctionne aussi en mode « conserver à 100% » : customisation, retapissage, peinture, lumière." },
  { q: "Comment fonctionne la seconde main ?", a: "Nous scannons Selency, Emmaüs, Leboncoin Pro et nos brocantes partenaires pour trouver ce qui correspond à votre pièce — vous validez avant la commande." },
];

export function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section className="relative py-24 sm:py-32 px-6 sm:px-10 bg-[var(--v5-paper)]">
      <div className="mx-auto max-w-3xl">
        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--v5-muted)]">
          <span className="h-px w-6 bg-[var(--v5-gold-deep)]" />
          Questions
        </span>
        <h2 className="mt-5 font-display text-4xl sm:text-5xl text-[var(--v5-ink)]">
          Honnêtes, <em className="italic font-light text-[var(--v5-gold-deep)]">sans détour.</em>
        </h2>

        <div className="mt-12">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className="border-t border-[var(--v5-line)] last:border-b">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-6 py-6 text-left"
                >
                  <span className="flex items-baseline gap-4">
                    <span className="font-mono text-[10px] text-[var(--v5-gold-deep)]">{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-display text-xl sm:text-2xl text-[var(--v5-ink)]">{item.q}</span>
                  </span>
                  <span
                    className={`shrink-0 grid place-items-center h-7 w-7 rounded-full border border-[var(--v5-line)] transition-transform duration-300 ${
                      isOpen ? "rotate-45" : ""
                    }`}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </button>
                <div
                  className="overflow-hidden transition-all duration-300 ease-out"
                  style={{ maxHeight: isOpen ? 200 : 0, opacity: isOpen ? 1 : 0 }}
                >
                  <p className="pb-6 pl-[38px] text-[13px] leading-relaxed text-[var(--v5-muted)] max-w-xl">{item.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- FINAL CTA ---------------------------------- */

export function FinalCta() {
  return (
    <section className="relative py-28 sm:py-40 px-6 sm:px-10 bg-[var(--v5-ink)] text-[var(--v5-paper)] overflow-hidden">
      <div aria-hidden className={`absolute inset-0 v5-ambient-glow`} />
      <div className="relative mx-auto max-w-[1400px] text-center">
        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--v5-muted-dark)]">
          <span className="h-px w-6 bg-[var(--v5-gold)]" />
          Prêt
          <span className="h-px w-6 bg-[var(--v5-gold)]" />
        </span>
        <h2 className="mt-6 font-display text-[13vw] sm:text-7xl lg:text-8xl leading-[0.95] text-balance">
          Prenez une photo.
          <br />
          <em className="italic font-light text-[var(--v5-gold)]">Le studio fait le reste.</em>
        </h2>
        <div className="mt-12 flex justify-center">
          <Magnetic strength={0.4}>
            <Link
              href={CTA}
              className="group inline-flex items-center gap-4 rounded-full bg-[var(--v5-paper)] text-[var(--v5-ink)] pl-8 pr-2 py-2.5 text-[15px] font-medium hover:opacity-90 transition"
            >
              Commencer mon projet
              <span className="grid place-items-center h-11 w-11 rounded-full bg-[var(--v5-gold)] text-[var(--v5-ink)] group-hover:rotate-45 transition-transform">
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </span>
            </Link>
          </Magnetic>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------- FOOTER ------------------------------------ */

export function Footer() {
  return (
    <footer className="border-t border-[var(--v5-line-dark)] bg-[var(--v5-ink)] text-[var(--v5-paper)] py-16 px-6 sm:px-10">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-wrap items-end justify-between gap-10">
          <div>
            <Link href={CTA} className="flex items-center gap-2" aria-label="Héra">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG.logoMark} alt="" className={`h-6 w-auto v5-white-mark`} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG.wordmarkBold} alt="Héra" className={`h-5 w-auto v5-white-mark`} />
            </Link>
            <p className="mt-3 text-[12px] text-[var(--v5-muted-dark)] max-w-xs">
              Studio de design d&apos;intérieur augmenté par l&apos;IA. Paris.
            </p>
          </div>
          <nav className="grid grid-cols-2 sm:grid-cols-3 gap-x-10 gap-y-2">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="text-[13px] text-[var(--v5-muted-dark)] hover:text-[var(--v5-paper)] transition-colors">
                {n.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="mt-14 pt-6 border-t border-[var(--v5-line-dark)] flex flex-wrap items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--v5-muted-dark)]">
          <span>© 2026 Héra Studio</span>
          <span>Édition N°05</span>
          <span>Paris · 48.85° N</span>
        </div>
      </div>
    </footer>
  );
}
