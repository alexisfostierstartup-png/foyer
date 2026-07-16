/**
 * v4 — "Shop the room" — données produits, partenaires, offres, FAQ.
 * Les 5 produits pointent tous vers la même photo (/landing/v2/after-living.jpg),
 * recadrée différemment par item (voir `crop`/`cropAlt`) : on n'a pas de vraies
 * photos produit isolées, donc on triche proprement en zoomant/recadrant la
 * même photo de salon — cohérent avec les hotspots posés sur cette même image.
 */

export type Condition = "conserve" | "occasion" | "neuf";

export type Crop = { x: number; y: number; zoom: number };

export type ShopProduct = {
  id: string;
  name: string;
  detail: string;
  merchant: string;
  condition: Condition;
  /** null = déjà en possession du client, pas d'achat. */
  price: number | null;
  /** Position du point cliquable sur la photo hero, en % (left/top). */
  hotspot: { x: number; y: number };
  /** Recadrage "produit" par défaut. */
  crop: Crop;
  /** Recadrage alternatif affiché au hover/tap sur la tuile (effet swap). */
  cropAlt: Crop;
};

export const HERO_IMAGE = "/landing/v2/after-living.jpg";

export const PRODUCTS: ShopProduct[] = [
  {
    id: "bibliotheque",
    name: "Bibliothèque vintage",
    detail: "Conservée, repeinte sage",
    merchant: "Déjà chez vous",
    condition: "conserve",
    price: null,
    hotspot: { x: 8, y: 33 },
    crop: { x: 7, y: 32, zoom: 2.05 },
    cropAlt: { x: 11, y: 48, zoom: 2.5 },
  },
  {
    id: "canape",
    name: "Canapé en lin écru",
    detail: "Angle droit, housse lavable",
    merchant: "Selency",
    condition: "occasion",
    price: 320,
    hotspot: { x: 44, y: 59 },
    crop: { x: 45, y: 55, zoom: 1.85 },
    cropAlt: { x: 60, y: 60, zoom: 2.2 },
  },
  {
    id: "table-basse",
    name: "Table basse verre & métal",
    detail: "Plateau verre, structure noire",
    merchant: "Leboncoin",
    condition: "occasion",
    price: 75,
    hotspot: { x: 54, y: 73 },
    crop: { x: 55, y: 70, zoom: 2.45 },
    cropAlt: { x: 58, y: 79, zoom: 2.9 },
  },
  {
    id: "olivier",
    name: "Plante d'intérieur",
    detail: "Pot terre cuite, 120 cm",
    merchant: "Pépinière locale",
    condition: "neuf",
    price: 59,
    hotspot: { x: 61, y: 40 },
    crop: { x: 62, y: 36, zoom: 2.0 },
    cropAlt: { x: 66, y: 50, zoom: 2.3 },
  },
  {
    id: "lampadaire",
    name: "Lampadaire arqué",
    detail: "Abat-jour lin, base marbre",
    merchant: "Maisons du Monde",
    condition: "neuf",
    price: 169,
    hotspot: { x: 84, y: 34 },
    crop: { x: 85, y: 30, zoom: 2.0 },
    cropAlt: { x: 89, y: 44, zoom: 2.35 },
  },
];

export const PURCHASABLE = PRODUCTS.filter((p) => p.price !== null);
export const PROJECT_TOTAL = PURCHASABLE.reduce((sum, p) => sum + (p.price ?? 0), 0);

export const CONDITION_LABEL: Record<Condition, string> = {
  conserve: "CONSERVÉ",
  occasion: "OCCASION",
  neuf: "EN STOCK",
};

export const PARTNERS: { name: string; delivery: string }[] = [
  { name: "Selency", delivery: "livraison 5-8 j" },
  { name: "Emmaüs", delivery: "retrait local" },
  { name: "Maisons du Monde", delivery: "livraison 3-6 j" },
  { name: "La Redoute Intérieurs", delivery: "livraison 4-7 j" },
  { name: "Tikamoon", delivery: "livraison 6-10 j" },
  { name: "AM.PM", delivery: "livraison 5-9 j" },
  { name: "Made.com", delivery: "livraison 7-12 j" },
  { name: "Bobochic", delivery: "livraison 3-5 j" },
];

export const PLANS: {
  name: string;
  price: string;
  period: string;
  features: string[];
  highlight: boolean;
}[] = [
  {
    name: "Découverte",
    price: "0 €",
    period: "1er projet",
    features: ["1 rendu complet", "Liste sourcée incluse", "Sans carte bancaire"],
    highlight: false,
  },
  {
    name: "Héra",
    price: "29 €",
    period: "par projet",
    features: [
      "Rendus illimités sur le projet",
      "Sourcing seconde main prioritaire",
      "Panier groupé par enseigne",
      "Bilan carbone ADEME",
    ],
    highlight: true,
  },
  {
    name: "Studio Pro",
    price: "Sur devis",
    period: "B2B",
    features: ["Volumes agences & pros", "API & exports", "Accompagnement dédié"],
    highlight: false,
  },
];

export const FAQS: { q: string; a: string }[] = [
  {
    q: "Les prix affichés sont-ils réels ?",
    a: "Oui. Chaque prix vient du catalogue de nos partenaires au moment du rendu — pas d'estimation approximative. Le tarif exact est confirmé au moment de l'achat, chez l'enseigne.",
  },
  {
    q: "Je peux garder mes meubles ?",
    a: "C'est même la priorité. Foyer part toujours de ce que vous avez déjà — gardé, parfois relooké — avant de proposer de la seconde main, puis du neuf choisi pour durer.",
  },
  {
    q: "Combien coûte un projet ?",
    a: "Le premier rendu est offert. Ensuite, 29 € par projet complet, sans abonnement : vous ne payez que ce que vous utilisez.",
  },
  {
    q: "Vous livrez directement ?",
    a: "Non. Foyer construit des paniers groupés par enseigne avec les liens directs. Vous achetez et êtes livrés par chaque partenaire, comme d'habitude.",
  },
  {
    q: "Que devient ma photo ?",
    a: "Elle reste confidentielle et ne sert jamais à entraîner un modèle. Vous pouvez supprimer votre compte et vos données à tout moment.",
  },
];
