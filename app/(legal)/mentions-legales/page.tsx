import Link from "next/link";
import {
  LegalPage,
  LegalSection,
  DefinitionList,
  Todo,
} from "@/components/legal/legal-ui";

export const metadata = {
  title: "Mentions légales — Foyer",
  description:
    "Mentions légales du site Foyer : éditeur, directeur de la publication, hébergement.",
};

export default function MentionsLegalesPage() {
  return (
    <LegalPage
      title="Mentions légales"
      updatedAt="25 juin 2026"
      intro="Conformément à l'article 6 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique (LCEN), les présentes mentions légales précisent l'identité de l'éditeur et de l'hébergeur du site Foyer."
    >
      <LegalSection title="Éditeur du site">
        <DefinitionList
          items={[
            { term: "Dénomination sociale", value: <Todo /> },
            { term: "Forme juridique", value: <Todo /> },
            { term: "Capital social", value: <Todo /> },
            { term: "Siège social", value: <Todo /> },
            { term: "SIREN / RCS", value: <Todo /> },
            { term: "N° TVA intracommunautaire", value: <Todo /> },
            { term: "E-mail", value: <Todo /> },
            { term: "Téléphone", value: <Todo /> },
          ]}
        />
      </LegalSection>

      <LegalSection title="Directeur de la publication">
        <p>
          Le directeur de la publication du site est <Todo />.
        </p>
      </LegalSection>

      <LegalSection title="Hébergement">
        <p>
          Le site est hébergé par <strong>Vercel Inc.</strong>, 340 S Lemon Ave
          #4133, Walnut, CA 91789, États-Unis (
          <a
            href="https://vercel.com"
            className="text-foyer-sage underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            vercel.com
          </a>
          ).
        </p>
        <p>
          Les données applicatives (comptes, projets, fichiers) sont hébergées
          par <strong>Supabase</strong> (Supabase, Inc.), sur une infrastructure
          située au sein de l&apos;Union européenne (
          <a
            href="https://supabase.com"
            className="text-foyer-sage underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            supabase.com
          </a>
          ).
        </p>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          L&apos;ensemble des éléments du site (textes, visuels, logos, charte
          graphique, code, marques) est protégé par le droit de la propriété
          intellectuelle et reste la propriété exclusive de l&apos;éditeur ou de
          ses partenaires. Toute reproduction, représentation ou exploitation,
          totale ou partielle, sans autorisation écrite préalable est interdite.
        </p>
        <p>
          Les rendus générés à partir de vos photos vous restent destinés dans
          les conditions prévues par les conditions générales d&apos;utilisation.
        </p>
      </LegalSection>

      <LegalSection title="Liens d'affiliation">
        <p>
          Le site comporte des liens commerciaux dits « d&apos;affiliation ».
          Lorsqu&apos;un achat est réalisé via l&apos;un de ces liens, Foyer peut
          percevoir une commission de la part du marchand, sans surcoût pour
          vous. Ces liens ne déposent de cookies de suivi qu&apos;après votre
          consentement (voir la{" "}
          <Link
            href="/cookies"
            className="text-foyer-sage underline-offset-2 hover:underline"
          >
            page Cookies
          </Link>
          ).
        </p>
      </LegalSection>

      <LegalSection title="Responsabilité">
        <p>
          L&apos;éditeur s&apos;efforce d&apos;assurer l&apos;exactitude et la
          mise à jour des informations diffusées sur le site, sans pouvoir le
          garantir. Les rendus générés sont fournis à titre indicatif et ne
          constituent pas un engagement contractuel sur le résultat final
          d&apos;un aménagement. L&apos;éditeur ne saurait être tenu responsable
          des contenus des sites tiers accessibles via des liens hypertextes.
        </p>
      </LegalSection>

      <LegalSection title="Données personnelles et cookies">
        <p>
          Le traitement de vos données personnelles est décrit dans la{" "}
          <Link
            href="/confidentialite"
            className="text-foyer-sage underline-offset-2 hover:underline"
          >
            politique de confidentialité
          </Link>
          . La gestion des traceurs et de votre consentement est détaillée dans
          la{" "}
          <Link
            href="/cookies"
            className="text-foyer-sage underline-offset-2 hover:underline"
          >
            politique de cookies
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Droit applicable">
        <p>
          Les présentes mentions légales sont régies par le droit français. En
          cas de litige, et à défaut de résolution amiable, les tribunaux
          français seront seuls compétents.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
