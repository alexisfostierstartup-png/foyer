export const ORDER_STORAGE_KEY = "foyer-demo-order";

export type DemoSource = "secondhand" | "eco_new";

export type DemoProductKind =
  | "sofa"
  | "table"
  | "rug"
  | "lamp"
  | "armchair"
  | "paint"
  | "tvstand"
  | "molding"
  | "floor";

export type ProductOption = {
  merchant: string;
  price: string;
  source: DemoSource;
  url?: string;
};

export type DemoProduct = {
  id: number;
  name: string;
  source: DemoSource;
  merchant: string;
  price: string;
  img: string;
  kind: DemoProductKind;
  alternatives: ProductOption[];
};

export const demoProducts: DemoProduct[] = [
  {
    id: 1,
    name: "Canapé 3 places en lin écru",
    source: "secondhand",
    merchant: "Selency",
    price: "320 €",
    img: "/demo/products/sofa.jpg",
    kind: "sofa",
    alternatives: [
      { merchant: "Maisons du Monde", price: "599 €", source: "eco_new" },
      {
        merchant: "IKEA",
        price: "589 €",
        source: "eco_new",
        url: "https://www.ikea.com/fr/fr/p/hyltarp-canape-2-places-hallarp-blanc-s49489616/",
      },
      { merchant: "Leboncoin", price: "250 €", source: "secondhand" },
    ],
  },
  {
    id: 2,
    name: "Table basse ronde chêne clair",
    source: "secondhand",
    merchant: "Leboncoin",
    price: "75 €",
    img: "/demo/products/table.jpg",
    kind: "table",
    alternatives: [
      { merchant: "La Redoute", price: "149 €", source: "eco_new" },
      { merchant: "IKEA", price: "89 €", source: "eco_new" },
      { merchant: "Selency", price: "110 €", source: "secondhand" },
    ],
  },
  {
    id: 3,
    name: "Tapis jute rond 160 cm",
    source: "eco_new",
    merchant: "La Redoute",
    price: "89 €",
    img: "/demo/products/rug.jpg",
    kind: "rug",
    alternatives: [
      { merchant: "Maisons du Monde", price: "119 €", source: "eco_new" },
      { merchant: "IKEA", price: "69 €", source: "eco_new" },
      { merchant: "Leboncoin", price: "40 €", source: "secondhand" },
    ],
  },
  {
    id: 4,
    name: "Lampadaire trépied bois & lin",
    source: "eco_new",
    merchant: "Maisons du Monde",
    price: "69 €",
    img: "/demo/products/lamp.jpg",
    kind: "lamp",
    alternatives: [
      { merchant: "La Redoute", price: "89 €", source: "eco_new" },
      { merchant: "IKEA", price: "49 €", source: "eco_new" },
      { merchant: "Selency", price: "60 €", source: "secondhand" },
    ],
  },
  {
    id: 5,
    name: "Fauteuil en lin sable",
    source: "secondhand",
    merchant: "Selency",
    price: "180 €",
    img: "/demo/products/armchair.jpg",
    kind: "armchair",
    alternatives: [
      { merchant: "Maisons du Monde", price: "299 €", source: "eco_new" },
      { merchant: "IKEA", price: "199 €", source: "eco_new" },
      { merchant: "Leboncoin", price: "140 €", source: "secondhand" },
    ],
  },
  {
    id: 6,
    name: "Peinture mate blanc cassé (2,5 L)",
    source: "eco_new",
    merchant: "Leroy Merlin",
    price: "34 €",
    img: "/demo/products/paint.jpg",
    kind: "paint",
    alternatives: [
      { merchant: "Castorama", price: "29 €", source: "eco_new" },
      { merchant: "ManoMano", price: "32 €", source: "eco_new" },
      { merchant: "Leroy Merlin", price: "34 €", source: "eco_new" },
    ],
  },
  {
    id: 7,
    name: "Meuble TV bois clair",
    source: "eco_new",
    merchant: "La Redoute",
    price: "159 €",
    img: "/demo/products/tvstand.jpg",
    kind: "tvstand",
    alternatives: [
      { merchant: "Maisons du Monde", price: "199 €", source: "eco_new" },
      { merchant: "IKEA", price: "129 €", source: "eco_new" },
      { merchant: "Leboncoin", price: "80 €", source: "secondhand" },
    ],
  },
  {
    id: 8,
    name: "Moulures décoratives MDF",
    source: "eco_new",
    merchant: "Leroy Merlin",
    price: "45 €",
    img: "/demo/products/molding.jpg",
    kind: "molding",
    alternatives: [
      { merchant: "Castorama", price: "39 €", source: "eco_new" },
      { merchant: "ManoMano", price: "42 €", source: "eco_new" },
      { merchant: "Leroy Merlin", price: "45 €", source: "eco_new" },
    ],
  },
  {
    id: 9,
    name: "Parquet stratifié chêne clair",
    source: "eco_new",
    merchant: "Leroy Merlin",
    price: "240 €",
    img: "/demo/products/floor.jpg",
    kind: "floor",
    alternatives: [
      { merchant: "Castorama", price: "199 €", source: "eco_new" },
      { merchant: "ManoMano", price: "220 €", source: "eco_new" },
      { merchant: "Leroy Merlin", price: "240 €", source: "eco_new" },
    ],
  },
];

export const SOURCE_META: Record<
  DemoSource,
  { label: string; dotClass: string; badgeClass: string }
> = {
  secondhand: {
    label: "Seconde main",
    dotClass: "bg-foyer-sage",
    badgeClass: "bg-foyer-sage/15 text-foyer-sage",
  },
  eco_new: {
    label: "Neuf éco",
    dotClass: "bg-foyer-water",
    badgeClass: "bg-foyer-water/20 text-foyer-ink",
  },
};
