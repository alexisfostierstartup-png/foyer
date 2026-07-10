"use client";

/* =============================================================================
 * Landing v5 — "Studio, pas app".
 * Architecture repensée (pas un reskin de la v2) : hero quasi vide porté par
 * la photo, nav plein-écran en typographie plutôt que barre de liens, intros
 * de section asymétriques deux-colonnes, galerie edge-to-edge, boutons plats
 * (texte + trait), un seul registre clair — pas de bascule brutale vers un
 * bloc noir. Référence directe : studioilse.com.
 * ========================================================================== */

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Menu, Plus, X } from "lucide-react";
import { ManageCookiesButton } from "@/components/shared/manage-cookies-button";
import { MaskReveal, RevealV5, TransformationImage } from "./parts";

const CTA = "/create";

const LEGAL_LINKS = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/cookies", label: "Cookies" },
];

const IMG = {
  heroAfter: "/landing/test1_apres.png",
  heroBefore: "/landing/test1.jpg",
  salonParisien: "/landing/test4_apres.png",
  japandi: "/landing/test9_apres.png",
  livingAfter: "/landing/v2/after-living.jpg",
  arch2: "/landing/v2/arch-2.jpg",
  logoMark: "/landing/v2/brand/hera-logo-mark-bold.png",
  wordmark: "/landing/v2/brand/hera-wordmark-regular-alpha.png",
  wordmarkBold: "/landing/v2/brand/hera-wordmark-bold-alpha.png",
};

const NAV = [
  { label: "Manifeste", href: "#manifeste" },
  { label: "Méthode", href: "#methode" },
  { label: "Résultats", href: "#resultats" },
  { label: "Projets", href: "#projets" },
  { label: "Tarifs", href: "#tarifs" },
];

const PARTNERS = ["Selency", "Emmaüs", "Maisons du Monde", "La Redoute Intérieurs", "Tikamoon", "AM.PM", "Made.com", "Bobochic"];

/* --------------------------- INTRO DE SECTION -------------------------------
 * Un seul gabarit réutilisé partout : eyebrow, titre serif large à gauche,
 * description plus petite à droite. Jamais centré, jamais suivi d'un CTA.
 * -------------------------------------------------------------------------- */
function SectionIntro({
  eyebrow,
  title,
  description,
  id,
}: {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  id?: string;
}) {
  return (
    <div id={id} className="grid gap-8 lg:grid-cols-12 lg:gap-16 scroll-mt-24">
      <div className="lg:col-span-7">
        <span className="text-[11px] uppercase tracking-[0.22em] text-[var(--v5-muted)]">{eyebrow}</span>
        <h2 className="mt-4 font-display text-4xl sm:text-5xl lg:text-[3.4rem] leading-[1.05] text-[var(--v5-ink)] text-balance">
          {title}
        </h2>
      </div>
      <div className="lg:col-span-4 lg:col-start-9 lg:self-end">
        <p className="text-[14px] leading-relaxed text-[var(--v5-muted)]">{description}</p>
      </div>
    </div>
  );
}

/* --------------------------------- HEADER ----------------------------------- */

function Header({ onOpenNav }: { onOpenNav: () => void }) {
  return (
    <header className="fixed top-0 inset-x-0 z-40 border-b border-[var(--v5-line)]/60 bg-[var(--v5-paper)]/70 backdrop-blur-sm">
      <div className="mx-auto max-w-[1400px] px-6 sm:px-10 h-[56px] flex items-center justify-between">
        <Link href={CTA} className="flex items-center gap-2" aria-label="Héra">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={IMG.logoMark} alt="" className="h-4 w-auto" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={IMG.wordmark} alt="Héra" className="h-3.5 w-auto" />
        </Link>
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Ouvrir le menu"
          className="flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-[var(--v5-ink)]"
        >
          Menu
          <Menu className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        </button>
      </div>
    </header>
  );
}

/** Regroupe Header + NavOverlay et leur état partagé — seul point client de
 * la navigation, pour que page.tsx reste un Server Component (metadata). */
export function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Header onOpenNav={() => setOpen(true)} />
      <NavOverlay open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/* ------------------------------- NAV OVERLAY --------------------------------- *
 * Pas une barre de liens : un plein-écran blanc, une liste verticale en gros
 * serif. Le survol d'un item éteint les autres. Directement inspiré de
 * studioilse.com — la hiérarchie vient de la typographie, pas d'icônes.
 * -------------------------------------------------------------------------- */
export function NavOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const items = [...NAV, { label: "Commencer un projet", href: CTA }];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[100] bg-[var(--v5-paper)]"
        >
          <div className="mx-auto max-w-[1400px] px-6 sm:px-10 h-[56px] flex items-center justify-end border-b border-[var(--v5-line)]/60">
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer le menu"
              className="flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-[var(--v5-ink)]"
            >
              Fermer
              <X className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            </button>
          </div>

          <nav className="flex h-[calc(100%-56px)] flex-col justify-center px-6 sm:px-10">
            <ul className="mx-auto max-w-[1400px] w-full">
              {items.map((item, i) => (
                <motion.li
                  key={item.href}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.08 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  className="border-b border-[var(--v5-line)]/60 py-3 sm:py-4 transition-opacity duration-300"
                  style={{ opacity: hovered === null || hovered === i ? 1 : 0.32 }}
                >
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className="font-display text-[13vw] sm:text-6xl lg:text-7xl leading-none text-[var(--v5-ink)]"
                  >
                    {item.label}
                  </Link>
                </motion.li>
              ))}
            </ul>
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------------------------- HERO ------------------------------------- *
 * Quasi vide : la photo porte tout. Avant → après se résout au scroll (seul
 * dispositif motion du hero, justifié : c'est littéralement le produit).
 * Aucun bouton, aucun badge, aucune stat superposée à l'image.
 * -------------------------------------------------------------------------- */
export function Hero() {
  return (
    <section className="relative h-[100svh] min-h-[560px] w-full overflow-hidden bg-[var(--v5-ink)]">
      <TransformationImage
        before={IMG.heroBefore}
        after={IMG.heroAfter}
        altBefore="Salon avant transformation"
        altAfter="Salon transformé par Héra"
        className="absolute inset-0 h-full w-full"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[var(--v5-ink)]/70 via-[var(--v5-ink)]/10 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 px-6 sm:px-10 pb-10 sm:pb-14">
        <div className="mx-auto max-w-[1400px]">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--v5-paper)]/60">
            Salon haussmannien — Paris 11e
          </p>
          <h1 className="mt-3 max-w-2xl font-display italic font-light text-3xl sm:text-5xl lg:text-6xl leading-[1.1] text-[var(--v5-paper)]">
            <MaskReveal delay={200}>Une pièce, réinventée avec soin.</MaskReveal>
          </h1>
        </div>
      </div>

      <motion.span
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: 1.1, duration: 0.8 }}
        className="absolute bottom-6 right-6 sm:right-10 hidden sm:block h-10 w-px bg-[var(--v5-paper)]"
      />
    </section>
  );
}

/* -------------------------------- MANIFESTE ----------------------------------- */

export function Manifesto() {
  return (
    <section className="relative py-24 sm:py-32 px-6 sm:px-10 bg-[var(--v5-paper)]">
      <div className="mx-auto max-w-[1400px]">
        <SectionIntro
          id="manifeste"
          eyebrow="Manifeste"
          title={
            <>
              D&apos;abord, ce qui existe déjà. <em className="italic font-light text-[var(--v5-gold-deep)]">Ensuite, ce qui manque.</em>
            </>
          }
          description="Pas d'IA qui invente un décor hors-sol. Héra part de votre pièce telle qu'elle est, et n'ajoute que ce qui a du sens — matière par matière, meuble par meuble."
        />
      </div>
    </section>
  );
}

/* --------------------------------- MÉTHODE ------------------------------------- *
 * Liste sobre, filets fins, aucun numéro géant : la hiérarchie tient à la
 * typographie et à l'espace, pas à des chiffres décoratifs plaqués dessus.
 * -------------------------------------------------------------------------- */
const STEPS = [
  { label: "Photographiez", body: "Une pièce, une photo. Le plus naturel possible — pas de mise en scène." },
  { label: "Générons ensemble", body: "Une direction fidèle à votre style, pas un template générique." },
  { label: "Décidez meuble par meuble", body: "Garder, customiser, chiner ou remplacer — la décision reste la vôtre." },
  { label: "Recevez vos commandes", body: "Groupées, préparées chez les bons partenaires, prêtes à valider." },
];

export function Method() {
  return (
    <section className="relative py-24 sm:py-32 px-6 sm:px-10 bg-[var(--v5-paper)]">
      <div className="mx-auto max-w-[1400px]">
        <SectionIntro
          id="methode"
          eyebrow="Méthode"
          title="Quatre temps. Aucune improvisation."
          description="De la photo à la livraison, chaque étape reste lisible — vous gardez la décision à chaque instant."
        />

        <div className="mt-16 border-t border-[var(--v5-line)]">
          {STEPS.map((s, i) => (
            <RevealV5 key={s.label} delay={i * 70}>
              <div className="flex flex-col gap-2 border-b border-[var(--v5-line)] py-7 sm:flex-row sm:items-baseline sm:gap-10 sm:py-8">
                <span className="font-mono text-[11px] text-[var(--v5-muted)] sm:w-10 sm:shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display text-2xl sm:w-72 sm:shrink-0 text-[var(--v5-ink)]">{s.label}</h3>
                <p className="max-w-md text-[14px] leading-relaxed text-[var(--v5-muted)]">{s.body}</p>
              </div>
            </RevealV5>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- RÉSULTATS ------------------------------------ *
 * Pas de tuiles de stats façon SaaS : un paragraphe éditorial, les chiffres
 * intégrés au texte, sans compteur ni carte.
 * -------------------------------------------------------------------------- */
export function Results() {
  return (
    <section className="relative py-24 sm:py-32 px-6 sm:px-10 bg-[var(--v5-paper)]">
      <div className="mx-auto max-w-[1400px]">
        <SectionIntro
          id="resultats"
          eyebrow="Résultats"
          title="La preuve, pas la promesse."
          description="Chaque projet est noté selon la part réellement conservée, chinée ou neuve — méthode ADEME, revue à chaque livraison."
        />

        <RevealV5 delay={80} className="mt-14 lg:pl-[58.3%]">
          <p className="font-display text-2xl sm:text-3xl lg:text-4xl leading-[1.4] text-[var(--v5-ink)] text-balance">
            En moyenne, <em className="italic font-light text-[var(--v5-gold-deep)]">62 %</em> du mobilier d&apos;une
            pièce est conservé. Le reste vient de la seconde main ou de partenaires choisis pour durer — soit environ{" "}
            <em className="italic font-light text-[var(--v5-gold-deep)]">340 kg</em> de CO₂ évités, une commande
            prête en <em className="italic font-light text-[var(--v5-gold-deep)]">9 jours</em>, pour un budget moyen
            de <em className="italic font-light text-[var(--v5-gold-deep)]">1 240 €</em>.
          </p>
        </RevealV5>
      </div>
    </section>
  );
}

/* --------------------------------- PARTENAIRES ----------------------------------- *
 * Interlude sobre entre deux sections — une phrase, pas un bandeau qui
 * défile en boucle (un studio comme référence ne ferait jamais ça).
 * -------------------------------------------------------------------------- */
export function Partners() {
  return (
    <section className="relative py-12 px-6 sm:px-10 border-y border-[var(--v5-line)] bg-[var(--v5-paper)]">
      <RevealV5 className="mx-auto max-w-[1400px]">
        <p className="text-[13px] sm:text-[15px] leading-relaxed text-[var(--v5-muted)]">
          <span className="text-[11px] uppercase tracking-[0.22em] text-[var(--v5-muted)] mr-4 align-middle">
            Partenaires
          </span>
          <span className="font-display italic font-light text-[var(--v5-ink)] text-lg sm:text-xl">
            {PARTNERS.join(" · ")}
          </span>
        </p>
      </RevealV5>
    </section>
  );
}

/* --------------------------------- PROJETS ----------------------------------- *
 * Grille edge-to-edge, hauteurs variées, aucune ombre ni cadre. Légendes en
 * dessous des images, jamais superposées.
 * -------------------------------------------------------------------------- */
const PROJECTS = [
  { img: IMG.salonParisien, name: "Salon parisien", tag: "Haussmann", surface: "32 m²", span: "lg:row-span-2" },
  { img: IMG.japandi, name: "Chambre japandi", tag: "Studio", surface: "14 m²", span: "" },
  { img: IMG.livingAfter, name: "Séjour, lumière basse", tag: "Maison", surface: "26 m²", span: "" },
];

export function Gallery() {
  return (
    <section className="relative py-24 sm:py-32 bg-[var(--v5-paper)]">
      <div className="mx-auto max-w-[1400px] px-6 sm:px-10">
        <SectionIntro
          id="projets"
          eyebrow="Projets"
          title="Trois pièces, trois décisions."
          description="Des transformations livrées, pas des rendus d'illustration — chaque pièce garde sa logique propre."
        />
      </div>

      <div className="mt-16 px-6 sm:px-10">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-8 lg:grid-cols-2 lg:grid-rows-2 lg:gap-x-6 lg:gap-y-10">
          {PROJECTS.map((p, i) => (
            <RevealV5 key={p.name} delay={i * 90} className={p.span}>
              <figure className="h-full">
                <div className={`relative w-full overflow-hidden ${i === 0 ? "aspect-[4/5] lg:h-full lg:aspect-auto" : "aspect-[16/10]"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.img} alt={p.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                </div>
                <figcaption className="mt-4 flex items-baseline justify-between">
                  <span className="font-display text-xl text-[var(--v5-ink)]">{p.name}</span>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--v5-muted)]">
                    {p.tag} · {p.surface}
                  </span>
                </figcaption>
              </figure>
            </RevealV5>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- TARIFS ----------------------------------- */

const PLANS = [
  { name: "Découverte", desc: "Pour tester Héra sur une pièce.", price: "0 €", per: "premier projet", feats: ["1 projet", "1 ambiance", "Inventaire IA", "Liste de courses"], featured: false },
  { name: "Héra", desc: "Pour transformer pièce après pièce.", price: "29 €", per: "par projet", feats: ["Projets illimités", "Sourcing seconde main", "Commandes groupées", "Suivi livraison"], featured: true },
  { name: "Studio Pro", desc: "Architectes, agences, hôtellerie.", price: "Sur devis", per: "B2B", feats: ["Multi-utilisateurs", "Marque blanche", "API", "Account manager"], featured: false },
];

export function Pricing() {
  return (
    <section className="relative py-24 sm:py-32 px-6 sm:px-10 bg-[var(--v5-paper)]">
      <div className="mx-auto max-w-[1400px]">
        <SectionIntro
          id="tarifs"
          eyebrow="Tarifs"
          title="Simples. Sans abonnement."
          description="Vous payez le projet, pas l'accès. Aucun engagement, aucun coût caché."
        />

        <div className="mt-16 grid lg:grid-cols-3 border-t border-[var(--v5-line)]">
          {PLANS.map((p) => (
            <div key={p.name} className="border-b lg:border-b-0 lg:border-r last:border-r-0 border-[var(--v5-line)] py-8 lg:px-8 first:lg:pl-0 last:lg:pr-0">
              <h3 className="font-display text-2xl text-[var(--v5-ink)]">
                {p.name}
                {p.featured && (
                  <span className="ml-3 text-[11px] font-sans uppercase tracking-[0.16em] text-[var(--v5-gold-deep)]">
                    — recommandé
                  </span>
                )}
              </h3>
              <p className="mt-1 text-[13px] text-[var(--v5-muted)]">{p.desc}</p>
              <div className="mt-8 flex items-baseline gap-2">
                <span className="font-display text-4xl text-[var(--v5-ink)]">{p.price}</span>
                <span className="text-[12px] text-[var(--v5-muted)]">/ {p.per}</span>
              </div>
              <ul className="mt-6 space-y-2.5 text-[13px] text-[var(--v5-ink)]">
                {p.feats.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1 w-1 shrink-0 bg-[var(--v5-gold-deep)]" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={CTA}
                className="mt-9 inline-flex items-center gap-2 border-b border-[var(--v5-ink)] pb-1 text-[13px] font-medium text-[var(--v5-ink)] transition-opacity hover:opacity-60"
              >
                Choisir <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
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
        <span className="text-[11px] uppercase tracking-[0.22em] text-[var(--v5-muted)]">Questions</span>
        <h2 className="mt-4 font-display text-4xl sm:text-5xl text-[var(--v5-ink)]">
          Honnêtes, <em className="italic font-light text-[var(--v5-gold-deep)]">sans détour.</em>
        </h2>

        <div className="mt-12 border-t border-[var(--v5-line)]">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className="border-b border-[var(--v5-line)]">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-6 py-6 text-left"
                >
                  <span className="font-display text-xl sm:text-2xl text-[var(--v5-ink)]">{item.q}</span>
                  <Plus
                    className="h-5 w-5 shrink-0 text-[var(--v5-muted)] transition-transform duration-300"
                    style={{ transform: isOpen ? "rotate(45deg)" : "none" }}
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </button>
                <div
                  className="overflow-hidden transition-all duration-300 ease-out"
                  style={{ maxHeight: isOpen ? 200 : 0, opacity: isOpen ? 1 : 0 }}
                >
                  <p className="pb-6 text-[13px] leading-relaxed text-[var(--v5-muted)] max-w-xl">{item.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- FINAL CTA ---------------------------------- *
 * Un dernier moment photo, pas un bloc encre + bouton pilule. Le texte porte
 * la conclusion, un lien plat (texte + trait) suffit.
 * -------------------------------------------------------------------------- */
export function FinalCta() {
  return (
    <section className="relative h-[70vh] min-h-[420px] w-full overflow-hidden bg-[var(--v5-ink)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={IMG.arch2} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--v5-ink)] via-[var(--v5-ink)]/40 to-[var(--v5-ink)]/10" />
      <div className="relative flex h-full flex-col justify-end px-6 sm:px-10 pb-16 sm:pb-20">
        <div className="mx-auto w-full max-w-[1400px]">
          <RevealV5>
            <h2 className="max-w-2xl font-display text-4xl sm:text-6xl leading-[1.1] text-[var(--v5-paper)] text-balance">
              Prenez une photo. <em className="italic font-light text-[var(--v5-gold)]">Le studio fait le reste.</em>
            </h2>
          </RevealV5>
          <RevealV5 delay={100}>
            <Link
              href={CTA}
              className="mt-8 inline-flex items-center gap-2 border-b border-[var(--v5-paper)] pb-1 text-[15px] font-medium text-[var(--v5-paper)] transition-opacity hover:opacity-70"
            >
              Commencer un projet <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </RevealV5>
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
              <img src={IMG.logoMark} alt="" className="h-6 w-auto v5-white-mark" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG.wordmarkBold} alt="Héra" className="h-5 w-auto v5-white-mark" />
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
        <div className="mt-14 pt-6 border-t border-[var(--v5-line-dark)] flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--v5-muted-dark)]">
          {LEGAL_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-[var(--v5-paper)] transition-colors">
              {link.label}
            </Link>
          ))}
          <ManageCookiesButton className="hover:text-[var(--v5-paper)] transition-colors" />
        </div>
        <div className="mt-4 pt-4 border-t border-[var(--v5-line-dark)] flex flex-wrap items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--v5-muted-dark)]">
          <span>© 2026 Héra Studio</span>
          <span>Paris · 48.85° N</span>
        </div>
      </div>
    </footer>
  );
}
