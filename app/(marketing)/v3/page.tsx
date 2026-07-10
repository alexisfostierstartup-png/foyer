import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import "./v3.css";
import { RevealV2, BeforeAfterV2, FaqV2 } from "@/components/landing/v2/parts";
import { CountUp } from "@/components/landing/v3/parts";
import { ManageCookiesButton } from "@/components/shared/manage-cookies-button";

/* ============================================================================
 * Landing v3 — « Design circulaire ».
 * Angle écologie assumé mais chaleureux : les photos réelles en grand, un
 * registre alterné crème / sable / forêt profonde, un seul système de bouton
 * (pilule laiton), la hiérarchie Garder → Chiner → Compléter comme colonne
 * vertébrale du discours. Pas de duotone, pas de widgets empilés.
 * ========================================================================== */

export const metadata: Metadata = {
  title: "Héra — Re-décorer, sans racheter.",
};

const CTA = "/create";

const IMG = {
  hero: "/landing/test4_apres.png",
  before: "/landing/test1.jpg",
  after: "/landing/test1_apres.png",
  finale: "/landing/v2/after-living.jpg",
};

export default function LandingV3() {
  return (
    <div className="hera-v3 min-h-screen overflow-x-hidden">
      <Hero />
      <Manifesto />
      <Transformation />
      <Hierarchy />
      <Process />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* --------------------------------- HERO ---------------------------------- *
 * Photo réelle plein cadre, dégradé forêt en pied pour porter le titre.
 * Un seul CTA. La nav vit par-dessus la photo, sans barre ni pilule.
 * -------------------------------------------------------------------------- */
function Hero() {
  return (
    <section className="relative h-[94svh] min-h-[600px] w-full overflow-hidden bg-[var(--v3-forest-deep)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={IMG.hero}
        alt="Salon parisien transformé par Héra"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(20,35,26,0.96) 0%, rgba(20,35,26,0.62) 34%, rgba(20,35,26,0.18) 60%, rgba(20,35,26,0.45) 100%)",
        }}
      />

      <header className="absolute top-0 inset-x-0 z-10">
        <div className="mx-auto max-w-7xl px-6 sm:px-10 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2" aria-label="Héra">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/v2/brand/hera-logo-mark-bold.png" alt="" className="h-6 w-auto brightness-0 invert" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/v2/brand/hera-wordmark-regular-alpha.png" alt="Héra" className="h-5 w-auto brightness-0 invert" />
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-[13px] text-[var(--v3-cream)]/80">
            <a href="#methode" className="hover:text-[var(--v3-cream)] transition-colors">Méthode</a>
            <a href="#transformation" className="hover:text-[var(--v3-cream)] transition-colors">Projets</a>
            <a href="#tarifs" className="hover:text-[var(--v3-cream)] transition-colors">Tarifs</a>
          </nav>
          <Link href={CTA} className="v3-btn !py-2.5 !px-5 !text-[13px]">
            Commencer
          </Link>
        </div>
      </header>

      <div className="absolute inset-x-0 bottom-0 z-10 pb-14 sm:pb-20">
        <div className="mx-auto max-w-7xl px-6 sm:px-10">
          <RevealV2 instant>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--v3-moss)]">
              Héra — Studio de design circulaire
            </p>
          </RevealV2>
          <RevealV2 instant delay={90}>
            <h1 className="v3-display mt-5 max-w-3xl text-[11vw] sm:text-6xl lg:text-[76px] text-[var(--v3-cream)] text-balance">
              La plus belle pièce est celle que vous avez <em className="italic font-light text-[var(--v3-moss)]">déjà</em>.
            </h1>
          </RevealV2>
          <RevealV2 instant delay={180}>
            <div className="mt-8 flex flex-wrap items-center gap-6">
              <Link href={CTA} className="v3-btn">
                Transformer ma pièce <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <a href="#methode" className="v3-link text-[var(--v3-cream)]/85">
                Voir la méthode
              </a>
            </div>
          </RevealV2>
          <RevealV2 instant delay={260}>
            <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--v3-cream)]/55">
              Salon parisien · 68 % conservé · −380 kg de carbone
            </p>
          </RevealV2>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- MANIFESTO -------------------------------- *
 * Un seul chiffre, énorme, qui compte au scroll. Le principe tient en une
 * phrase — pas besoin de trois cartes d'icônes.
 * -------------------------------------------------------------------------- */
function Manifesto() {
  return (
    <section className="bg-[var(--v3-cream)] py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 sm:px-10 grid lg:grid-cols-12 gap-12 items-end">
        <div className="lg:col-span-6">
          <RevealV2>
            <p className="v3-display text-[clamp(7rem,18vw,15rem)] leading-none text-[var(--v3-forest)]">
              <CountUp value={62} suffix="%" />
            </p>
          </RevealV2>
          <RevealV2 delay={100}>
            <p className="mt-2 text-[15px] text-[var(--v3-muted)] max-w-sm leading-relaxed">
              du mobilier d&apos;un projet Héra est conservé ou chiné — pas remplacé.
            </p>
          </RevealV2>
        </div>
        <div className="lg:col-span-5 lg:col-start-8">
          <RevealV2 delay={140}>
            <p className="text-xl sm:text-2xl leading-snug text-[var(--v3-ink)] v3-display">
              Re-décorer ne veut pas dire racheter.
            </p>
            <p className="mt-5 text-[15px] leading-relaxed text-[var(--v3-muted)]">
              Sur un projet moyen&nbsp;: 62&nbsp;% du mobilier conservé ou customisé, 22&nbsp;% chiné en
              seconde main, 16&nbsp;% de neuf — durable, choisi pour vingt ans. C&apos;est mieux pour
              votre budget. Et pour le reste.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
              {[
                ["−340 kg", "carbone évité"],
                ["9 jours", "en moyenne"],
                ["1 240 €", "budget médian"],
              ].map(([num, label]) => (
                <div key={label}>
                  <p className="v3-display text-2xl text-[var(--v3-forest)]">{num}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--v3-muted)]">{label}</p>
                </div>
              ))}
            </div>
          </RevealV2>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- TRANSFORMATION ----------------------------- */
function Transformation() {
  return (
    <section id="transformation" className="bg-[var(--v3-sand)] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6 sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6 mb-12">
          <RevealV2>
            <h2 className="v3-display text-4xl sm:text-5xl text-[var(--v3-ink)]">
              La même pièce.<br />
              <em className="italic font-light text-[var(--v3-forest)]">Les mêmes meubles, presque.</em>
            </h2>
          </RevealV2>
          <p className="text-[14px] text-[var(--v3-muted)] max-w-xs leading-relaxed">
            Glissez pour comparer. Ce salon a gardé sa bibliothèque, son canapé et sa table —
            repensés, pas remplacés.
          </p>
        </div>

        <RevealV2 from="translateY(36px)">
          <div className="overflow-hidden rounded-2xl border border-[var(--v3-line)]">
            <BeforeAfterV2 beforeSrc={IMG.before} afterSrc={IMG.after} />
          </div>
        </RevealV2>

        <div className="mt-6 flex flex-wrap gap-x-12 gap-y-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--v3-muted)]">
          <span>Surface — 32 m²</span>
          <span>Conservé — 68 %</span>
          <span>CO₂ évité — 380 kg</span>
          <span>Budget — 1 240 €</span>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- HIERARCHY -------------------------------- *
 * Le cœur du discours éco : Garder → Chiner → Compléter, sur forêt profonde.
 * Trois gestes, trois exemples réels — pas des icônes génériques.
 * -------------------------------------------------------------------------- */
const MOVES: { verb: string; body: string; example: string; detail: string }[] = [
  {
    verb: "Garder",
    body: "Ce qui tient encore reste en place. Un canapé en lin se re-housse, un chêne massif se ponce et s'huile.",
    example: "Canapé lin écru",
    detail: "conservé · housse lavée",
  },
  {
    verb: "Chiner",
    body: "Selency, Emmaüs, Leboncoin — on cherche pour vous la pièce qui manque, le plus près possible de chez vous.",
    example: "Lampadaire 70's",
    detail: "Selency · Lille · 220 km",
  },
  {
    verb: "Compléter",
    body: "Le neuf, en dernier recours. Durable, réparable, choisi pour durer vingt ans — jamais pour une saison.",
    example: "Tapis Beni Ouarain",
    detail: "atelier · laine vierge",
  },
];

function Hierarchy() {
  return (
    <section id="methode" className="relative bg-[var(--v3-forest-deep)] py-24 sm:py-32 v3-grain">
      <div className="mx-auto max-w-7xl px-6 sm:px-10">
        <RevealV2>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--v3-moss)]">Le principe</p>
          <h2 className="v3-display mt-5 text-4xl sm:text-6xl text-[var(--v3-cream)] max-w-3xl text-balance">
            Garder d&apos;abord. Chiner ensuite. Acheter <em className="italic font-light text-[var(--v3-moss)]">enfin</em>.
          </h2>
        </RevealV2>

        <div className="mt-16 divide-y divide-[var(--v3-line-dark)] border-y border-[var(--v3-line-dark)]">
          {MOVES.map((m, i) => (
            <RevealV2 key={m.verb} delay={i * 90}>
              <div className="grid sm:grid-cols-12 gap-4 sm:gap-8 py-9 items-baseline">
                <h3 className="v3-display text-3xl sm:text-4xl text-[var(--v3-cream)] sm:col-span-3">
                  {m.verb}
                </h3>
                <p className="text-[15px] leading-relaxed text-[var(--v3-muted-dark)] sm:col-span-5">
                  {m.body}
                </p>
                <div className="sm:col-span-4 sm:text-right">
                  <p className="text-[14px] text-[var(--v3-cream)]">{m.example}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--v3-moss)]">
                    {m.detail}
                  </p>
                </div>
              </div>
            </RevealV2>
          ))}
        </div>

        <RevealV2 delay={200}>
          <div className="mt-14">
            <Link href={CTA} className="v3-btn v3-btn--cream">
              Appliquer à ma pièce <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </RevealV2>
      </div>
    </section>
  );
}

/* -------------------------------- PROCESS --------------------------------- */
const STEPS: { t: string; title: string; body: string }[] = [
  { t: "T+0", title: "Photographiez", body: "Une photo de votre pièce, telle qu'elle est." },
  { t: "T+0", title: "Recevez le rendu", body: "Réaliste, construit à partir de vos meubles." },
  { t: "T+1 à 5 j", title: "Décidez", body: "Garder, chiner, remplacer — meuble par meuble." },
  { t: "T+9 j", title: "Recevez", body: "Paniers groupés par enseigne, livrés chez vous." },
];

function Process() {
  return (
    <section className="bg-[var(--v3-cream)] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6 sm:px-10">
        <RevealV2>
          <h2 className="v3-display text-4xl sm:text-5xl text-[var(--v3-ink)]">
            De la photo aux commandes.
          </h2>
        </RevealV2>
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
          {STEPS.map((s, i) => (
            <RevealV2 key={s.title} delay={i * 80}>
              <div className="border-t border-[var(--v3-ink)]/20 pt-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--v3-brass)]">{s.t}</p>
                <h3 className="v3-display mt-3 text-2xl text-[var(--v3-ink)]">{s.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[var(--v3-muted)]">{s.body}</p>
              </div>
            </RevealV2>
          ))}
        </div>
        <p className="mt-14 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--v3-muted)]">
          Partenaires — Selency · Emmaüs · Maisons du Monde · La Redoute Intérieurs · Tikamoon · AM.PM
        </p>
      </div>
    </section>
  );
}

/* -------------------------------- PRICING --------------------------------- */
const PLANS: { name: string; desc: string; price: string; per: string; feats: string[]; featured?: boolean }[] = [
  { name: "Découverte", desc: "Pour tester Héra sur une pièce.", price: "0 €", per: "premier projet", feats: ["1 projet", "1 ambiance", "Liste de courses sourcée"] },
  { name: "Héra", desc: "Pour transformer pièce après pièce.", price: "29 €", per: "par projet", feats: ["Ambiances illimitées", "Sourcing seconde main", "Commandes groupées", "Suivi livraison"], featured: true },
  { name: "Studio Pro", desc: "Architectes, agences, hôtellerie.", price: "Sur devis", per: "B2B", feats: ["Multi-utilisateurs", "Marque blanche", "API"] },
];

function Pricing() {
  return (
    <section id="tarifs" className="bg-[var(--v3-sand)] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-6 sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-6 mb-14">
          <RevealV2>
            <h2 className="v3-display text-4xl sm:text-5xl text-[var(--v3-ink)]">
              Sans abonnement.
            </h2>
          </RevealV2>
          <p className="text-[14px] text-[var(--v3-muted)] max-w-xs">
            Vous payez le projet, pas l&apos;accès. Aucun engagement.
          </p>
        </div>
        <div className="grid lg:grid-cols-3 gap-5 items-stretch">
          {PLANS.map((plan, i) => (
            <RevealV2 key={plan.name} delay={i * 80} className="h-full">
              <div
                className={
                  plan.featured
                    ? "h-full rounded-2xl bg-[var(--v3-forest)] text-[var(--v3-cream)] p-8 flex flex-col"
                    : "h-full rounded-2xl border border-[var(--v3-ink)]/15 p-8 flex flex-col"
                }
              >
                <h3 className="v3-display text-2xl">{plan.name}</h3>
                <p className={`mt-1 text-[13px] ${plan.featured ? "text-[var(--v3-muted-dark)]" : "text-[var(--v3-muted)]"}`}>
                  {plan.desc}
                </p>
                <div className="mt-7 flex items-baseline gap-2">
                  <span className="v3-display text-5xl">{plan.price}</span>
                  <span className={`text-[13px] ${plan.featured ? "text-[var(--v3-muted-dark)]" : "text-[var(--v3-muted)]"}`}>
                    / {plan.per}
                  </span>
                </div>
                <ul className="mt-7 space-y-2.5 text-[14px] flex-1">
                  {plan.feats.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span className={`mt-2 h-1 w-1 rounded-full ${plan.featured ? "bg-[var(--v3-moss)]" : "bg-[var(--v3-brass)]"}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={CTA} className={`v3-btn mt-9 justify-center ${plan.featured ? "v3-btn--cream" : ""}`}>
                  {plan.featured ? "Choisir Héra" : plan.price === "Sur devis" ? "Nous parler" : "Commencer"}
                </Link>
              </div>
            </RevealV2>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------- FAQ ----------------------------------- */
const FAQ_ITEMS = [
  { q: "Et si je veux tout garder ?", a: "Parfait — c'est le meilleur scénario. Héra fonctionne aussi en « conserver à 100 % » : customisation, retapissage, peinture, lumière. Le rendu vous montre ce que vos meubles peuvent devenir." },
  { q: "Comment fonctionne la seconde main ?", a: "Nous scannons Selency, Emmaüs, Leboncoin et nos brocantes partenaires pour trouver les pièces qui matchent votre ambiance, le plus près possible de chez vous. Vous validez avant toute commande." },
  { q: "Les chiffres CO₂ sont-ils sérieux ?", a: "Ils s'appuient sur la base carbone ADEME (mobilier), recalculés projet par projet selon la part réellement conservée, chinée ou achetée neuve. La méthode est consultable, pas seulement le résultat." },
  { q: "Combien coûte un projet ?", a: "Le premier rendu est offert. Ensuite, 29 € par projet complet — sans abonnement. Vous achetez vos meubles directement chez chaque enseigne, sans marge cachée." },
];

function Faq() {
  return (
    <section className="bg-[var(--v3-cream)] py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-6 sm:px-10">
        <RevealV2>
          <h2 className="v3-display text-4xl sm:text-5xl text-[var(--v3-ink)] mb-12">
            Questions honnêtes.
          </h2>
        </RevealV2>
        <FaqV2 items={FAQ_ITEMS} />
      </div>
    </section>
  );
}

/* -------------------------------- FINAL CTA -------------------------------- */
function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-[var(--v3-forest-deep)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={IMG.finale}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover opacity-45"
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "linear-gradient(to bottom, rgba(20,35,26,0.6), rgba(20,35,26,0.88))" }}
      />
      <div className="relative mx-auto max-w-7xl px-6 sm:px-10 py-28 sm:py-40 text-center">
        <RevealV2>
          <h2 className="v3-display text-5xl sm:text-7xl text-[var(--v3-cream)] text-balance">
            Commencez par une photo.
          </h2>
        </RevealV2>
        <RevealV2 delay={120}>
          <div className="mt-10 flex justify-center">
            <Link href={CTA} className="v3-btn">
              Transformer ma pièce <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--v3-cream)]/50">
            Premier projet offert · sans abonnement
          </p>
        </RevealV2>
      </div>
    </section>
  );
}

/* --------------------------------- FOOTER ---------------------------------- */
function Footer() {
  return (
    <footer className="bg-[var(--v3-cream)] border-t border-[var(--v3-line)] py-14">
      <div className="mx-auto max-w-7xl px-6 sm:px-10">
        <div className="flex flex-wrap items-start justify-between gap-10">
          <div>
            <Link href="/" className="flex items-center gap-2" aria-label="Héra">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/v2/brand/hera-logo-mark-bold.png" alt="" className="h-6 w-auto" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/v2/brand/hera-wordmark-regular-alpha.png" alt="Héra" className="h-5 w-auto" />
            </Link>
            <p className="mt-3 text-[12px] text-[var(--v3-muted)] max-w-xs">
              Studio de design circulaire. Paris.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-2 text-[13px] text-[var(--v3-muted)]">
            <a href="#methode" className="hover:text-[var(--v3-ink)] transition-colors">Méthode</a>
            <a href="#transformation" className="hover:text-[var(--v3-ink)] transition-colors">Projets</a>
            <a href="#tarifs" className="hover:text-[var(--v3-ink)] transition-colors">Tarifs</a>
            <Link href="/mentions-legales" className="hover:text-[var(--v3-ink)] transition-colors">Mentions légales</Link>
            <Link href="/confidentialite" className="hover:text-[var(--v3-ink)] transition-colors">Confidentialité</Link>
            <Link href="/cookies" className="hover:text-[var(--v3-ink)] transition-colors">Cookies</Link>
            <ManageCookiesButton className="hover:text-[var(--v3-ink)] transition-colors" />
          </nav>
        </div>
        <p className="mt-12 pt-6 border-t border-[var(--v3-line)] font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--v3-muted)]">
          © 2026 Héra Studio
        </p>
      </div>
    </footer>
  );
}
