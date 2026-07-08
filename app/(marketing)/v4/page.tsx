import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, ShieldCheck, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { ManageCookiesButton } from "@/components/shared/manage-cookies-button";
import { ShopProvider } from "@/components/landing/v4/context";
import { RevealV4 } from "@/components/landing/v4/primitives";
import { HotspotHero } from "@/components/landing/v4/HotspotHero";
import { ProductGrid } from "@/components/landing/v4/ProductGrid";
import { ShopRail } from "@/components/landing/v4/ShopRail";
import { FaqV4 } from "@/components/landing/v4/FaqV4";
import { PARTNERS, PLANS, PURCHASABLE } from "@/components/landing/v4/data";
import "./v4.css";

/**
 * Landing v4 — "Le rendu comme vitrine". La page se comporte comme une vraie
 * interface d'achat (PLP déguisée en landing) : hotspots cliquables sur le
 * rendu, rail panier persistant, grille produit façon e-commerce, bandeau
 * partenaires marketplace. Isolation stricte : ne modifie que
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

export default function LandingV4Page() {
  return (
    <div className="foyer-v4 flex flex-1 flex-col bg-[var(--v4-paper)] text-[var(--v4-ink)]">
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-[var(--v4-border)] bg-[var(--v4-paper)]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/v2/brand/hera-logo-mark-bold.png"
              alt=""
              className="h-7 w-auto"
              draggable={false}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/v2/brand/hera-wordmark-regular-alpha.png"
              alt="Héra"
              className="h-[15px] w-auto"
              draggable={false}
            />
          </Link>
          <nav className="hidden items-center gap-6 text-[14px] font-medium text-[var(--v4-ink)] sm:flex">
            <a href="#shop-the-room" className="transition-colors hover:text-[var(--v4-terra)]">
              Shop the room
            </a>
            <a href="#partenaires" className="transition-colors hover:text-[var(--v4-terra)]">
              Partenaires
            </a>
            <a href="#tarifs" className="transition-colors hover:text-[var(--v4-terra)]">
              Tarifs
            </a>
          </nav>
          <div className="flex items-center gap-2.5">
            <a
              href="#shop-the-room"
              aria-label={`Voir les ${PURCHASABLE.length} produits identifiés`}
              className="relative hidden items-center justify-center rounded-full bg-[var(--v4-ink-wash)] p-2.5 text-[var(--v4-ink)] transition-colors hover:bg-[var(--v4-ink-wash-strong)] sm:flex"
            >
              <ShoppingBag className="size-4" strokeWidth={1.8} aria-hidden />
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[var(--v4-terra)] text-[9px] font-bold text-white">
                {PURCHASABLE.length}
              </span>
            </a>
            <Link
              href="/create"
              className="rounded-full bg-[var(--v4-ink)] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--v4-ink)]/85"
            >
              Lancer mon rendu
            </Link>
          </div>
        </div>
      </header>

      <ShopProvider>
        {/* HERO — hotspots cliquables sur le rendu */}
        <section className="relative overflow-hidden bg-[var(--v4-canvas)] pb-14 pt-10 md:pb-20 md:pt-14">
          <div id="shop-zone-start" />
          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="grid gap-10 md:grid-cols-12 md:items-end md:gap-8">
              <div className="md:col-span-5">
                <RevealV4>
                  <p className="inline-flex items-center gap-2 rounded-full bg-[var(--v4-terra-wash)] px-3 py-1 text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--v4-terra)]">
                    <ShoppingBag className="size-3.5" strokeWidth={2.2} aria-hidden />
                    Rendu shoppable
                  </p>
                </RevealV4>
                <RevealV4 delay={70}>
                  <h1 className="mt-5 font-serif text-[32px] font-medium leading-[1.06] tracking-[-0.02em] text-[var(--v4-ink)] md:text-[46px]">
                    Ce que vous voyez à l&apos;écran, vous pouvez le commander maintenant.
                  </h1>
                </RevealV4>
                <RevealV4 delay={140}>
                  <p className="mt-5 max-w-md text-[16px] leading-[1.6] text-[var(--v4-muted)]">
                    Chaque objet de ce rendu est un vrai produit, chez un vrai partenaire, à un vrai prix.
                    Touchez un point sur la photo pour voir.
                  </p>
                </RevealV4>
                <RevealV4 delay={200}>
                  <div className="mt-7 flex flex-wrap items-center gap-3">
                    <Link
                      href="/create"
                      className="inline-flex h-11 items-center rounded-full bg-[var(--v4-terra)] px-6 text-[14px] font-semibold text-white shadow-[0_10px_24px_rgba(168,65,42,0.32)] transition-transform hover:-translate-y-0.5"
                    >
                      Essayer sur ma photo
                    </Link>
                    <a
                      href="#shop-the-room"
                      className="inline-flex h-11 items-center rounded-full border border-[var(--v4-border-strong)] px-5 text-[13px] font-medium text-[var(--v4-ink)] transition-colors hover:border-[var(--v4-ink)]"
                    >
                      Voir tous les produits
                    </a>
                  </div>
                </RevealV4>
                <RevealV4 delay={250}>
                  <p className="mt-6 text-[13px] text-[var(--v4-muted)]">
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

      {/* BANDEAU PARTENAIRES — barre de confiance marketplace */}
      <section id="partenaires" className="scroll-mt-24 border-y border-[var(--v4-border)] bg-[var(--v4-canvas)]">
        <div className="mx-auto w-full max-w-6xl px-6 py-8 md:py-10">
          <RevealV4>
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--v4-sage-wash)] text-[var(--v4-sage)]">
                <ShieldCheck className="size-4" strokeWidth={1.8} aria-hidden />
              </span>
              <div>
                <p className="text-[14px] font-semibold text-[var(--v4-ink)]">
                  Paiement sécurisé chez nos 8 partenaires
                </p>
                <p className="text-[12px] text-[var(--v4-muted)]">
                  Vous achetez directement chez l&apos;enseigne, livraison suivie de bout en bout
                </p>
              </div>
            </div>
          </RevealV4>
          <RevealV4 delay={100} className="mt-6 flex flex-wrap gap-2.5">
            {PARTNERS.map((p) => (
              <span
                key={p.name}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--v4-border)] bg-[var(--v4-paper)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--v4-ink)]"
              >
                {p.name}
                <span className="text-[11px] font-normal text-[var(--v4-muted)]">· {p.delivery}</span>
              </span>
            ))}
          </RevealV4>
        </div>
      </section>

      {/* AUTRES PIÈCES — catégories PLP */}
      <section className="bg-[var(--v4-paper)]">
        <div className="mx-auto w-full max-w-6xl px-6 py-14 md:py-16">
          <RevealV4>
            <h2 className="font-serif text-[24px] font-medium tracking-[-0.01em] text-[var(--v4-ink)] md:text-[30px]">
              D&apos;autres pièces, déjà shoppables.
            </h2>
          </RevealV4>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            {OTHER_ROOMS.map((room, i) => (
              <RevealV4 key={room.label} delay={i * 90}>
                <Link
                  href="/create"
                  className="group relative block aspect-[16/10] overflow-hidden rounded-2xl ring-1 ring-[var(--v4-border)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={room.img}
                    alt={room.label}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    draggable={false}
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent"
                  />
                  <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-2">
                    <div>
                      <p className="text-[15px] font-medium text-white">{room.label}</p>
                      <p className="text-[12px] text-white/75">{room.stat}</p>
                    </div>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/90 text-[var(--v4-ink)] transition-transform group-hover:translate-x-0.5">
                      <ArrowUpRight className="size-4" aria-hidden />
                    </span>
                  </div>
                </Link>
              </RevealV4>
            ))}
          </div>
        </div>
      </section>

      {/* TARIFS */}
      <section id="tarifs" className="scroll-mt-24 bg-[var(--v4-canvas)]">
        <div className="mx-auto w-full max-w-6xl px-6 py-14 md:py-20">
          <div className="max-w-xl">
            <RevealV4>
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--v4-terra)]">Tarifs</p>
            </RevealV4>
            <RevealV4 delay={70}>
              <h2 className="mt-3 font-serif text-[30px] font-medium leading-[1.05] tracking-[-0.02em] text-[var(--v4-ink)] md:text-[42px]">
                Pas d&apos;abonnement. Vous payez le projet.
              </h2>
            </RevealV4>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {PLANS.map((plan, i) => (
              <RevealV4 key={plan.name} delay={i * 90}>
                <div
                  className={cn(
                    "flex h-full flex-col rounded-2xl p-6",
                    plan.highlight
                      ? "bg-[var(--v4-ink)] text-white shadow-[0_20px_50px_rgba(31,27,22,0.25)]"
                      : "bg-[var(--v4-paper)] ring-1 ring-[var(--v4-border)]",
                  )}
                >
                  <p
                    className={cn(
                      "text-[12px] font-semibold uppercase tracking-[0.08em]",
                      plan.highlight ? "text-white/70" : "text-[var(--v4-muted)]",
                    )}
                  >
                    {plan.name}
                  </p>
                  <p
                    className={cn(
                      "mt-3 font-serif text-[32px] font-medium tracking-[-0.02em]",
                      plan.highlight ? "text-white" : "text-[var(--v4-ink)]",
                    )}
                  >
                    {plan.price}
                  </p>
                  <p className={cn("text-[12px]", plan.highlight ? "text-white/60" : "text-[var(--v4-muted)]")}>
                    {plan.period}
                  </p>
                  <ul className="mt-5 flex-1 space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[13px] leading-snug">
                        <Check
                          className={cn("mt-0.5 size-3.5 shrink-0", plan.highlight ? "text-white" : "text-[var(--v4-sage)]")}
                          strokeWidth={2.4}
                          aria-hidden
                        />
                        <span className={plan.highlight ? "text-white/90" : "text-[var(--v4-ink)]"}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/create"
                    className={cn(
                      "mt-6 flex items-center justify-center rounded-full py-2.5 text-[13px] font-semibold transition-colors",
                      plan.highlight
                        ? "bg-white text-[var(--v4-ink)] hover:bg-white/90"
                        : "bg-[var(--v4-ink)] text-white hover:bg-[var(--v4-ink)]/85",
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
        <div className="mx-auto w-full max-w-4xl px-6 py-14 md:py-20">
          <RevealV4>
            <h2 className="font-serif text-[30px] font-medium leading-[1.05] tracking-[-0.02em] text-[var(--v4-ink)] md:text-[40px]">
              Questions fréquentes
            </h2>
          </RevealV4>
          <RevealV4 delay={80} className="mt-8">
            <FaqV4 />
          </RevealV4>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="bg-[var(--v4-canvas)] px-6 pb-16 pt-4">
        <RevealV4>
          <div className="mx-auto max-w-[760px] overflow-hidden rounded-3xl bg-[var(--v4-ink)] px-8 py-12 text-center md:px-14 md:py-16">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-white/85">
              <ShoppingBag className="size-3.5" aria-hidden />
              Prêt à commander
            </span>
            <h2 className="mt-7 font-serif text-[30px] font-medium leading-[1.05] tracking-[-0.02em] text-white md:text-[44px]">
              Votre pièce, prête à acheter.
            </h2>
            <p className="mt-4 text-[15px] text-white/65">
              Une photo, un rendu, une liste de courses sourcée. Deux minutes.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/create"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--v4-terra)] px-8 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_28px_rgba(168,65,42,0.4)] transition-transform hover:-translate-y-0.5"
              >
                Lancer mon rendu
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <a
                href="#faq"
                className="inline-flex items-center rounded-full bg-white/10 px-8 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-white/15"
              >
                Voir la FAQ
              </a>
            </div>
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
