import "server-only";
import { getProject } from "@/lib/storage/projects";
import { getAmbiances } from "@/lib/db/assets";
import { resolveTopPicks, displayedRenderUrl, type TopPick } from "@/lib/shopping/topPicks";

/* ============================================================================
 * DOSSIERS PRO — /projets/pro/<client>/<dossier>
 *
 * Un comparateur : par pièce, deux directions de style côte à côte, à départager.
 *
 * Contrairement à la vitrine publique (lib/projets.ts, données FIGÉES dans un JSON),
 * on lit ici la base EN DIRECT : le CTA « Modifier ce projet » ramène dans le parcours,
 * donc la page doit refléter l'état courant, pas un instantané qui mentirait dès la
 * première retouche.
 *
 * Le style affiché vient de `selectedStyleId` (la base fait foi). `styleLabel` n'est là
 * que pour forcer un libellé éditorial si le client veut sa propre nomenclature.
 * ========================================================================== */

export type VarianteConfig = {
  projectId: string;
  /** Force le libellé de style. Absent → on affiche le style réellement enregistré. */
  styleLabel?: string;
};

export type PieceConfig = {
  slug: string;
  label: string;
  /** Vide = pièce annoncée mais pas encore travaillée (onglet visible, état vide). */
  variantes: VarianteConfig[];
};

export type DossierProConfig = {
  client: string;
  dossier: string;
  nom: string;
  sousTitre: string;
  pieces: PieceConfig[];
};

export const DOSSIERS_PRO: DossierProConfig[] = [
  {
    client: "maxinvest",
    dossier: "projet1",
    nom: "MaxInvest",
    sousTitre: "Deux directions par pièce. Ouvrez celle que vous voulez retoucher.",
    pieces: [
      {
        slug: "salon",
        label: "Salon",
        variantes: [
          { projectId: "tlnbe2pkz_wlUX45cBiLM" },
          { projectId: "sVObM1O5kqXWyRpdZ_Vxl" },
        ],
      },
      { slug: "salle-a-manger", label: "Salle à manger", variantes: [] },
      {
        slug: "chambre",
        label: "Chambre",
        variantes: [
          { projectId: "mf2qQGivhpUz0nqPv4YAd" },
          { projectId: "PWDbgzbmBhSLghiWZmZYI" },
        ],
      },
      {
        slug: "chambre-parentale",
        label: "Chambre parentale",
        variantes: [
          { projectId: "D__Rc7vGog0FGy9upEMfL" },
          { projectId: "Hev0_ouvwrvcGwsnDoTC7" },
        ],
      },
    ],
  },
];

export type VarianteVue = {
  projectId: string;
  style: string;
  renderUrl: string | null;
  items: TopPick[];
  total: number;
  sansPrix: number;
  /** Le projet existe mais n'a pas encore de liste (analyse en cours ou échouée). */
  listePrete: boolean;
};

export type PieceVue = { slug: string; label: string; variantes: VarianteVue[] };

export type DossierProVue = {
  client: string;
  dossier: string;
  nom: string;
  sousTitre: string;
  pieces: PieceVue[];
};

export async function getDossierPro(
  client: string,
  dossier: string,
): Promise<DossierProVue | null> {
  const conf = DOSSIERS_PRO.find((d) => d.client === client && d.dossier === dossier);
  if (!conf) return null;

  // Libellés de style : une seule lecture pour tout le dossier.
  const ambiances = await getAmbiances();
  const labelParSlug = new Map(ambiances.map((a) => [a.id, a.name]));

  const pieces = await Promise.all(
    conf.pieces.map(async (piece) => {
      const variantes = await Promise.all(
        piece.variantes.map(async (v): Promise<VarianteVue | null> => {
          const p = await getProject(v.projectId);
          if (!p) return null;

          const styleId = p.selectedStyleId ?? "";
          const { items, total, sansPrix } = resolveTopPicks(p);

          return {
            projectId: v.projectId,
            style: v.styleLabel ?? labelParSlug.get(styleId) ?? styleId ?? "Sans style",
            renderUrl: displayedRenderUrl(p),
            items,
            total,
            sansPrix,
            listePrete: items.length > 0,
          };
        }),
      );
      return { slug: piece.slug, label: piece.label, variantes: variantes.filter((v) => v !== null) };
    }),
  );

  return { client: conf.client, dossier: conf.dossier, nom: conf.nom, sousTitre: conf.sousTitre, pieces };
}
