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

// Mots-clés de style pour enrichir la requête LBC (amendment α-11/2).
// Slugs alignés sur data/styles.json ; les anciens slugs v0 restent en repli
// pour les projets créés avant le set canonique.
export const STYLE_KEYWORDS: Record<string, string[]> = {
  scandinave: ["scandinave", "nordique", "chêne clair", "bois clair", "hêtre", "laine"],
  japandi: ["japandi", "noyer", "cannage", "travertin", "zen", "épuré"],
  boheme: ["bohème", "rotin", "jute", "terracotta", "macramé", "raphia"],
  boho: ["boho", "rotin", "bouclette", "travertin", "plante", "osier"],
  "mid-century": ["vintage", "mid-century", "années 60", "pieds compas", "teck", "noyer"],
  industriel: ["industriel", "loft", "métal noir", "acier", "cuir camel", "bois recyclé"],
  mediterraneen: ["méditerranéen", "provençal", "terre cuite", "zellige", "osier", "azulejos"],
  haussmannien: ["haussmannien", "moulures", "marbre", "velours", "doré", "chevron"],
  "wabi-sabi": ["wabi sabi", "lin", "bois brut", "grès", "artisanal", "chaux"],
  "quiet-luxury": ["bouclette", "laiton", "verre fumé", "travertin", "cuir", "design"],
  "art-deco": ["art déco", "velours", "laiton", "marbre noir", "cannelé", "émeraude"],
  "cottage-anglais": ["anglais", "fleuri", "chintz", "acajou", "campagne", "ancien"],
  "dark-academia": ["chesterfield", "cuir cognac", "bibliothèque", "acajou", "ancien", "capitonné"],
  desert: ["terre cuite", "kilim", "cactus", "poterie", "adobe", "artisanal"],
  seventies: ["années 70", "velours côtelé", "chrome", "space age", "orange", "modulable"],
  "color-block": ["coloré", "velours", "arche", "design", "pop", "graphique"],
  memphis: ["memphis", "terrazzo", "années 80", "postmoderne", "pop", "coloré"],
  maximaliste: ["velours", "chesterfield", "persan", "baroque", "coloré", "éclectique"],
  // Slugs legacy v0 (anciens projets)
  doux: ["naturel", "lin", "coton", "doux", "pastel", "beige"],
  brut: ["industriel", "béton", "métal", "noir", "brut", "loft"],
  "bois-clair": ["scandinave", "chêne", "bois clair", "nordique", "hêtre"],
  vintage: ["vintage", "retro", "années 60", "années 70", "mid-century", "pieds compas"],
  bohemian: ["boho", "bohème", "rotin", "macramé", "naturel", "raphia"],
};

export function getLbcCategory(foyerCategory: string): string {
  return FOYER_TO_LBC_CATEGORY[foyerCategory] ?? "decoration_interieure";
}

export function getStyleKeywords(styleId: string | null): string[] {
  if (!styleId) return [];
  return STYLE_KEYWORDS[styleId] ?? [];
}
