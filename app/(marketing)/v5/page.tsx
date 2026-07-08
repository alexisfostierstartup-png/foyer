import type { Metadata } from "next";
import "./v5.css";
import { CursorProvider } from "@/components/landing/v5/parts";
import {
  Faq,
  FinalCta,
  Footer,
  Gallery,
  Header,
  Hero,
  Manifesto,
  MarqueeStrip,
  Pricing,
  Stats,
} from "@/components/landing/v5/sections";

/* ============================================================================
 * Landing v5 — « Studio, pas app ».
 * Vitrine haut de gamme, motion-riche : curseur custom, hero scroll-linked,
 * rythme clair/sombre, galerie horizontale, boutons magnétiques.
 * Brand Héra (mêmes assets que /v2). Route indépendante des autres versions.
 * ========================================================================== */

export const metadata: Metadata = {
  title: "Héra — Le studio de votre intérieur.",
  description:
    "Une photo, un rendu sourcé meuble par meuble, des commandes prêtes chez de vraies enseignes. Le studio, pas la boîte noire.",
};

export default function LandingV5() {
  return (
    <div className="v5-root min-h-screen bg-[var(--v5-paper)] text-[var(--v5-ink)] overflow-x-hidden selection:bg-[var(--v5-gold)] selection:text-[var(--v5-ink)]">
      <CursorProvider>
        <Header />
        <Hero />
        <Manifesto />
        <Stats />
        <Gallery />
        <MarqueeStrip />
        <Pricing />
        <Faq />
        <FinalCta />
        <Footer />
      </CursorProvider>
    </div>
  );
}
