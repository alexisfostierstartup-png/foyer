/**
 * SCORE FOYER — empreinte carbone.
 *
 * Le score annonçait « X kg CO₂ économisés » avec une formule inventée :
 * `conservés × 30 + occasion × 20 + neuf × 5`. Un compte d'objets, pas des kilos : une
 * armoire pesait autant qu'un coussin, et acheter du NEUF « économisait » du CO₂ (+5 par
 * ligne). C'était faux dans son principe même.
 *
 * On repart des ordres de grandeur ADEME (Impact CO₂ / Base Empreinte), qui donnent
 * l'empreinte de FABRICATION d'un meuble NEUF :
 *   chaise bois 18,6 · table bois 80,2 · canapé textile 179 · canapé convertible 198 ·
 *   lit 444 · armoire 907 kg CO₂e.
 * https://impactco2.fr/outils/mobilier
 *
 * Ces six valeurs sont les seules SOURCÉES. Tout le reste ci-dessous est interpolé à la
 * grosse brosse à partir d'elles (une table basse ≈ la moitié d'une table à manger, un
 * fauteuil ≈ la moitié d'un canapé…). C'est assumé et provisoire : l'ordre de grandeur
 * compte, pas la décimale. À remplacer par des facteurs produit dès qu'on les aura.
 */

/** kg CO₂e pour fabriquer l'objet NEUF, par catégorie d'élément. */
const CO2_NEUF_KG: Record<string, number> = {
  // ── Ancré ADEME ─────────────────────────────────────────────────────────────
  sofa: 179,
  chair: 19,
  dining_chair: 19,
  dining_table: 80,
  bed: 444,
  wardrobe: 907,

  // ── Interpolé (grosse brosse) ───────────────────────────────────────────────
  armchair: 90, // ~ un demi-canapé
  bench: 35,
  pouf: 20,
  stool: 12,

  coffee_table: 40, // ~ une demi-table à manger
  side_table: 20,
  console_table: 45,
  bar_table: 60,
  desk: 80,

  mattress: 120,
  headboard: 50,
  nightstand: 40,
  dresser: 300,
  cabinet: 250,
  sideboard: 300,
  bookshelf: 200,
  tv_stand: 150,
  shelf: 30,

  rug: 40,
  curtains: 15,
  cushion: 3,

  floor_lamp: 15,
  table_lamp: 8,
  ceiling_light: 10,
  wall_sconce: 5,

  mirror: 25,
  frame: 5,
  plant: 2,

  // Surfaces. Le sol est le poste lourd : ~15 kg/m² × ~20 m² de pièce.
  floor: 300,
  // Peinture : ~2,5 kg CO₂e par litre, un pot de 2,5 L ≈ 6 kg.
  paint: 6,
  wall: 6,
};

/** Faute de mieux — l'ordre de grandeur d'un meuble d'appoint. */
const CO2_DEFAUT_KG = 60;

export function co2NeufKg(category: string): number {
  return CO2_NEUF_KG[category] ?? CO2_DEFAUT_KG;
}

/**
 * Origine d'un achat, et ce qu'il coûte en CO₂ par rapport au même objet neuf.
 * Règles produit (Alexis, 2026-07-14) :
 *   conservé      0 %   — on ne fabrique rien
 *   occasion     10 %   — Emmaüs, Leboncoin, Vinted, Selency… (transport + remise en état)
 *   reconditionné 70 %  — TheBradery… (retour, contrôle, remise en vente)
 *   neuf        100 %
 */
export type Origine = "conserve" | "occasion" | "reconditionne" | "neuf";

export const FACTEUR_CO2: Record<Origine, number> = {
  conserve: 0,
  occasion: 0.1,
  reconditionne: 0.7,
  neuf: 1,
};

// Enseignes de SECONDE MAIN, par nature de leur stock. Le catalogue ne porte qu'un
// `source_type` binaire (secondhand / eco_new) : il ne distingue pas l'occasion du
// reconditionné, alors que leur empreinte va du simple au septuple. On tranche donc sur
// l'ENSEIGNE, seule information disponible.
const MARCHANDS_OCCASION = new Set([
  "selency", "emmaus", "emmaüs", "label_emmaus", "leboncoin", "vinted", "backmarket",
]);
const MARCHANDS_RECONDITIONNE = new Set(["thebradery", "the_bradery"]);

/** Origine d'une ligne de courses, d'après son marchand puis son type de source. */
export function origineDe(
  source: string | undefined,
  merchant: string | null | undefined,
): Origine {
  const m = (merchant ?? "").toLowerCase().replace(/[\s.-]/g, "_");
  if (MARCHANDS_RECONDITIONNE.has(m)) return "reconditionne";
  if (MARCHANDS_OCCASION.has(m)) return "occasion";
  // Le type de source fait foi quand l'enseigne est inconnue : mieux vaut compter une
  // occasion inconnue à 10 % que la facturer comme du neuf.
  if (source === "secondhand") return "occasion";
  return "neuf";
}

export type LigneCo2 = {
  category: string;
  quantity: number;
  origine: Origine;
};

/**
 * Bilan carbone du projet.
 *
 * - `emis` : ce que la liste de courses va réellement coûter en CO₂.
 * - `evite` : ce qu'on économise par rapport au scénario « tout racheter neuf » — ce qui
 *   est CONSERVÉ compte pour son plein prix neuf (on ne le fabrique pas), et ce qui est
 *   acheté d'occasion ou reconditionné compte pour la part qu'il n'émet pas.
 *
 * C'est `evite` qu'on affiche : c'est la promesse de Foyer (garder, chiner), pas le coût.
 */
export function bilanCo2(
  categoriesConservees: string[],
  lignes: LigneCo2[],
): { emisKg: number; eviteKg: number } {
  let emis = 0;
  let evite = 0;

  for (const cat of categoriesConservees) {
    evite += co2NeufKg(cat); // conservé = 0 émis, donc 100 % évité
  }

  for (const l of lignes) {
    const neuf = co2NeufKg(l.category) * Math.max(1, l.quantity);
    const facteur = FACTEUR_CO2[l.origine];
    emis += neuf * facteur;
    evite += neuf * (1 - facteur);
  }

  return { emisKg: Math.round(emis), eviteKg: Math.round(evite) };
}
