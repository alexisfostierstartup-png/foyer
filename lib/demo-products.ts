export type DemoSource = "secondhand" | "eco_new";

export type DemoProductKind =
  | "sofa"
  | "table"
  | "rug"
  | "lamp"
  | "armchair"
  | "paint"
  | "tvstand";

export type DemoProduct = {
  id: number;
  name: string;
  source: DemoSource;
  merchant: string;
  price: string;
  img: string;
  kind: DemoProductKind;
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
  },
  {
    id: 2,
    name: "Table basse ronde chêne clair",
    source: "secondhand",
    merchant: "Leboncoin",
    price: "75 €",
    img: "/demo/products/table.jpg",
    kind: "table",
  },
  {
    id: 3,
    name: "Tapis jute rond 160 cm",
    source: "eco_new",
    merchant: "La Redoute",
    price: "89 €",
    img: "/demo/products/rug.jpg",
    kind: "rug",
  },
  {
    id: 4,
    name: "Lampadaire trépied bois & lin",
    source: "eco_new",
    merchant: "Maisons du Monde",
    price: "69 €",
    img: "/demo/products/lamp.jpg",
    kind: "lamp",
  },
  {
    id: 5,
    name: "Fauteuil en lin sable",
    source: "secondhand",
    merchant: "Selency",
    price: "180 €",
    img: "/demo/products/armchair.jpg",
    kind: "armchair",
  },
  {
    id: 6,
    name: "Peinture mate blanc cassé (2,5 L)",
    source: "eco_new",
    merchant: "Leroy Merlin",
    price: "34 €",
    img: "/demo/products/paint.jpg",
    kind: "paint",
  },
  {
    id: 7,
    name: "Meuble TV bois clair",
    source: "eco_new",
    merchant: "La Redoute",
    price: "159 €",
    img: "/demo/products/tvstand.jpg",
    kind: "tvstand",
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
