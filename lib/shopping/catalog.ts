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

// Catalogue mocké en dur RETIRÉ (héritage Wizard-of-Oz, plus utilisé) : les vrais
// produits viennent du catalogue partenaire (partner_products) via lib/shopping/partnerMatch.ts.
// Le type CatalogCategory/CatalogProduct reste utilisé (taxonomie, signatures).
export const CATALOG: CatalogProduct[] = [];
