import "server-only";

/**
 * VITRINE — les projets réalisés, exposés publiquement sur /projets/<slug>.
 *
 * Le CONTENU (rendu, liste, produits) est FIGÉ dans data/projets/<slug>.json, produit
 * par scripts/export-projet-vitrine.ts depuis un vrai projet. On ne lit pas la base en
 * direct : une vitrine ne doit pas bouger quand on retouche le projet, et un rendu raté
 * ne doit jamais s'afficher tout seul sur le site.
 *
 * Le MÉTA (titre, surface, part conservée) vit ici : c'est de l'éditorial, pas de la
 * donnée produit.
 */

export type ProjetVitrine = {
  slug: string;
  projectId: string;
  beforeUrl: string;
  afterUrl: string;
  totalEstimated: number;
  items: {
    category: string;
    detected: string;
    quantity: number;
    source: string;
    product: {
      name: string;
      price: number | null;
      merchant: string | null;
      imageUrl: string | null;
      url: string | null;
    };
  }[];
};

export type ProjetMeta = {
  slug: string;
  nom: string;
  titre: string;
  tag: string;
  surface: string;
  conserve: string;
  resume: string;
};

// L'ordre fait foi pour la galerie de la landing.
export const PROJETS: ProjetMeta[] = [
  {
    slug: "appartement-parisien",
    nom: "Salon parisien",
    titre: "Un salon terracotta, conservé à 68 %",
    tag: "Haussmann",
    surface: "32 m²",
    conserve: "68 %",
    resume:
      "Les murs repeints, le mobilier renouvelé, mais la pièce reste la sienne : mêmes volumes, même lumière, même parquet. Ce qui pouvait rester est resté.",
  },
];

/** Charge les données figées d'un projet. `null` si le fichier n'existe pas encore. */
export async function getProjet(slug: string): Promise<ProjetVitrine | null> {
  if (!PROJETS.some((p) => p.slug === slug)) return null;
  try {
    const data = (await import(`@/data/projets/${slug}.json`)).default;
    return data as ProjetVitrine;
  } catch {
    return null;
  }
}
