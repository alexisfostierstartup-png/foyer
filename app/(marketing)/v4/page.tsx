import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ManageCookiesButton } from "@/components/shared/manage-cookies-button";
import { ShopProvider } from "@/components/landing/v4/context";
import { RevealV4, TextLink } from "@/components/landing/v4/primitives";
import { HotspotHero } from "@/components/landing/v4/HotspotHero";
import { ProductGrid } from "@/components/landing/v4/ProductGrid";
import { ShopRail } from "@/components/landing/v4/ShopRail";
import { FaqV4 } from "@/components/landing/v4/FaqV4";
import { PARTNERS, PLANS } from "@/components/landing/v4/data";
import "./v4.css";

/**
 * Landing v4 — "Le rendu comme vitrine". Une vraie page produit de maison de
 * mobilier (référence directe : andtradition.com) qui se trouve être
 * accessoirement interactive — hotspots cliquables, panier live, grille PLP.
 * Registre volontairement sobre : neutres dominants, un seul accent réservé
 * au CTA et à l'état sélectionné, aucun badge coloré, aucune pilule, aucune
 * icône panier avec pastille rouge. Isolation stricte : ne modifie que
 * app/(marketing)/v4/** et components/landing/v4/**.
 */
export const metadata: Metadata = {
  title: "Héra — Votre rendu, entièrement shoppable.",
  description:
    "Chaque meuble du rendu est un vrai produit, chez un vrai partenaire, à un vrai prix. Cliquez, comparez, commandez.",
};

const OTHER_ROOMS: { img: string; label: string; stat: string }[] = [
  { img: "/landing/test4_apres.png", label: "Salon parisien", stat: "4 produits sourcés" },
  { img: "/landing/test9_apres.png", label: "Chambre japandi", stat: "3 produits sourcés" },
];

const NAV = [
  { href: "#shop-the-room", label: "Shop the room" },
  { href: "#partenaires", label: "Partenaires" },
  { href: "#tarifs", label: "Tarifs" },
];

export default function LandingV4Page() {
  return (
    <div className="foyer-v4 flex flex-1 flex-col bg-[var(--v4-paper)] text-[var(--v4-ink)]">
      {/* HEADER — 3 zones, plat, pas de blur ni de pilule */}
      <header className="border-b border-[var(--v4-border)]">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-3 items-center px-6 py-4">
          <nav className="hidden items-center gap-6 text-[13px] text-[var(--v4-muted)] sm:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="transition-colors hover:text-[var(--v4-ink)]">
                {n.label}
              </a>
            ))}
          </nav>
          <Link href="/" className="col-start-2 justify-self-center font-serif text-[20px] tracking-[0.02em] text-[var(--v4-ink)]">
            Héra
          </Link>
          <div className="col-start-3 flex items-center justify-end gap-5 text-[13px]">
            <a href="#shop-the-room" className="hidden text-[var(--v4-muted)] transition-colors hover:text-[var(--v4-ink)] sm:inline">
              Votre sélection
            </a>
            <Link href="/create" className="border border-[var(--v4-ink)] px-4 py-1.5 text-[12.5px] text-[var(--v4-ink)] transition-colors hover:bg-[var(--v4-ink)] hover:text-white">
              Lancer mon rendu
            </Link>
          </div>
        </div>
      </header>

      <ShopProvider>
        {/* HERO */}
        <section className="relative overflow-hidden bg-[var(--v4-canvas)] pb-16 pt-14 md:pb-24 md:pt-20">
          <div id="shop-zone-start" />
          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="grid gap-10 md:grid-cols-12 md:items-end md:gap-8">
              <div className="md:col-span-5">
                <RevealV4>
                  <p className="font-serif text-[15px] italic text-[var(--v4-muted)]">Rendu shoppable</p>
                </RevealV4>
                <RevealV4 delay={70}>
                  <h1 className="mt-4 font-serif text-[32px] font-normal leading-[1.12] tracking-[-0.01em] text-[var(--v4-ink)] md:text-[44px]">
                    Ce que vous voyez à l&apos;écran, vous pouvez le commander maintenant.
                  </h1>
                </RevealV4>
                <RevealV4 delay={140}>
                  <p className="mt-5 max-w-md text-[15px] leading-[1.65] text-[var(--v4-muted)]">
                    Chaque objet de ce rendu est un vrai produit, chez un vrai partenaire, à un vrai prix.
                    Touchez un point sur la photo pour voir.
                  </p>
                </RevealV4>
                <RevealV4 delay={200}>
                  <div className="mt-8 flex flex-wrap items-center gap-6">
                    <Link
                      href="/create"
                      className="inline-flex h-11 items-center border border-[var(--v4-accent)] bg-[var(--v4-accent)] px-6 text-[13.5px] text-white transition-opacity hover:opacity-85"
                    >
                      Essayer sur ma photo
                    </Link>
                    <a href="#shop-the-room" className="text-[13.5px] text-[var(--v4-ink)]">
                      <TextLink>Voir tous les produits</TextLink>
                    </a>
                  </div>
                </RevealV4>
                <RevealV4 delay={250}>
                  <p className="mt-7 text-[12.5px] text-[var(--v4-faint)]">
                    1er rendu offert · sans abonnement · paiement direct chez chaque enseigne
                  </p>
                </RevealV4>
              </div>
              <div className="md:col-span-7">
                {/* Pas de wrapper RevealV4/motion ici : HotspotHero contient des
                    éléments `position: fixed` (fiche produit mobile) qui doivent
                    rester ancrés au viewport — un ancêtre avec `transform` (même
                    résolu à 0) les recadrerait dans son propre référentiel. */}
                <HotspotHero />
              </div>
            </div>
          </div>
        </section>

        {/* GRILLE PLP — shop the room */}
        <ProductGrid />
        <div id="shop-zone-end" />

        <ShopRail />
      </ShopProvider>

      {/* BANDEAU PARTENAIRES — ligne texte sobre, pas de pilules marketplace */}
      <section id="partenaires" className="scroll-mt-24 border-y border-[var(--v4-border)] bg-[var(--v4-canvas)]">
        <div className="mx-auto w-full max-w-6xl px-6 py-10 md:py-12">
          <RevealV4>
            <p className="text-[13px] text-[var(--v4-ink)]">
              Paiement sécurisé chez nos 8 partenaires — vous achetez directement chez l&apos;enseigne, livraison
              suivie de bout en bout.
            </p>
          </RevealV4>
          <RevealV4 delay={100} className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--v4-border)] pt-6">
            {PARTNERS.map((p) => (
              <span key={p.name} className="text-[12.5px] text-[var(--v4-muted)]">
                <span className="text-[var(--v4-ink)]">{p.name}</span>
                <span className="text-[var(--v4-faint)]"> · {p.delivery}</span>
              </span>
            ))}
          </RevealV4>
        </div>
      </section>

      {/* AUTRES PIÈCES — image flush, légende sous l'image (pas de texte incrusté) */}
      <section className="bg-[var(--v4-paper)]">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
          <RevealV4>
            <h2 className="font-serif text-[24px] font-normal tracking-[-0.01em] text-[var(--v4-ink)] md:text-[30px]">
              D&apos;autres pièces, déjà shoppables.
            </h2>
          </RevealV4>
          <div className="mt-8 grid gap-x-6 gap-y-8 sm:grid-cols-2">
            {OTHER_ROOMS.map((room, i) => (
              <RevealV4 key={room.label} delay={i * 80}>
                <Link href="/create" className="group block">
                  <div className="relative aspect-[16/10] overflow-hidden bg-[var(--v4-canvas-deep)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={room.img}
                      alt={room.label}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      draggable={false}
                    />
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <p className="font-serif text-[16px] text-[var(--v4-ink)]">{room.label}</p>
                    <p className="text-[12px] text-[var(--v4-faint)]">{room.stat}</p>
                  </div>
                </Link>
              </RevealV4>
            ))}
          </div>
        </div>
      </section>

      {/* TARIFS */}
      <section id="tarifs" className="scroll-mt-24 bg-[var(--v4-canvas)]">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-24">
          <div className="max-w-xl">
            <RevealV4>
              <p className="font-serif text-[15px] italic text-[var(--v4-muted)]">Tarifs</p>
            </RevealV4>
            <RevealV4 delay={70}>
              <h2 className="mt-2 font-serif text-[28px] font-normal leading-[1.1] tracking-[-0.01em] text-[var(--v4-ink)] md:text-[38px]">
                Pas d&apos;abonnement. Vous payez le projet.
              </h2>
            </RevealV4>
          </div>

          <div className="mt-12 grid gap-px border border-[var(--v4-border)] bg-[var(--v4-border)] md:grid-cols-3">
            {PLANS.map((plan, i) => (
              <RevealV4 key={plan.name} delay={i * 80} className="h-full">
                <div
                  className={cn(
                    "flex h-full flex-col p-7",
                    plan.highlight ? "bg-[var(--v4-ink)] text-white" : "bg-[var(--v4-canvas)]",
                  )}
                >
                  <p className={cn("text-[11px] uppercase tracking-[0.1em]", plan.highlight ? "text-white/60" : "text-[var(--v4-muted)]")}>
                    {plan.name}
                  </p>
                  <p className={cn("mt-3 font-serif text-[28px] font-normal tracking-[-0.01em]", plan.highlight ? "text-white" : "text-[var(--v4-ink)]")}>
                    {plan.price}
                  </p>
                  <p className={cn("text-[12px]", plan.highlight ? "text-white/50" : "text-[var(--v4-faint)]")}>{plan.period}</p>
                  <ul className="mt-6 flex-1 space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className={cn("text-[13px] leading-snug", plan.highlight ? "text-white/85" : "text-[var(--v4-ink)]")}>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/create"
                    className={cn(
                      "mt-7 flex items-center justify-center border py-2.5 text-[13px] transition-colors",
                      plan.highlight
                        ? "border-white text-white hover:bg-white hover:text-[var(--v4-ink)]"
                        : "border-[var(--v4-ink)] text-[var(--v4-ink)] hover:bg-[var(--v4-ink)] hover:text-white",
                    )}
                  >
                    {plan.highlight ? "Choisir Héra" : plan.name === "Studio Pro" ? "Nous contacter" : "Commencer"}
                  </Link>
                </div>
              </RevealV4>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-[var(--v4-paper)]">
        <div className="mx-auto w-full max-w-4xl px-6 py-16 md:py-24">
          <RevealV4>
            <h2 className="font-serif text-[28px] font-normal leading-[1.1] tracking-[-0.01em] text-[var(--v4-ink)] md:text-[36px]">
              Questions fréquentes
            </h2>
          </RevealV4>
          <RevealV4 delay={80} className="mt-9">
            <FaqV4 />
          </RevealV4>
        </div>
      </section>

      {/* CTA FINAL — bande plate plein cadre, pas de carte flottante */}
      <section className="border-t border-[var(--v4-border)] bg-[var(--v4-ink)] px-6 py-20 text-center md:py-28">
        <RevealV4>
          <p className="font-serif text-[15px] italic text-white/50">Prêt à commander</p>
          <h2 className="mx-auto mt-4 max-w-xl font-serif text-[30px] font-normal leading-[1.1] tracking-[-0.01em] text-white md:text-[42px]">
            Votre pièce, prête à acheter.
          </h2>
          <p className="mt-4 text-[14.5px] text-white/55">
            Une photo, un rendu, une liste de courses sourcée. Deux minutes.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-6">
            <Link
              href="/create"
              className="inline-flex items-center border border-white bg-white px-7 py-3 text-[14px] text-[var(--v4-ink)] transition-opacity hover:opacity-85"
            >
              Lancer mon rendu
            </Link>
            <a href="#faq" className="text-[14px] text-white">
              <TextLink>Voir la FAQ</TextLink>
            </a>
          </div>
        </RevealV4>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[var(--v4-border)] bg-[var(--v4-paper)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-[13px] text-[var(--v4-muted)] sm:flex-row">
          <span className="font-serif text-[18px] text-[var(--v4-ink)]">Héra</span>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link href="/mentions-legales" className="transition-colors hover:text-[var(--v4-ink)]">
              Mentions légales
            </Link>
            <Link href="/confidentialite" className="transition-colors hover:text-[var(--v4-ink)]">
              Confidentialité
            </Link>
            <Link href="/cookies" className="transition-colors hover:text-[var(--v4-ink)]">
              Cookies
            </Link>
            <ManageCookiesButton className="transition-colors hover:text-[var(--v4-ink)]" />
          </nav>
          <span>© {new Date().getFullYear()} Héra</span>
        </div>
      </footer>
    </div>
  );
}
