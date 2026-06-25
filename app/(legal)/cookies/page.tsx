import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/legal-ui";
import { ManageCookiesButton } from "@/components/shared/manage-cookies-button";

export const metadata = {
  title: "Politique d'utilisation des cookies — Foyer",
  description:
    "Comment Foyer utilise les cookies : cookies nécessaires, mesure d'audience, affiliation, et gestion du consentement via Axeptio.",
};

const BROWSER_LINKS = [
  {
    name: "Chrome",
    href: "https://support.google.com/chrome/answer/95647?hl=fr",
  },
  {
    name: "Edge",
    href: "https://support.microsoft.com/fr-fr/microsoft-edge/supprimer-les-cookies-dans-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09",
  },
  {
    name: "Safari",
    href: "https://support.apple.com/fr-fr/guide/safari/sfri11471/mac",
  },
  {
    name: "Firefox",
    href: "https://support.mozilla.org/fr/kb/cookies-informations-sites-enregistrent",
  },
];

/** Renvoi stylé vers le panneau de consentement Axeptio (inline, dans le texte). */
function ConsentPanelLink() {
  return (
    <ManageCookiesButton className="font-medium text-foyer-sage underline-offset-2 hover:underline">
      Gérer mes cookies
    </ManageCookiesButton>
  );
}

export default function CookiesPage() {
  return (
    <LegalPage
      title="Politique d'utilisation des cookies"
      updatedAt="25 juin 2026"
      intro="La présente politique explique comment Foyer utilise des cookies et technologies analogues sur son site. Foyer recourt à une plateforme de gestion du consentement (CMP), Axeptio : aucun cookie de mesure d'audience ou d'affiliation n'est déposé avant votre consentement explicite. La liste détaillée des traceurs, avec leur durée, est consultable et modifiable à tout moment depuis le panneau « Gérer mes cookies »."
    >
      <LegalSection title="1. Qu'est-ce qu'un cookie ?">
        <p>
          Un cookie est un petit fichier texte stocké par votre navigateur lors
          de la visite d&apos;un site. Il permet notamment de mémoriser vos
          préférences, de sécuriser votre session ou de comprendre comment le
          site est utilisé. Aux fins de la présente politique, le terme « cookie »
          recouvre également les technologies analogues (stockage local,
          identifiants, pixels).
        </p>
      </LegalSection>

      <LegalSection title="2. Utilisons-nous des cookies ?">
        <p>Oui. Nous utilisons des cookies afin :</p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>de garantir le bon fonctionnement et la sécurité du site ;</li>
          <li>de mémoriser vos choix, dont vos préférences de consentement ;</li>
          <li>
            de mesurer l&apos;audience et comprendre comment le site est utilisé
            (avec votre consentement) ;
          </li>
          <li>
            d&apos;assurer l&apos;attribution des achats réalisés via nos liens
            d&apos;affiliation (avec votre consentement).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Qui dépose des cookies ?">
        <p>Deux types de cookies peuvent être déposés :</p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <strong>Les cookies internes</strong>, déposés par Foyer pour le
            fonctionnement du site et la mémorisation de vos choix.
          </li>
          <li>
            <strong>Les cookies tiers</strong>, déposés par des partenaires —
            notamment <strong>Google</strong> (mesure d&apos;audience) et les
            réseaux d&apos;affiliation <strong>Kwanko</strong>,{" "}
            <strong>Effinity</strong>, <strong>Awin</strong> et{" "}
            <strong>Affilae</strong> — uniquement après votre consentement.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Les catégories de cookies">
        <p>
          Foyer distingue trois catégories. Vous pouvez accepter ou refuser
          chacune d&apos;elles, et retrouver la liste précise des traceurs (nom,
          émetteur, durée) dans le panneau <ConsentPanelLink />.
        </p>

        <div className="space-y-2 pt-2">
          <h3 className="font-serif text-[18px] text-foyer-ink">
            Cookies nécessaires
          </h3>
          <p>
            Indispensables au fonctionnement du site, ils ne requièrent pas de
            consentement : sécurité, prévention de la fraude, et mémorisation de
            vos préférences de consentement (cookie de la CMP Axeptio). Tant que
            vous n&apos;avez pas consenti, les signaux Google Consent Mode v2
            restent sur <code>denied</code> et aucun autre cookie n&apos;est
            écrit.
          </p>
        </div>

        <div className="space-y-2 pt-2">
          <h3 className="font-serif text-[18px] text-foyer-ink">
            Mesure d&apos;audience
          </h3>
          <p>
            Avec votre consentement, nous utilisons{" "}
            <strong>Google Analytics 4</strong> pour comprendre comment le site
            est utilisé et l&apos;améliorer. GA4 dépose des cookies de type{" "}
            <code>_ga</code> et <code>_ga_*</code> (durée de vie jusqu&apos;à
            13 mois). Ces cookies ne sont jamais déposés avant votre accord.
          </p>
        </div>

        <div className="space-y-2 pt-2">
          <h3 className="font-serif text-[18px] text-foyer-ink">Affiliation</h3>
          <p>
            Avec votre consentement, nos partenaires d&apos;affiliation —{" "}
            <strong>Kwanko</strong>, <strong>Effinity</strong>,{" "}
            <strong>Awin</strong> et <strong>Affilae</strong> — déposent des
            cookies tiers à finalité marketing permettant d&apos;attribuer un
            achat réalisé via l&apos;un de nos liens. Ces cookies, propres à
            chaque réseau, ont une durée généralement comprise entre quelques
            jours et plusieurs semaines (souvent jusqu&apos;à 30 jours). Ils ne
            sont déposés qu&apos;après votre accord.
          </p>
        </div>
      </LegalSection>

      <LegalSection title="5. Accepter ou refuser les cookies">
        <p>
          Au premier chargement, le bandeau Axeptio vous permet d&apos;accepter
          ou de refuser chaque catégorie de cookies non essentiels. Vous pouvez
          modifier vos choix à tout moment via le bouton <ConsentPanelLink /> en
          pied de page.
        </p>
        <p>
          Votre navigateur vous permet également de gérer ou supprimer les
          cookies déjà déposés :
        </p>
        <ul className="ml-5 flex flex-wrap gap-x-5 gap-y-1.5">
          {BROWSER_LINKS.map((b) => (
            <li key={b.name}>
              <a
                href={b.href}
                className="text-foyer-sage underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {b.name}
              </a>
            </li>
          ))}
        </ul>
        <p className="text-[13.5px] text-foyer-muted">
          Le détail de chaque traceur (nom, émetteur, finalité, durée) et la
          gestion de vos préférences sont disponibles dans le panneau de
          consentement Axeptio. Le traitement de vos données est par ailleurs
          décrit dans la{" "}
          <Link
            href="/confidentialite"
            className="text-foyer-sage underline-offset-2 hover:underline"
          >
            politique de confidentialité
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
