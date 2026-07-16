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
  score?: {
    kept: number;
    ecoNew: number;
    secondhand: number;
    co2SavedKg: number;
    co2EmittedKg?: number;
    totalEstimated: number;
  } | null;
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
    titre: "Un salon terracotta, conservé à 40 %",
    tag: "Bohème",
    surface: "32 m²",
    conserve: "40 %",
    resume:
      "Les murs repeints, le mobilier renouvelé, mais la pièce reste la sienne : mêmes volumes, même lumière, même parquet. Ce qui pouvait rester est resté.",
  },
  {
    slug: "salon-industriel",
    nom: "Salon industriel",
    titre: "Un salon viré industriel, cuir et métal noir",
    tag: "Industriel",
    surface: "24 m²",
    conserve: "22 %",
    resume:
      "Le parquet en chevrons et le meuble TV bas sont restés : c'est tout le reste, canapé en cuir, table basse, lustre en métal noir, qui bascule la pièce dans l'ambiance industrielle choisie.",
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
