// Foyer — mock data
const MOCK = {
  heroPair: {
    before: "assets/before-living.jpg",
    after:  "assets/after-living.jpg",
  },

  ambiances: [
    { id: "doux",     name: "Doux",          desc: "Lumière tamisée, matériaux naturels",
      colors: ["#EFE2C9", "#A5B8A0", "#C0664A"] },
    { id: "brut",     name: "Brut",          desc: "Métal, bois foncé, contrastes",
      colors: ["#3A2F22", "#7A6B54", "#C0664A"] },
    { id: "bois",     name: "Bois clair",    desc: "Chêne blanc, ton sur ton",
      colors: ["#E9DCC1", "#B1885A", "#86996F"] },
    { id: "vintage",  name: "Vintage",       desc: "Mid-century, couleurs saturées",
      colors: ["#B58455", "#5A4631", "#C89B6A"] },
    { id: "medit",    name: "Méditerranéen", desc: "Blanc cassé, terre cuite, lin",
      colors: ["#F3EBDC", "#C0664A", "#A5B8A0"] },
    { id: "boho",     name: "Bohemian",      desc: "Rotin, ocre, motifs",
      colors: ["#C89B6A", "#A5B8A0", "#A85638"] },
  ],

  detectedFurniture: [
    { id: "biblio",  name: "Bibliothèque en bois foncé", thumb: "📚", defaultAction: "custom" },
    { id: "canape",  name: "Canapé écru",                thumb: "🛋️", defaultAction: "custom" },
    { id: "fauteuil",name: "Fauteuil club",              thumb: "🪑", defaultAction: "keep" },
    { id: "table",   name: "Table basse",                thumb: "🪵", defaultAction: "replace" },
    { id: "tapis",   name: "Tapis persan",               thumb: "▭",  defaultAction: "replace" },
    { id: "lampe",   name: "Lampe d'appoint",            thumb: "💡", defaultAction: "replace" },
  ],

  projectStats: {
    kept: 60,
    secondHand: 15,
    newDurable: 25,
    co2Saved: 42,
  },

  cart: [
    {
      partner: "Bemz",
      partnerTag: "Housses canapé sur mesure",
      items: [
        { label: "Housse canapé lin oat", price: 340, meta: "Sur mesure · 3 coussins inclus" },
      ],
      delivery: "Livraison estimée : 2-3 semaines",
      cta: "Vérifier le panier",
    },
    {
      partner: "Selency",
      partnerTag: "Mobilier vintage",
      items: [
        { label: "Table d'appoint rotin années 70", price: 65, meta: "Vendeur à Lyon · retrait possible" },
      ],
      delivery: "Disponible à 5 km de chez vous",
      cta: "Vérifier l'annonce",
    },
    {
      partner: "Leroy Merlin",
      partnerTag: "Matériaux & peinture",
      items: [
        { label: "Pot peinture vert d'eau 1L", price: 28, meta: "Mat · pour bois et MDF" },
      ],
      delivery: "Retrait magasin · livraison 48h",
      cta: "Vérifier le panier",
    },
    {
      partner: "La Redoute Intérieurs",
      partnerTag: "Mobilier durable",
      items: [
        { label: "Lampe céramique Mira", price: 119, meta: "Fabrication française" },
      ],
      delivery: "Livraison standard · 5-7 jours",
      cta: "Vérifier le panier",
    },
  ],
};

window.MOCK = MOCK;
