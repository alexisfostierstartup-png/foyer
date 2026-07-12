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

/**
 * Comment la pièce se présente. `colonnes` = deux directions côte à côte (le défaut).
 * `diaporama` = un carrousel cyclique : le projet courant en grand, ses deux voisins
 * en visuel seul, légèrement décalés. C'est de la CONFIG, pas un cas particulier codé en
 * dur : n'importe quelle pièce peut basculer d'un mode à l'autre.
 */
export type Affichage = "colonnes" | "diaporama";

export type PieceConfig = {
  slug: string;
  label: string;
  affichage?: Affichage;
  /** Projet ouvert en premier. Absent → le premier de la liste. */
  debut?: string;
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
      {
        slug: "salle-a-manger",
        label: "Salle à manger",
        affichage: "diaporama",
        debut: "gIgy56Zp5IZLJYUNkxKhK", // on ouvre sur le japandi
        variantes: [
          { projectId: "SRGdM5x7fKC9lvKu2e3u2" }, // bohème
          { projectId: "gIgy56Zp5IZLJYUNkxKhK" }, // japandi
          { projectId: "zHU_vib6qMAAVTSy-k4MV" }, // color block
          { projectId: "VmC_BeUULYiyfNpxUHmsJ" }, // moderne
          { projectId: "RMzzdoiYYKS3WGc6H4LRu" }, // scandinave
        ],
      },
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
  /** Photo d'origine de la pièce — la moitié « avant » du comparateur. */
  basePhotoUrl: string | null;
  renderUrl: string | null;
  items: TopPick[];
  total: number;
  sansPrix: number;
  /** Le projet existe mais n'a pas encore de liste (analyse en cours ou échouée). */
  listePrete: boolean;
};

export type PieceVue = {
  slug: string;
  label: string;
  affichage: Affichage;
  /** Index de départ dans `variantes` (0 si `debut` n'est pas résolu). */
  depart: number;
  variantes: VarianteVue[];
};

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
            basePhotoUrl: p.basePhotoUrl ?? null,
            renderUrl: displayedRenderUrl(p),
            items,
            total,
            sansPrix,
            listePrete: items.length > 0,
          };
        }),
      );
      const retenues = variantes.filter((v) => v !== null);
      // On cherche l'index APRÈS filtrage : si un projet a disparu de la base, le départ
      // pointerait sinon sur une autre variante que celle voulue.
      const depart = Math.max(
        0,
        retenues.findIndex((v) => v.projectId === piece.debut),
      );

      return {
        slug: piece.slug,
        label: piece.label,
        affichage: piece.affichage ?? "colonnes",
        depart,
        variantes: retenues,
      };
    }),
  );

  return { client: conf.client, dossier: conf.dossier, nom: conf.nom, sousTitre: conf.sousTitre, pieces };
}
