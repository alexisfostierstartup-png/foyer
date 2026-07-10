/**
 * Mapping catégorie FR (chemin category>level2>level3>level4 des flux Google Shopping
 * Effinity) → catégorie catalogue Foyer. Règles ORDONNÉES, la première qui matche gagne.
 * `null` = explicitement hors-scope (mode, linge de lit/table/bain, vaisselle/art de la
 * table, salle de bain, cuisine, enfant/bébé, jardin/extérieur, Noël, accessoires) — les
 * roomType Foyer sont limités à salon/chambre/chambre_parentale (cf. docs/FOYER_LOGIC.md).
 *
 * Vérifié contre scripts/_import7/full-categories.json (tous les chemins distincts des 7
 * flux, sans filtre) — scripts/_import7/verify-mapping.ts liste ce qui reste NON mappé.
 */

export type CategoryRule = { category: string | null; test: RegExp };

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// ── Exclusions explicites (testées AVANT les inclusions) ────────────────────────
// Un chemin qui matche l'une de ces regex est écarté même s'il contient par ailleurs
// un mot-clé "inclusion" (ex. "tapis d'éveil enfant" doit rester exclu malgré "tapis").
const EXCLUDE_PATTERNS: RegExp[] = [
  // Enfant / bébé / puériculture
  /enfant|bebe|puericulture|kids\b/,
  // Jardin / extérieur / terrasse (roomType Foyer = intérieur uniquement)
  /jardin|exterieur|terrasse|balcon|veranda/,
  // Salle de bain / cuisine (roomType non supportés)
  /salle.*de.*bain|vasques?\b|lavabos?\b|baignoires?\b|douches?\b|toilettes?\b/,
  /meubles?.*de.*cuisine|ilots?.*dessertes?|kitchen/,
  // Linge de maison / literie / textile de lit-table-bain (pas des "éléments" de pièce)
  /linge.*de.*lit|linge.*de.*table|linge.*de.*bain|draps?\b|drap.*housses?|housses?.*de.*couette|taies?.*d.*oreiller|taies?.*de.*traversin|parures?.*de.*lit|couvre.*lits?|jetes?.*de.*lit|cache.*sommiers?|nappes?\b|serviettes?\b|torchons?\b|gants?.*de.*toilette|peignoirs?\b|protege.*matelas|surmatelas|aleses?\b/,
  /matelas|sommiers?\b/,
  // Vaisselle / art de la table / électroménager / cuisine (hors scope Foyer)
  /art.*de.*la.*table|vaisselles?\b|vaisselle|assiettes?\b|verres?.*a.*|\bverres?\b|bols?.*coupelles?|couverts?\b|theieres?\b|cafetieres?\b|bouilloires?\b|casseroles?\b|poeles?\b|cocottes?\b|plats?.*a.*four|saladiers?\b|soupieres?\b|carafes?\b|pichets?\b|bouteilles?\b|siphons?\b|ramequins?\b|seaux?.*a.*glace|saucieres?\b|salieres?\b|bonbonnieres?\b|beurriers?\b|coquetiers?\b|porte.*couteaux?|petit.*electromenager|robots?\b|blenders?\b|mixers?\b|grille.*pains?|presse.*agrumes?/,
  // Rangement/accessoires cuisine, conservation
  /conservation|bocaux|boites?.*de.*conservation|lunch.*box|organiseurs?.*tiroir/,
  // Décoration murale / tableaux / affiches / tapisserie (pas un "élément" catalogue Foyer)
  /toiles?.*et.*tableaux|papiers?.*peints?(?!.*moulures)|affiches?\b|tapisseries?(?!.*fauteuil)|masques?.*tribal|relief.*sculpte|stickers?\b/,
  // Rangement/déco d'appoint (paniers, patères, portants) — pas des catégories catalogue
  /rangement.*et.*organisation|corbeilles?\b|paniers?\b|porte.*manteaux?|pateres?\b|portants?.*a.*vetements|pots?.*de.*fleurs?|cache.*pots?\b/,
  // Accessoires / quincaillerie / pièces détachées (pas des produits finis)
  /accessoires?.*de.*bureau|papeterie|tringles?\b|embrasses?\b|poignees?.*de.*meuble|pieds?.*de.*parasol|abat.*jours?\b|ampoules?\b|cables?\b|douilles?\b|interrupteurs?\b|prises?.*de.*courant|variateurs?\b|film.*vitrage|serres?.*livres?(?!.*decorat)/,
  // Noël / saisonnier
  /noel/,
  // Jouets / éveil
  /jouets?\b|eveil|peluches?\b|montessori/,
  // Housses / couvre-X = protection d'un meuble existant, pas le meuble lui-même
  // (ex. "Housses Canapé Et Housses Fauteuil" ≠ des canapés/fauteuils à vendre).
  /\bhousses?\b|couvre.*chaises?\b/,
  // Mobilier d'atelier/pro (établi, comptoir, classeur à rideau, escabeau) — niche
  // antique/pro, pas un élément de pièce à vivre Foyer.
  /meuble.*d.*atelier|meuble.*de.*metier|classeur.*a.*rideau|\betablis?\b|\bescabeaux?\b|\bcomptoirs?\b(?!.*bar)/,
  // Chemin de lit = jeté décoratif (textile), pas le lit.
  /chemins?.*de.*lit\b/,
  // Accessoires de rideaux/stores (tringles, embrasses...) déjà couverts par les
  // accessoires génériques, mais la formulation "accessoires rideaux et stores" a sa
  // propre entrée MdM — exclue explicitement.
  /accessoires?.*rideaux?.*et.*stores?/,
  // Plaids/couvertures/futons/paillassons/jetés : AUCUNE de ces feuilles ne matche de
  // règle → sans cette exclusion, le fallback ancêtre "Linge de maison ET TAPIS" (nom de
  // RAYON, pas de produit) les classait à tort en rug. Découvert en prod : 74 produits
  // MdM ("Plaid...", "Futon en velours...", "Paillasson...", "Jeté de canapé...") mal
  // insérés en category='rug', nettoyés le 2026-07-07.
  /\bplaids?\b|\bpaillassons?\b|jetes?.*de.*canape|\bcouvertures?\b(?!.*bebe)/,
  // "Descente de lit" (petit tapis d'appoint côté lit) — signalé hors-scope explicitement
  // par l'utilisateur (différent d'un tapis de pièce standard).
  /descentes?.*de.*lit/,
];

// ── Inclusions (ordre = priorité) ───────────────────────────────────────────────
const RULES: CategoryRule[] = [
  // Cas composés "bout de X" AVANT les règles génériques canapé/lit (sinon "bout de
  // canapé"/"bout de lit" seraient classés comme le meuble principal lui-même).
  { category: "coffee_table", test: /bouts?.*de.*canapes?/ },
  { category: "bench", test: /bouts?.*de.*lits?/ },
  // "Ensemble table et chaises" AVANT la règle chair générique — sinon "chaises" (mot
  // générique) matche en premier et le produit (photo du LOT, pas d'une chaise isolée)
  // atterrit à tort en category=chair → shape indéterminable par Gemini (bloque l'audit).
  // Signalé en prod : "Ensemble table à manger avec 4 chaises..." classé chair. Un ensemble
  // n'est pas une chaise isolée → dining_table (déjà la catégorie visée plus bas, remontée
  // ici en priorité).
  { category: "dining_table", test: /ensembles?.*tables?.*et.*chaises?/ },

  // Luminaires (avant les meubles génériques pour éviter toute collision de mots)
  { category: "wall_sconce", test: /appliques?\b/ },
  { category: "pendant_lamp", test: /suspensions?\b|lustres?\b|plafonniers?\b/ },
  { category: "floor_lamp", test: /lampadaires?\b|pieds?.*de.*lampes?/ },
  { category: "table_lamp", test: /lampes?.*chevet|lampes?.*a.*poser|lampes?.*de.*bureau|lampes?.*articulee|lampes?.*sans.*fil/ },

  { category: "mirror", test: /miroirs?\b/ },
  { category: "vase", test: /\bvases?\b/ },
  {
    category: "decorative_object",
    test: /objets?.*de.*decoration|objets?.*de.*curiosite|objets?.*religieux|bougeoirs?\b|porte.*bougies?|chandeliers?\b|vide.*poches?\b|animaux?.*en.*ceramique|animaux?.*en.*laiton|cendriers?\b|dame.*jeanne|colonnes?\b|horloges?\b|sculptures?\b|figurines?\b/,
  },

  { category: "rug", test: /tapis/ },
  { category: "curtains", test: /rideaux?\b|voilages?\b|stores?\b(?!.*banne)|panneaux?.*japonais|vitrages?\b(?!.*film)/ },
  { category: "cushion", test: /coussins?\b/ },

  { category: "sofa", test: /canapes?\b|meridienne|banquettes?\b/ },
  { category: "armchair", test: /fauteuils?\b|chauffeuses?\b|rocking.*chair/ },
  { category: "pouf", test: /repose.*pieds?\b|poufs?\b/ },
  { category: "stool", test: /tabourets?\b/ },
  { category: "bench", test: /\bbancs?\b/ },
  { category: "chair", test: /\bchaises?\b/ },

  { category: "coffee_table", test: /tables?.*basses?|tables?.*gigognes?/ },
  { category: "side_table", test: /tables?.*d.*appoint|dessertes?\b(?!.*a.*roulettes)/ },
  { category: "dining_table", test: /tables?.*a.*manger|tables?.*extensibles?|tables?.*bistrot/ },

  // "console" (table console) n'a pas de catégorie dédiée dans le référentiel Notion.
  // Approximation retenue avec l'utilisateur : dressing_table (coiffeuse) type=without_mirror
  // ("plateau seul") — plus proche structurellement (plateau + tiroirs sur pieds contre un
  // mur) qu'un sideboard (buffet fermé/à portes). Couvre aussi "consoles et drapiers" (MdM).
  { category: "dressing_table", test: /coiffeuses?\b|\bconsoles?\b/ },
  { category: "display_cabinet", test: /vitrines?\b/ },
  { category: "bar_cabinet", test: /meubles?.*bar\b|bar.*mappemonde/ },
  { category: "room_divider", test: /paravents?\b/ },
  { category: "headboard", test: /tetes?.*de.*lit/ },
  { category: "desk", test: /bureaux?\b|secretaires?\b/ },

  { category: "bed", test: /\blits?\b/ },
  { category: "nightstand", test: /tables?.*de.*chevet|\bchevets?\b/ },
  { category: "dresser", test: /commodes?\b|chiffonniers?\b|armoires?\b|dressings?\b/ },
  { category: "sideboard", test: /buffets?\b|enfilades?\b|vaisseliers?\b/ },
  { category: "bookshelf", test: /bibliotheques?\b|etageres?\b/ },
  { category: "tv_stand", test: /meubles?.*tv\b/ },
];

/** Résout un chemin catégorie brut ("category > level2 > level3 > level4", ou un titre
 * produit pour les flux sans colonne catégorie, ex. UnAmourDeTapis) vers une catégorie
 * Foyer, ou null si hors-scope / non reconnu.
 *
 * Exclusion testée sur le chemin COMPLET (un ancêtre "Jardin"/"Enfant" exclut même si la
 * feuille ressemble à un meuble d'intérieur). Inclusion testée feuille-d'abord (segment le
 * plus profond en premier) : un parent partagé comme "Canapés et fauteuils > Poufs" ne doit
 * PAS classer les poufs en canapé juste parce que l'ancêtre contient "canapés".
 */
// Libellés de RAYON composites (regroupent plusieurs familles de produits sous un même
// nom) : à écarter quand c'est le SEUL segment disponible (pas de category_level2/3/4),
// car leur nom seul ne dit rien du produit réel. Découvert en prod : MdM sans sous-catégorie
// renvoie juste "Linge de maison et tapis" → 40+ oreillers/protège-matelas/alèses classés
// à tort en rug à cause du mot "tapis" dans le nom du RAYON, pas du produit. Un chemin avec
// plus de segments (ex. "Linge de maison et tapis > Linge déco > Tapis") n'est PAS affecté :
// la feuille "Tapis" matche avant même d'atteindre ce segment ambigu.
const AMBIGUOUS_SOLE_SEGMENT = new Set(["linge de maison et tapis"]);

export function resolveEffinityCategory(pathOrTitle: string): string | null {
  const text = norm(pathOrTitle);
  if (!text) return null;
  for (const ex of EXCLUDE_PATTERNS) if (ex.test(text)) return null;

  const segments = pathOrTitle
    .split(">")
    .map((s) => norm(s.trim()))
    .filter(Boolean)
    .reverse(); // feuille en premier
  if (segments.length === 1 && AMBIGUOUS_SOLE_SEGMENT.has(segments[0])) return null;
  for (const seg of segments) {
    for (const rule of RULES) if (rule.test.test(seg)) return rule.category;
  }
  // Repli : chemin non segmenté (titre produit libre, ex. UnAmourDeTapis) → texte entier.
  for (const rule of RULES) if (rule.test.test(text)) return rule.category;
  return null;
}
