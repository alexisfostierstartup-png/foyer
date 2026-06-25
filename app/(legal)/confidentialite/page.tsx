import Link from "next/link";
import {
  LegalPage,
  LegalSection,
  LegalTable,
  Todo,
} from "@/components/legal/legal-ui";

export const metadata = {
  title: "Politique de confidentialité — Foyer",
  description:
    "Comment Foyer traite vos données personnelles : finalités, bases légales, destinataires, durées, droits RGPD.",
};

export default function ConfidentialitePage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      updatedAt="25 juin 2026"
      intro="La présente politique décrit comment Foyer collecte et traite vos données personnelles, conformément au Règlement général sur la protection des données (RGPD) et à la loi Informatique et Libertés. Elle est distincte des conditions générales d'utilisation (CGU/CGV)."
    >
      <LegalSection title="Responsable de traitement">
        <p>
          Le responsable du traitement est <Todo />. Pour toute question
          relative à vos données, vous pouvez le contacter à l&apos;adresse{" "}
          <Todo label="e-mail de contact" />.
        </p>
        <p>
          Aucun délégué à la protection des données (DPO) n&apos;est désigné à ce
          jour : <Todo label="DPO le cas échéant" />.
        </p>
      </LegalSection>

      <LegalSection title="Données collectées">
        <p>Selon votre usage du service, nous traitons :</p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <strong>Données de compte</strong> : adresse e-mail, identifiants de
            connexion.
          </li>
          <li>
            <strong>Contenus que vous fournissez</strong> : photos de pièces
            téléversées, préférences de style, URL de produits.
          </li>
          <li>
            <strong>Données générées</strong> : rendus, projets sauvegardés,
            recommandations de produits.
          </li>
          <li>
            <strong>Données d&apos;usage et techniques</strong> : pages vues,
            interactions, type d&apos;appareil, données de mesure d&apos;audience
            (sous réserve de votre consentement).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Finalités et bases légales">
        <LegalTable
          columns={["Finalité", "Base légale"]}
          rows={[
            [
              "Génération de rendus de pièces à partir de vos photos",
              "Exécution du service (mesures précontractuelles / contrat)",
            ],
            [
              "Recommandations de produits adaptées à votre projet",
              "Exécution du service",
            ],
            [
              "Gestion de votre compte et de vos projets",
              "Exécution du service",
            ],
            [
              "Mesure d'audience et statistiques de fréquentation",
              "Consentement",
            ],
            [
              "Affiliation et liens commerciaux (attribution des achats)",
              "Consentement",
            ],
            [
              "Sécurité du service, prévention de la fraude et des abus",
              "Intérêt légitime",
            ],
          ]}
        />
      </LegalSection>

      <LegalSection title="Destinataires et sous-traitants">
        <p>
          Vos données sont accessibles aux personnes habilitées de Foyer et à des
          sous-traitants agissant pour notre compte :
        </p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <strong>Supabase</strong> — hébergement de la base de données et des
            fichiers (infrastructure UE).
          </li>
          <li>
            <strong>Vercel</strong> — hébergement et diffusion du site.
          </li>
          <li>
            <strong>Google</strong> — gestion de balises (Google Tag Manager) et
            mesure d&apos;audience (Google Analytics 4), uniquement après
            consentement.
          </li>
          <li>
            <strong>Réseaux d&apos;affiliation</strong> — Kwanko, Effinity, Awin
            et Affilae, pour l&apos;attribution des achats, uniquement après
            consentement.
          </li>
          <li>
            <strong>Google (Gemini)</strong> — si des contenus (par ex. une photo
            ou une description) sont transmis au modèle pour générer un rendu ou
            une recommandation.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Transferts hors Union européenne">
        <p>
          Certains prestataires (notamment Google et Vercel) sont susceptibles de
          traiter des données aux États-Unis. Ces transferts sont encadrés par
          des garanties appropriées : clauses contractuelles types de la
          Commission européenne (CCT) et/ou adhésion au cadre{" "}
          <em>EU-U.S. Data Privacy Framework</em>. Les données applicatives
          hébergées chez Supabase sont conservées au sein de l&apos;UE.
        </p>
      </LegalSection>

      <LegalSection title="Durées de conservation">
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <strong>Cookies et traceurs</strong> : durée de vie maximale de
            13 mois ; le consentement est conservé jusqu&apos;à 6 mois puis
            redemandé.
          </li>
          <li>
            <strong>Données de compte et projets</strong> : pendant la durée de
            votre compte, puis archivage / suppression.
          </li>
          <li>
            <strong>Données inactives à des fins de prospection</strong> :
            25 mois maximum à compter du dernier contact.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Vos droits">
        <p>
          Conformément au RGPD, vous disposez des droits d&apos;accès, de
          rectification, d&apos;effacement, de limitation, d&apos;opposition et de
          portabilité de vos données, ainsi que du droit de retirer votre
          consentement à tout moment (sans effet rétroactif). Vous pouvez exercer
          ces droits en écrivant à <Todo label="e-mail de contact" />.
        </p>
        <p>
          Vous avez également le droit d&apos;introduire une réclamation auprès de
          la Commission nationale de l&apos;informatique et des libertés (CNIL),{" "}
          <a
            href="https://www.cnil.fr"
            className="text-foyer-sage underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            www.cnil.fr
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          La liste des traceurs, leur finalité et leur durée sont détaillées dans
          la{" "}
          <Link
            href="/cookies"
            className="text-foyer-sage underline-offset-2 hover:underline"
          >
            politique de cookies
          </Link>
          . Vous pouvez à tout moment modifier vos choix via le bouton « Gérer
          mes cookies » présent en pied de page.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
