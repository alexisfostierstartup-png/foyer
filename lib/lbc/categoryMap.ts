// Mapping catégories Foyer → catégories Leboncoin
export const FOYER_TO_LBC_CATEGORY: Record<string, string> = {
  sofa: "canapes_sieges",
  armchair: "canapes_sieges",
  coffee_table: "tables_basses",
  side_table: "tables_basses",
  rug: "tapis",
  lamp: "luminaires_eclairage",
  floor_lamp: "luminaires_eclairage",
  tv_stand: "meubles_tv_hifi",
  bookshelf: "bibliotheques_etageres",
  bed: "lits",
  nightstand: "tables_de_chevet",
  dresser: "commodes",
  curtains: "rideaux",
  cushion: "decoration_interieure",
  plant: "plantes",
  paint: "peinture_traitement",
  mouldings: "materiaux_construction",
  floor_material: "parquet_carrelage",
  other: "decoration_interieure",
};

// Mots-clés de style pour enrichir la requête LBC (amendment α-11/2)
export const STYLE_KEYWORDS: Record<string, string[]> = {
  doux: ["naturel", "lin", "coton", "doux", "pastel", "beige"],
  brut: ["industriel", "béton", "métal", "noir", "brut", "loft"],
  "bois-clair": ["scandinave", "chêne", "bois clair", "nordique", "hêtre"],
  vintage: ["vintage", "retro", "années 60", "années 70", "mid-century", "pieds compas"],
  mediterraneen: ["méditerranéen", "provençal", "carreaux", "mosaïque", "terre cuite"],
  bohemian: ["boho", "bohème", "rotin", "macramé", "naturel", "raphia"],
};

export function getLbcCategory(foyerCategory: string): string {
  return FOYER_TO_LBC_CATEGORY[foyerCategory] ?? "decoration_interieure";
}

export function getStyleKeywords(styleId: string | null): string[] {
  if (!styleId) return [];
  return STYLE_KEYWORDS[styleId] ?? [];
}
