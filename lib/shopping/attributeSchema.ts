/**
 * RÉFÉRENTIEL D'ATTRIBUTS PAR CATÉGORIE (Étape 2 du matching structuré). — BASE À COMPLÉTER.
 *
 * Idée : au lieu de comparer des embeddings texte génériques (qui floutent couleur/forme/
 * matière), on extrait pour CHAQUE catégorie un petit jeu d'attributs structurés, sur le
 * RENDU (via Gemini) ET sur le PRODUIT (via Gemini/metadata), puis on matche attribut par
 * attribut. Le `vocab` fermé est essentiel : Gemini DOIT choisir une valeur de la liste →
 * render et produit décrits avec les mêmes mots → comparables.
 *
 * `weight` = poids de l'attribut dans le score TEXTE/SÉMANTIQUE (somme = 100 par catégorie).
 * Le score global reste : image × w + (texte structuré) × (1−w). Ces poids répartissent la
 * part texte. La couleur (`type:"hex"`) se compare en ΔE (latitude), pas en exact.
 *
 * À TOI : ajuster les poids, compléter/corriger les vocabulaires, ajouter des catégories.
 * Les poids ci-dessous sont une proposition cohérente de départ.
 */

export type AttributeType = "enum" | "hex" | "number";

export type AttributeSpec = {
  key: string;            // clé machine (ex. "seats")
  label: string;          // libellé FR
  weight: number;         // poids dans le score texte (somme = 100 / catégorie)
  type: AttributeType;    // enum = vocabulaire fermé ; hex = couleur (ΔE) ; number = numérique
  vocab?: string[];       // valeurs autorisées (enum uniquement)
};

export type CategorySchema = { category: string; attributes: AttributeSpec[] };

export const ATTRIBUTE_SCHEMA: Record<string, AttributeSpec[]> = {
  // ── Assises ────────────────────────────────────────────────────────────────
  sofa: [
    { key: "seats",       label: "nombre de places", weight: 25, type: "enum",
      vocab: ["1 place", "2 places", "3 places", "4 places et +", "angle", "modulaire", "panoramique"] },
    { key: "shape",       label: "forme",            weight: 15, type: "enum",
      vocab: ["droit", "angle gauche", "angle droit", "méridienne", "convertible"] },
    { key: "color",       label: "couleur",          weight: 25, type: "hex" },
    { key: "upholstery",  label: "revêtement",       weight: 20, type: "enum",
      vocab: ["tissu", "velours", "velours côtelé", "lin", "bouclé", "cuir", "simili cuir", "chenille"] },
    { key: "legs",        label: "pieds",            weight: 15, type: "enum",
      vocab: ["bois clair", "bois foncé", "métal noir", "métal doré", "métal chromé", "sans pieds apparents"] },
  ],
  armchair: [
    { key: "shape",       label: "forme",            weight: 20, type: "enum",
      vocab: ["bergère", "crapaud", "à oreilles", "coque/œuf", "scandinave", "fauteuil bas", "cabriolet"] },
    { key: "color",       label: "couleur",          weight: 25, type: "hex" },
    { key: "upholstery",  label: "revêtement",       weight: 25, type: "enum",
      vocab: ["tissu", "velours", "velours côtelé", "bouclé", "lin", "cuir", "simili cuir", "rotin/cannage"] },
    { key: "legs",        label: "pieds",            weight: 15, type: "enum",
      vocab: ["bois clair", "bois foncé", "métal noir", "métal doré", "pivotant"] },
    { key: "armrests",    label: "accoudoirs",       weight: 15, type: "enum",
      vocab: ["avec accoudoirs", "sans accoudoirs"] },
  ],

  // ── Tables ─────────────────────────────────────────────────────────────────
  coffee_table: [
    { key: "top_color",   label: "couleur plateau",  weight: 25, type: "hex" },
    { key: "top_material",label: "matière plateau",  weight: 20, type: "enum",
      vocab: ["bois clair", "bois foncé", "chêne", "noyer", "blanc laqué", "noir", "marbre", "verre", "métal", "travertin", "béton"] },
    { key: "shape",       label: "forme",            weight: 20, type: "enum",
      vocab: ["ronde", "ovale", "rectangulaire", "carrée", "gigogne/lot"] },
    { key: "legs_material",label: "matière pieds",   weight: 15, type: "enum",
      vocab: ["bois", "métal noir", "métal doré", "métal chromé", "même matière que plateau"] },
    { key: "legs_type",   label: "type de pieds",    weight: 10, type: "enum",
      vocab: ["4 pieds", "pied central", "compas/scandinave", "luge", "sur roulettes"] },
    { key: "style",       label: "style",            weight: 10, type: "enum",
      vocab: ["scandinave", "contemporain", "industriel", "bohème", "classique"] },
  ],
  side_table: [
    { key: "top_color",   label: "couleur plateau",  weight: 30, type: "hex" },
    { key: "top_material",label: "matière plateau",  weight: 25, type: "enum",
      vocab: ["bois clair", "bois foncé", "blanc", "noir", "marbre", "verre", "métal", "rotin"] },
    { key: "shape",       label: "forme",            weight: 20, type: "enum",
      vocab: ["ronde", "carrée", "rectangulaire", "irrégulière"] },
    { key: "legs_type",   label: "piètement",        weight: 25, type: "enum",
      vocab: ["4 pieds", "pied central", "compas", "gigogne", "tabouret/bout de canapé"] },
  ],

  // ── Tapis ──────────────────────────────────────────────────────────────────
  rug: [
    { key: "color",       label: "couleur",          weight: 30, type: "hex" },
    { key: "weave",       label: "tissage / texture",weight: 25, type: "enum",
      vocab: ["tissé plat", "shaggy/poil long", "berbère", "tufté", "jute tressé", "kilim", "à franges", "velours ras"] },
    { key: "shape",       label: "forme",            weight: 15, type: "enum",
      vocab: ["rectangulaire", "rond", "ovale", "coureur/galerie"] },
    { key: "pattern",     label: "motif",            weight: 15, type: "enum",
      vocab: ["uni", "géométrique", "chevron", "berbère losanges", "oriental/persan", "abstrait", "rayé"] },
    { key: "material",    label: "matière",          weight: 15, type: "enum",
      vocab: ["laine", "coton", "jute/sisal", "synthétique/polypropylène", "viscose"] },
  ],

  // ── Rangements ─────────────────────────────────────────────────────────────
  tv_stand: [
    { key: "color",       label: "couleur",          weight: 25, type: "hex" },
    { key: "material",    label: "matière",          weight: 20, type: "enum",
      vocab: ["bois clair", "bois foncé", "chêne", "noyer", "blanc", "noir", "cannage"] },
    { key: "storage",     label: "rangement",        weight: 20, type: "enum",
      vocab: ["portes", "tiroirs", "niches ouvertes", "mixte"] },
    { key: "legs",        label: "piètement",        weight: 20, type: "enum",
      vocab: ["compas/scandinave", "métal", "sur roulettes", "caisson posé au sol"] },
    { key: "style",       label: "style",            weight: 15, type: "enum",
      vocab: ["scandinave", "contemporain", "industriel", "bohème"] },
  ],
  bookshelf: [
    { key: "color",       label: "couleur",          weight: 25, type: "hex" },
    { key: "material",    label: "matière",          weight: 20, type: "enum",
      vocab: ["bois clair", "bois foncé", "métal noir", "blanc", "mixte bois-métal"] },
    { key: "form",        label: "forme",            weight: 20, type: "enum",
      vocab: ["bibliothèque haute", "étagère murale", "étagère échelle", "cube/casier", "modulaire"] },
    { key: "structure",   label: "structure",        weight: 20, type: "enum",
      vocab: ["fermée avec portes", "ouverte", "mixte"] },
    { key: "style",       label: "style",            weight: 15, type: "enum",
      vocab: ["scandinave", "industriel", "contemporain"] },
  ],
  dresser: [
    { key: "color",       label: "couleur",          weight: 25, type: "hex" },
    { key: "material",    label: "matière",          weight: 20, type: "enum",
      vocab: ["bois clair", "bois foncé", "chêne", "noyer", "blanc", "cannage"] },
    { key: "drawers",     label: "nombre de tiroirs",weight: 15, type: "enum",
      vocab: ["2", "3", "4", "5 et +"] },
    { key: "legs",        label: "piètement",        weight: 20, type: "enum",
      vocab: ["compas/scandinave", "droits", "métal", "sur roulettes"] },
    { key: "style",       label: "style",            weight: 20, type: "enum",
      vocab: ["scandinave", "vintage/rétro", "contemporain", "bohème"] },
  ],
  nightstand: [
    { key: "color",       label: "couleur",          weight: 30, type: "hex" },
    { key: "material",    label: "matière",          weight: 25, type: "enum",
      vocab: ["bois clair", "bois foncé", "blanc", "noir", "cannage", "métal"] },
    { key: "drawers",     label: "tiroirs",          weight: 20, type: "enum",
      vocab: ["0 (niche)", "1 tiroir", "2 tiroirs"] },
    { key: "legs",        label: "piètement",        weight: 25, type: "enum",
      vocab: ["compas/scandinave", "droits", "suspendu", "sur roulettes"] },
  ],

  // ── Lit & textile ──────────────────────────────────────────────────────────
  bed: [
    { key: "color",       label: "couleur",          weight: 25, type: "hex" },
    { key: "headboard",   label: "tête de lit",      weight: 25, type: "enum",
      vocab: ["capitonnée", "droite tissu", "bois", "métal", "cannage/rotin", "sans tête"] },
    { key: "material",    label: "matière",          weight: 20, type: "enum",
      vocab: ["tissu", "velours", "bois clair", "bois foncé", "métal"] },
    { key: "storage",     label: "rangement",        weight: 15, type: "enum",
      vocab: ["avec coffre", "avec tiroirs", "sans rangement"] },
    { key: "style",       label: "style",            weight: 15, type: "enum",
      vocab: ["scandinave", "contemporain", "bohème", "industriel"] },
  ],
  curtains: [
    { key: "color",       label: "couleur",          weight: 35, type: "hex" },
    { key: "material",    label: "matière",          weight: 25, type: "enum",
      vocab: ["lin", "coton", "velours", "voilage/transparent", "occultant"] },
    { key: "pattern",     label: "motif",            weight: 20, type: "enum",
      vocab: ["uni", "rayé", "géométrique", "à motifs"] },
    { key: "heading",     label: "finition haute",   weight: 20, type: "enum",
      vocab: ["œillets", "à nouettes", "fronces/galon"] },
  ],

  // ── Luminaire ──────────────────────────────────────────────────────────────
  floor_lamp: [
    { key: "structure",   label: "structure",        weight: 25, type: "enum",
      vocab: ["arqué", "droit/colonne", "trépied", "liseuse orientable", "à plusieurs branches"] },
    { key: "abat_jour",   label: "abat-jour",        weight: 30, type: "enum",
      vocab: ["tissu", "métal/dôme", "rotin/bambou", "verre/opaline", "sans abat-jour"] },
    { key: "color",       label: "couleur",          weight: 25, type: "hex" },
    { key: "material",    label: "matière",          weight: 20, type: "enum",
      vocab: ["métal noir", "métal doré/laiton", "métal chromé", "bois"] },
  ],

  // ── Sol (complète le filtre matériau FLOOR_MATERIALS existant) ──────────────
  floor_material: [
    { key: "type",        label: "type de revêtement", weight: 40, type: "enum",
      vocab: ["parquet/stratifié", "carrelage", "béton ciré", "pvc/vinyle", "jonc de mer"] },
    { key: "color",       label: "couleur/essence",  weight: 30, type: "hex" },
    { key: "pattern",     label: "pose/motif",       weight: 20, type: "enum",
      vocab: ["droit/lames", "chevron", "point de hongrie", "bâtons rompus", "uni/dalle"] },
    { key: "finish",      label: "finition",         weight: 10, type: "enum",
      vocab: ["mat", "satiné", "brillant", "brossé"] },
  ],

  // ── Repli générique (catégories sans schéma dédié) ─────────────────────────
  default: [
    { key: "color",       label: "couleur",          weight: 45, type: "hex" },
    { key: "material",    label: "matière",          weight: 30, type: "enum",
      vocab: ["bois clair", "bois foncé", "métal", "tissu", "plastique", "verre", "rotin", "blanc", "noir"] },
    { key: "style",       label: "style",            weight: 25, type: "enum",
      vocab: ["scandinave", "contemporain", "industriel", "bohème", "classique"] },
  ],
};

/** Schéma d'une catégorie (repli sur `default`). */
export function getAttributeSchema(category: string): AttributeSpec[] {
  return ATTRIBUTE_SCHEMA[category] ?? ATTRIBUTE_SCHEMA.default;
}
