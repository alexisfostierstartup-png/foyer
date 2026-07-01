import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Footer } from "@/components/shared/footer";

// CMP — Axeptio. Doit poser l'état de consentement Google Consent Mode v2
// (par défaut « denied ») AVANT le chargement de GTM. Le Consent Mode est géré
// par Axeptio via window.axeptioSettings.googleConsentMode : ne pas ajouter de
// gtag('consent', ...) manuel ici.
const AXEPTIO_INLINE = `
window.axeptioSettings = {
  clientId: "6a3cde19c612fbe37a134ceb",
  cookiesVersion: "65e7fada-6919-4373-a713-b1db868d5983",
  googleConsentMode: {
    default: {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      wait_for_update: 500
    }
  }
};

(function(d, s) {
  var t = d.getElementsByTagName(s)[0], e = d.createElement(s);
  e.async = true; e.src = "//static.axept.io/sdk.js";
  t.parentNode.insertBefore(e, t);
})(document, "script");
`;

// Google Tag Manager — chargé APRÈS Axeptio. GA4 et les tags d'affiliation
// (Kwanko, Effinity, Awin, Affilae) sont configurés DANS GTM, pas en dur ici.
const GTM_INLINE = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-M8ZBLXCF');`;

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  // opsz/SOFT : axes optiques pour le rendu "display" (haut contraste) + vraie italique.
  axes: ["opsz", "SOFT"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Foyer — Votre pièce, transformée. Réellement.",
  description: "De la photo aux commandes prêtes, on pense le projet avec vous.",
};

export const viewport: Viewport = {
  themeColor: "#FAF6F0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${fraunces.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-foyer-cream font-sans text-foyer-ink">
        {/* Google Tag Manager (noscript) — juste après l'ouverture du <body> */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-M8ZBLXCF"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>

        {/* 1. Axeptio en PREMIER (beforeInteractive) : pose le Consent Mode « denied ». */}
        <Script
          id="axeptio-cmp"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: AXEPTIO_INLINE }}
        />

        {/* 2. GTM ENSUITE (afterInteractive). */}
        <Script
          id="gtm"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: GTM_INLINE }}
        />

        {children}
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
