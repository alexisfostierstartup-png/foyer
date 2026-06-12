export type CatalogCategory =
  | "sofa"
  | "armchair"
  | "coffee_table"
  | "side_table"
  | "rug"
  | "lamp"
  | "floor_lamp"
  | "tv_stand"
  | "bookshelf"
  | "bed"
  | "nightstand"
  | "dresser"
  | "curtains"
  | "cushion"
  | "plant"
  | "paint"
  | "mouldings"
  | "floor_material"
  | "other";

export type StyleAffinity =
  | "doux"
  | "brut"
  | "bois-clair"
  | "vintage"
  | "mediterraneen"
  | "bohemian";

export type CatalogSource = "secondhand" | "eco_new";

export type CatalogProduct = {
  id: string;
  name: string;
  category: CatalogCategory;
  styleAffinity: StyleAffinity[];
  source: CatalogSource;
  merchant: string;
  price: number;
  imgUrl: string;
  productUrl: string;
};

export const CATALOG: CatalogProduct[] = [
  // ── Sofas ───────────────────────────────────────────────────────────────────
  {
    id: "sofa-doux-1",
    name: "Canapé 3 places lin écru",
    category: "sofa",
    styleAffinity: ["doux", "bois-clair"],
    source: "secondhand",
    merchant: "Selency",
    price: 320,
    imgUrl: "/catalog/sofa-doux-1.jpg",
    productUrl: "#",
  },
  {
    id: "sofa-vintage-1",
    name: "Canapé velours moutarde mid-century",
    category: "sofa",
    styleAffinity: ["vintage"],
    source: "secondhand",
    merchant: "Selency",
    price: 450,
    imgUrl: "/catalog/sofa-vintage-1.jpg",
    productUrl: "#",
  },
  {
    id: "sofa-brut-1",
    name: "Canapé modulable gris anthracite",
    category: "sofa",
    styleAffinity: ["brut"],
    source: "eco_new",
    merchant: "IKEA",
    price: 599,
    imgUrl: "/catalog/sofa-brut-1.jpg",
    productUrl: "#",
  },
  {
    id: "sofa-bohemian-1",
    name: "Canapé boho coton naturel",
    category: "sofa",
    styleAffinity: ["bohemian", "mediterraneen"],
    source: "secondhand",
    merchant: "Leboncoin",
    price: 280,
    imgUrl: "/catalog/sofa-bohemian-1.jpg",
    productUrl: "#",
  },
  {
    id: "sofa-bois-clair-1",
    name: "Canapé scandinave pieds chêne clair",
    category: "sofa",
    styleAffinity: ["bois-clair", "doux"],
    source: "eco_new",
    merchant: "La Redoute",
    price: 489,
    imgUrl: "/catalog/sofa-bois-clair-1.jpg",
    productUrl: "#",
  },

  // ── Armchairs ────────────────────────────────────────────────────────────────
  {
    id: "armchair-doux-1",
    name: "Fauteuil lin sable avec coussin",
    category: "armchair",
    styleAffinity: ["doux", "bois-clair"],
    source: "secondhand",
    merchant: "Selency",
    price: 180,
    imgUrl: "/catalog/armchair-doux-1.jpg",
    productUrl: "#",
  },
  {
    id: "armchair-vintage-1",
    name: "Fauteuil egg velours vert bouteille",
    category: "armchair",
    styleAffinity: ["vintage"],
    source: "secondhand",
    merchant: "Selency",
    price: 320,
    imgUrl: "/catalog/armchair-vintage-1.jpg",
    productUrl: "#",
  },
  {
    id: "armchair-brut-1",
    name: "Fauteuil cuir naturel tanné",
    category: "armchair",
    styleAffinity: ["brut"],
    source: "eco_new",
    merchant: "Maisons du Monde",
    price: 299,
    imgUrl: "/catalog/armchair-brut-1.jpg",
    productUrl: "#",
  },
  {
    id: "armchair-bohemian-1",
    name: "Fauteuil rotin macramé naturel",
    category: "armchair",
    styleAffinity: ["bohemian", "mediterraneen", "doux"],
    source: "eco_new",
    merchant: "La Redoute",
    price: 189,
    imgUrl: "/catalog/armchair-bohemian-1.jpg",
    productUrl: "#",
  },

  // ── Coffee tables ─────────────────────────────────────────────────────────────
  {
    id: "coffee-table-doux-1",
    name: "Table basse ronde chêne massif",
    category: "coffee_table",
    styleAffinity: ["doux", "bois-clair"],
    source: "secondhand",
    merchant: "Leboncoin",
    price: 75,
    imgUrl: "/catalog/coffee-table-doux-1.jpg",
    productUrl: "#",
  },
  {
    id: "coffee-table-vintage-1",
    name: "Table basse tripode laiton verre",
    category: "coffee_table",
    styleAffinity: ["vintage"],
    source: "secondhand",
    merchant: "Selency",
    price: 145,
    imgUrl: "/catalog/coffee-table-vintage-1.jpg",
    productUrl: "#",
  },
  {
    id: "coffee-table-brut-1",
    name: "Table basse béton-bois industrielle",
    category: "coffee_table",
    styleAffinity: ["brut"],
    source: "eco_new",
    merchant: "But",
    price: 189,
    imgUrl: "/catalog/coffee-table-brut-1.jpg",
    productUrl: "#",
  },
  {
    id: "coffee-table-bohemian-1",
    name: "Table basse mosaïque carreaux bleus",
    category: "coffee_table",
    styleAffinity: ["bohemian", "mediterraneen"],
    source: "eco_new",
    merchant: "Maisons du Monde",
    price: 129,
    imgUrl: "/catalog/coffee-table-bohemian-1.jpg",
    productUrl: "#",
  },

  // ── Rugs ─────────────────────────────────────────────────────────────────────
  {
    id: "rug-doux-1",
    name: "Tapis jute tressé naturel 160cm",
    category: "rug",
    styleAffinity: ["doux", "bois-clair"],
    source: "eco_new",
    merchant: "La Redoute",
    price: 89,
    imgUrl: "/catalog/rug-doux-1.jpg",
    productUrl: "#",
  },
  {
    id: "rug-vintage-1",
    name: "Kilim berbère vintage 200×140",
    category: "rug",
    styleAffinity: ["vintage", "bohemian", "mediterraneen"],
    source: "secondhand",
    merchant: "Vinted",
    price: 220,
    imgUrl: "/catalog/rug-vintage-1.jpg",
    productUrl: "#",
  },
  {
    id: "rug-brut-1",
    name: "Tapis laine graphique noir-blanc",
    category: "rug",
    styleAffinity: ["brut"],
    source: "eco_new",
    merchant: "IKEA",
    price: 79,
    imgUrl: "/catalog/rug-brut-1.jpg",
    productUrl: "#",
  },
  {
    id: "rug-bois-clair-1",
    name: "Tapis coton naturel franges 180cm",
    category: "rug",
    styleAffinity: ["bois-clair", "doux", "bohemian"],
    source: "eco_new",
    merchant: "Maisons du Monde",
    price: 99,
    imgUrl: "/catalog/rug-bois-clair-1.jpg",
    productUrl: "#",
  },

  // ── Lamps ─────────────────────────────────────────────────────────────────────
  {
    id: "lamp-doux-1",
    name: "Suspension rotin tressé naturel",
    category: "lamp",
    styleAffinity: ["doux", "bohemian", "bois-clair"],
    source: "eco_new",
    merchant: "Maisons du Monde",
    price: 69,
    imgUrl: "/catalog/lamp-doux-1.jpg",
    productUrl: "#",
  },
  {
    id: "lamp-vintage-1",
    name: "Lampe de table articulée métal vintage",
    category: "lamp",
    styleAffinity: ["vintage", "brut"],
    source: "secondhand",
    merchant: "Selency",
    price: 95,
    imgUrl: "/catalog/lamp-vintage-1.jpg",
    productUrl: "#",
  },
  {
    id: "lamp-brut-1",
    name: "Suspension industrielle métal noir",
    category: "lamp",
    styleAffinity: ["brut"],
    source: "eco_new",
    merchant: "IKEA",
    price: 49,
    imgUrl: "/catalog/lamp-brut-1.jpg",
    productUrl: "#",
  },
  {
    id: "lamp-bois-clair-1",
    name: "Suspension bambou tressé blanc",
    category: "lamp",
    styleAffinity: ["bois-clair", "doux"],
    source: "eco_new",
    merchant: "La Redoute",
    price: 59,
    imgUrl: "/catalog/lamp-bois-clair-1.jpg",
    productUrl: "#",
  },

  // ── Floor lamps ───────────────────────────────────────────────────────────────
  {
    id: "floor-lamp-doux-1",
    name: "Lampadaire trépied bois abat-jour lin",
    category: "floor_lamp",
    styleAffinity: ["doux", "bois-clair"],
    source: "eco_new",
    merchant: "Maisons du Monde",
    price: 79,
    imgUrl: "/catalog/floor-lamp-doux-1.jpg",
    productUrl: "#",
  },
  {
    id: "floor-lamp-vintage-1",
    name: "Lampadaire arc métal doré vintage",
    category: "floor_lamp",
    styleAffinity: ["vintage"],
    source: "secondhand",
    merchant: "Leboncoin",
    price: 120,
    imgUrl: "/catalog/floor-lamp-vintage-1.jpg",
    productUrl: "#",
  },
  {
    id: "floor-lamp-brut-1",
    name: "Lampadaire industriel noir mat",
    category: "floor_lamp",
    styleAffinity: ["brut"],
    source: "eco_new",
    merchant: "IKEA",
    price: 69,
    imgUrl: "/catalog/floor-lamp-brut-1.jpg",
    productUrl: "#",
  },

  // ── TV stands ─────────────────────────────────────────────────────────────────
  {
    id: "tv-stand-doux-1",
    name: "Meuble TV bois clair scandinave 150cm",
    category: "tv_stand",
    styleAffinity: ["doux", "bois-clair"],
    source: "eco_new",
    merchant: "La Redoute",
    price: 159,
    imgUrl: "/catalog/tv-stand-doux-1.jpg",
    productUrl: "#",
  },
  {
    id: "tv-stand-vintage-1",
    name: "Bahut pieds compas vintage années 60",
    category: "tv_stand",
    styleAffinity: ["vintage"],
    source: "secondhand",
    merchant: "Selency",
    price: 285,
    imgUrl: "/catalog/tv-stand-vintage-1.jpg",
    productUrl: "#",
  },
  {
    id: "tv-stand-brut-1",
    name: "Meuble TV béton-métal open shelf",
    category: "tv_stand",
    styleAffinity: ["brut"],
    source: "eco_new",
    merchant: "But",
    price: 229,
    imgUrl: "/catalog/tv-stand-brut-1.jpg",
    productUrl: "#",
  },

  // ── Bookshelves ───────────────────────────────────────────────────────────────
  {
    id: "bookshelf-doux-1",
    name: "Étagère chêne massif 5 niveaux",
    category: "bookshelf",
    styleAffinity: ["doux", "bois-clair"],
    source: "eco_new",
    merchant: "IKEA",
    price: 89,
    imgUrl: "/catalog/bookshelf-doux-1.jpg",
    productUrl: "#",
  },
  {
    id: "bookshelf-vintage-1",
    name: "Bibliothèque échelle métal-bois",
    category: "bookshelf",
    styleAffinity: ["vintage", "brut"],
    source: "secondhand",
    merchant: "Leboncoin",
    price: 95,
    imgUrl: "/catalog/bookshelf-vintage-1.jpg",
    productUrl: "#",
  },
  {
    id: "bookshelf-bohemian-1",
    name: "Étagère rotin bambou courbe",
    category: "bookshelf",
    styleAffinity: ["bohemian", "mediterraneen", "doux"],
    source: "eco_new",
    merchant: "Maisons du Monde",
    price: 119,
    imgUrl: "/catalog/bookshelf-bohemian-1.jpg",
    productUrl: "#",
  },

  // ── Beds ─────────────────────────────────────────────────────────────────────
  {
    id: "bed-doux-1",
    name: "Lit plateforme chêne huilé 160×200",
    category: "bed",
    styleAffinity: ["doux", "bois-clair"],
    source: "eco_new",
    merchant: "La Redoute",
    price: 449,
    imgUrl: "/catalog/bed-doux-1.jpg",
    productUrl: "#",
  },
  {
    id: "bed-vintage-1",
    name: "Lit fer forgé vintage patiné",
    category: "bed",
    styleAffinity: ["vintage"],
    source: "secondhand",
    merchant: "Selency",
    price: 320,
    imgUrl: "/catalog/bed-vintage-1.jpg",
    productUrl: "#",
  },
  {
    id: "bed-brut-1",
    name: "Lit structure métal noir mat 160cm",
    category: "bed",
    styleAffinity: ["brut"],
    source: "eco_new",
    merchant: "But",
    price: 349,
    imgUrl: "/catalog/bed-brut-1.jpg",
    productUrl: "#",
  },

  // ── Nightstands ───────────────────────────────────────────────────────────────
  {
    id: "nightstand-doux-1",
    name: "Chevet rotin naturel tiroir",
    category: "nightstand",
    styleAffinity: ["doux", "bohemian"],
    source: "eco_new",
    merchant: "Maisons du Monde",
    price: 89,
    imgUrl: "/catalog/nightstand-doux-1.jpg",
    productUrl: "#",
  },
  {
    id: "nightstand-vintage-1",
    name: "Table de nuit métal industriel patine",
    category: "nightstand",
    styleAffinity: ["vintage", "brut"],
    source: "secondhand",
    merchant: "Leboncoin",
    price: 55,
    imgUrl: "/catalog/nightstand-vintage-1.jpg",
    productUrl: "#",
  },

  // ── Paint ─────────────────────────────────────────────────────────────────────
  {
    id: "paint-blanc-1",
    name: "Peinture mate blanc cassé 2.5L",
    category: "paint",
    styleAffinity: ["doux", "bois-clair", "vintage", "brut", "bohemian", "mediterraneen"],
    source: "eco_new",
    merchant: "Leroy Merlin",
    price: 34,
    imgUrl: "/catalog/paint-blanc-1.jpg",
    productUrl: "#",
  },
  {
    id: "paint-brut-1",
    name: "Peinture effet béton ciré gris perle 2L",
    category: "paint",
    styleAffinity: ["brut"],
    source: "eco_new",
    merchant: "Castorama",
    price: 45,
    imgUrl: "/catalog/paint-brut-1.jpg",
    productUrl: "#",
  },
  {
    id: "paint-sage-1",
    name: "Peinture mate vert sauge 2.5L",
    category: "paint",
    styleAffinity: ["doux", "bois-clair", "bohemian", "mediterraneen"],
    source: "eco_new",
    merchant: "ManoMano",
    price: 38,
    imgUrl: "/catalog/paint-sage-1.jpg",
    productUrl: "#",
  },

  // ── Mouldings ────────────────────────────────────────────────────────────────
  {
    id: "mouldings-1",
    name: "Moulures décoratives MDF 70mm — 10m",
    category: "mouldings",
    styleAffinity: ["doux", "vintage", "bois-clair", "brut", "bohemian", "mediterraneen"],
    source: "eco_new",
    merchant: "Leroy Merlin",
    price: 45,
    imgUrl: "/catalog/mouldings-1.jpg",
    productUrl: "#",
  },
  {
    id: "mouldings-large-1",
    name: "Grandes plinthes bois 120mm — 8m",
    category: "mouldings",
    styleAffinity: ["doux", "vintage", "bois-clair", "brut", "bohemian", "mediterraneen"],
    source: "eco_new",
    merchant: "Castorama",
    price: 65,
    imgUrl: "/catalog/mouldings-large-1.jpg",
    productUrl: "#",
  },

  // ── Curtains ─────────────────────────────────────────────────────────────────
  {
    id: "curtains-doux-1",
    name: "Rideaux lin naturel lavé (2 panneaux)",
    category: "curtains",
    styleAffinity: ["doux", "bois-clair", "bohemian"],
    source: "eco_new",
    merchant: "La Redoute",
    price: 79,
    imgUrl: "/catalog/curtains-doux-1.jpg",
    productUrl: "#",
  },
  {
    id: "curtains-brut-1",
    name: "Rideaux velours graphite (2 panneaux)",
    category: "curtains",
    styleAffinity: ["brut", "vintage"],
    source: "eco_new",
    merchant: "Maisons du Monde",
    price: 89,
    imgUrl: "/catalog/curtains-brut-1.jpg",
    productUrl: "#",
  },

  // ── Cushions ─────────────────────────────────────────────────────────────────
  {
    id: "cushion-doux-1",
    name: "Lot 2 coussins lin brodés naturel",
    category: "cushion",
    styleAffinity: ["doux", "bois-clair", "bohemian"],
    source: "eco_new",
    merchant: "Maisons du Monde",
    price: 45,
    imgUrl: "/catalog/cushion-doux-1.jpg",
    productUrl: "#",
  },

  // ── Plants ───────────────────────────────────────────────────────────────────
  {
    id: "plant-1",
    name: "Monstera + pot céramique blanc",
    category: "plant",
    styleAffinity: ["doux", "bois-clair", "vintage", "brut", "bohemian", "mediterraneen"],
    source: "eco_new",
    merchant: "Jardineries Truffaut",
    price: 29,
    imgUrl: "/catalog/plant-1.jpg",
    productUrl: "#",
  },

  // ── Floor materials ───────────────────────────────────────────────────────────
  {
    id: "floor-parquet-1",
    name: "Parquet stratifié chêne huilé 8mm — 10m²",
    category: "floor_material",
    styleAffinity: ["doux", "bois-clair", "vintage"],
    source: "eco_new",
    merchant: "Leroy Merlin",
    price: 240,
    imgUrl: "/catalog/floor-parquet-1.jpg",
    productUrl: "#",
  },
  {
    id: "floor-carrelage-1",
    name: "Carreaux de ciment 20×20 bleu — 10m²",
    category: "floor_material",
    styleAffinity: ["mediterraneen", "bohemian", "brut"],
    source: "eco_new",
    merchant: "Castorama",
    price: 180,
    imgUrl: "/catalog/floor-carrelage-1.jpg",
    productUrl: "#",
  },
];
