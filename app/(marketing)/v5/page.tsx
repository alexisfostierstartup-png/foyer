import type { Metadata } from "next";
import "./v5.css";
import {
  Faq,
  FinalCta,
  Footer,
  Gallery,
  Hero,
  Manifesto,
  Method,
  Nav,
  Partners,
  Pricing,
  Results,
} from "@/components/landing/v5/sections";

/* ============================================================================
 * Landing v5 — « Studio, pas app ».
 * Architecture repensée (référence : studioilse.com) : hero quasi vide porté
 * par la photo, navigation plein-écran typographique, sections asymétriques,
 * galerie edge-to-edge, un seul registre clair. Le seul motion "signature"
 * qui reste est la résolution avant/après du hero (parts.tsx). `Nav` porte
 * son propre état client (menu plein-écran) pour que cette page reste un
 * Server Component avec metadata.
 * ========================================================================== */

export const metadata: Metadata = {
  title: "Héra — Le studio de votre intérieur.",
};

export default function LandingV5() {
  return (
    <div className="v5-root min-h-screen bg-[var(--v5-paper)] text-[var(--v5-ink)] overflow-x-hidden selection:bg-[var(--v5-gold)] selection:text-[var(--v5-ink)]">
      <Nav />
      <Hero />
      <Manifesto />
      <Method />
      <Results />
      <Partners />
      <Gallery />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  );
}
