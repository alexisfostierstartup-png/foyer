import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProComparateur } from "@/components/projets/ProComparateur";
import { DOSSIERS_PRO, getDossierPro } from "@/lib/projetsPro";

/* ============================================================================
 * DOSSIER PRO — /projets/pro/<client>/<dossier>
 *
 * Comparateur par pièce : deux directions de style côte à côte (style, visuel,
 * liste de courses, total, CTA d'édition).
 *
 * Données lues EN DIRECT (cf. lib/projetsPro.ts) : le CTA renvoie dans le parcours,
 * la page doit donc montrer l'état courant. C'est l'inverse de la vitrine publique,
 * volontairement figée.
 * ========================================================================== */

// Le dossier reflète l'état courant des projets : pas de cache entre deux visites.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ client: string; dossier: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { client, dossier } = await params;
  const conf = DOSSIERS_PRO.find((d) => d.client === client && d.dossier === dossier);
  return {
    title: conf ? `${conf.nom} — dossier Héra` : "Dossier — Héra",
    robots: { index: false, follow: false }, // dossier client : hors index public
  };
}

export default async function DossierProPage({ params }: Params) {
  const { client, dossier } = await params;
  const vue = await getDossierPro(client, dossier);
  if (!vue) notFound();

  return (
    <main className="min-h-screen bg-foyer-cream">
      <ProComparateur dossier={vue} />
    </main>
  );
}
