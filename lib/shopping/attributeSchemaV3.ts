/**
 * Référentiel d'attributs V3 (vocab EN fermé) — miroir code de la page Notion
 * « Référentiel liste shopping ». Source de vérité pour l'extraction structurée (Étape 2).
 * Quand le vocab Notion évolue (promotion de candidats), on met ce fichier à jour.
 *
 * NB : sous-ensemble des catégories ayant des produits au catalogue. Poids/conditionnels
 * gérés côté scoring (pas ici) ; ici on ne garde que clés + types + vocab pour l'extraction.
 */
// conditional = l'attribut peut ne PAS s'appliquer (ex. matière des pieds sans pieds, finition
// métal sur un luminaire en rotin) → l'extraction renvoie "n/a", exclu du score (coverage).
// hint = courte indication d'extraction injectée dans le prompt (désambiguïse un attribut,
// ex. distinguer base vs forme des pieds, ou matière de structure vs revêtement).
export type AttrV3 = { key: string; type: "enum" | "hex"; vocab?: string[]; conditional?: boolean; hint?: string };

export const SCHEMA_V3: Record<string, AttrV3[]> = {
  sofa: [
    { key: "seats", type: "enum", vocab: ["1", "2", "3", "4", "5+"], hint: "Places assises CONFORTABLES, PAS le nombre de coussins : ~60-65 cm de largeur d'assise par place (≤180cm=2 · ~200-250cm=3 · ~260-300cm=4 · 5+ UNIQUEMENT panoramique/U >3m). Un modulable 3 places à 5 coussins = 3 places. En cas de doute, choisis le chiffre INFÉRIEUR (confort, pas optimisation)" },
    { key: "configuration", type: "enum", vocab: ["straight", "corner_left", "corner_right", "chaise", "modular", "panoramic", "sofa_bed"], hint: "corner_left/corner_right = canapé D'ANGLE (assise en L, dossier des deux côtés) ; gauche/droit = côté où pointe la partie longue VUE DE FACE. chaise = méridienne SANS dossier sur la partie longue (bord ouvert, un seul niveau d'assise). Ne pas confondre : un angle fermé (dossier continu) n'est JAMAIS 'chaise' même si une partie dépasse." },
    { key: "color", type: "hex" },
    { key: "upholstery", type: "enum", vocab: ["fabric", "velvet", "corduroy", "linen", "boucle", "chenille", "leather", "faux_leather"] },
    { key: "legs_type", type: "enum", vocab: ["tapered", "block", "metal_thin", "plinth", "casters", "none"] },
    { key: "legs_material", type: "enum", conditional: true, vocab: ["wood", "metal", "plastic"], hint: "MATIÈRE des pieds VISIBLES seulement (pas la couleur, captée par legs_color) : wood, metal ou plastic (patins/glissières plastique). Canapé bas posé au sol SANS aucun pied visible → legs_type='none' et legs_material='n/a'" },
    { key: "legs_color", type: "hex", conditional: true },
  ],
  armchair: [
    { key: "shape", type: "enum", vocab: ["wingback", "tub", "egg", "scandinavian", "low", "cabriolet", "club", "recliner"] },
    { key: "color", type: "hex" },
    { key: "upholstery", type: "enum", vocab: ["fabric", "velvet", "corduroy", "boucle", "linen", "leather", "faux_leather", "rattan_cane"] },
    // PIEDS éclatés en 2 dimensions distinctes (avant : un seul legs_type qui mélangeait
    // forme et configuration → faux mismatch "tapered" vs "four_legs").
    { key: "legs_base", type: "enum", vocab: ["four_legs", "central", "tripod", "sled", "swivel", "rocking", "skirted"], hint: "CONFIGURATION de la base : skirted=jupe/tissu jusqu'au sol sans pieds visibles, central=piètement unique, sled=base luge" },
    { key: "legs_shape", type: "enum", conditional: true, vocab: ["tapered", "straight", "turned"], hint: "FORME des pieds si pieds distincts visibles (tapered=s'affinent vers le bas, turned=tournés/galbés) ; n/a si base skirted/central" },
    { key: "frame_material", type: "enum", vocab: ["wood", "metal", "none"], hint: "matière de la STRUCTURE/ACCOUDOIRS apparente : wood=bois visible, none=entièrement rembourré sans structure dure apparente" },
    { key: "armrests", type: "enum", vocab: ["with", "without"] },
  ],
  chair: [
    { key: "shape", type: "enum", vocab: ["shell", "scandinavian_wood", "medallion", "bistro", "rush_cane", "upholstered", "transparent", "ladder_back"] },
    { key: "color", type: "hex" },
    { key: "material", type: "enum", vocab: ["wood", "metal", "plastic", "padded_fabric", "velvet", "leather", "rattan_cane"] },
    { key: "legs_type", type: "enum", vocab: ["four_legs", "tapered", "cantilever", "central", "wood_splayed"] },
    { key: "armrests", type: "enum", vocab: ["with", "without"] },
  ],
  stool: [
    { key: "height", type: "enum", vocab: ["low", "counter", "bar"], hint: "low=tabouret bas · counter=chaise de bar ~65cm · bar=chaise haute ~75cm" },
    { key: "material", type: "enum", vocab: ["wood", "black_metal", "gold_metal", "colored_metal", "plastic", "padded", "rattan_cane"], hint: "colored_metal = métal peint d'une couleur non standard (teinte dans color)" },
    { key: "color", type: "hex" },
    { key: "seat_back", type: "enum", vocab: ["none", "low", "high"] },
    { key: "legs_type", type: "enum", vocab: ["four_legs", "central", "sled"] },
  ],
  // pouf ET footstool (repose-pieds) : même schéma (footstool→pouf via schemaForCategory).
  pouf: [
    { key: "material", type: "enum", vocab: ["wood", "black_metal", "gold_metal", "colored_metal", "plastic", "padded", "rattan_cane", "fabric", "velvet", "corduroy", "linen", "boucle", "chenille", "leather", "faux_leather"] },
    { key: "color", type: "hex" },
    { key: "legs_type", type: "enum", vocab: ["four_legs", "central", "sled", "none"], hint: "none = pouf/repose-pieds posé au sol sans pieds apparents (cas courant)" },
    { key: "legs_color", type: "hex", conditional: true },
  ],
  bench: [
    { key: "shape", type: "enum", vocab: ["bench_seat", "storage_bench", "entryway", "backless"], hint: "bench_seat=banc simple · storage_bench=avec coffre/rangement · entryway=meuble d'entrée (dossier/patères) · backless=sans dossier" },
    { key: "color", type: "hex" },
    { key: "material", type: "enum", vocab: ["wood", "metal", "plastic", "padded_fabric", "velvet", "leather", "rattan_cane"] },
    { key: "legs_type", type: "enum", vocab: ["four_legs", "tapered", "cantilever", "central", "wood_splayed"] },
    { key: "armrests", type: "enum", vocab: ["with", "without"] },
    { key: "armrests_material", type: "enum", conditional: true, vocab: ["wood", "metal", "plastic", "padded_fabric", "velvet", "leather", "rattan_cane"], hint: "n/a si armrests=without" },
  ],
  coffee_table: [
    { key: "shape", type: "enum", vocab: ["round", "oval", "rectangular", "square", "nesting", "organic"] },
    { key: "top_material", type: "enum", vocab: ["light_wood", "dark_wood", "oak", "walnut", "white_lacquer", "black", "colored", "marble", "glass", "metal", "travertine", "concrete"], hint: "APPARENCE du plateau. Surface peinte/laquée d'une couleur non standard (gris, vert, bleu…) = 'colored' (teinte exacte dans top_color)" },
    { key: "top_color", type: "hex" },
    { key: "legs_material", type: "enum", conditional: true, vocab: ["wood", "metal", "plastic", "stone", "glass"], hint: "MATIÈRE du pied, et RIEN d'autre (la couleur est captée par legs_color, la finition ne compte pas) : wood (tout bois, clair/foncé/laqué/placage), metal (tout métal, quelle que soit sa couleur ou finition), plastic, stone (marbre, travertin, béton, pierre), glass. Si le pied est dans la MÊME matière que le plateau, indique cette MATIÈRE — jamais une valeur du type « identique au plateau »" },
    { key: "legs_color", type: "hex", conditional: true },
    { key: "legs_type", type: "enum", vocab: ["four_legs", "central", "tapered", "metal_thin", "sled", "casters"] },
    { key: "storage", type: "enum", vocab: ["none", "lower_shelf", "drawers", "lift_top"] },
  ],
  side_table: [
    { key: "shape", type: "enum", vocab: ["round", "square", "rectangular", "irregular"] },
    { key: "top_material", type: "enum", vocab: ["light_wood", "dark_wood", "white", "black", "colored", "marble", "glass", "metal", "rattan"], hint: "APPARENCE du plateau. Surface peinte/laquée d'une couleur non standard (gris, vert, bleu…) = 'colored' (teinte exacte dans top_color)" },
    { key: "top_color", type: "hex" },
    { key: "legs_type", type: "enum", vocab: ["four_legs", "central", "tapered", "nesting", "c_shape"] },
  ],
  rug: [
    { key: "pattern", type: "enum", vocab: ["plain", "geometric", "chevron", "berber_diamond", "oriental", "abstract", "striped", "checked"] },
    { key: "color", type: "hex" },
    { key: "weave", type: "enum", vocab: ["flatweave", "shaggy", "berber", "tufted", "braided_jute", "kilim", "fringed", "low_velvet"] },
    { key: "shape", type: "enum", vocab: ["rectangular", "round", "oval", "runner"] },
    // `material` (laine/synthétique) retiré : invisible sur photo (8/8 unknown au harvest).
    // `weave` capte déjà la texture. À sourcer du texte produit si besoin.
  ],
  tv_stand: [
    { key: "shape", type: "enum", vocab: ["low_bench", "cabinet", "column", "wall_mounted", "corner"] },
    { key: "color", type: "hex" },
    { key: "material", type: "enum", vocab: ["light_wood", "dark_wood", "oak", "walnut", "white", "black", "colored", "cane", "metal", "glass", "travertine"] },
    { key: "storage", type: "enum", vocab: ["doors", "drawers", "open_niches", "mixed"] },
    { key: "legs", type: "enum", vocab: ["tapered", "metal", "block", "casters", "floor_block", "wall_mounted"] },
  ],
  bookshelf: [
    { key: "shape", type: "enum", vocab: ["tall_bookcase", "wall_shelf", "ladder", "cube", "modular", "narrow_column", "round"] },
    { key: "color", type: "hex" },
    { key: "material", type: "enum", vocab: ["light_wood", "dark_wood", "black_metal", "white", "colored", "wood_metal_mix", "glass", "metal"], hint: "'black_metal' = métal noir spécifiquement ; 'metal' = métal identifiable d'une autre teinte (couleur exacte captée par `color`), pas 'colored' dans ce cas." },
    { key: "structure", type: "enum", vocab: ["open", "closed_doors", "mixed"] },
    { key: "mount", type: "enum", vocab: ["floor", "wall_mounted", "leaning_ladder"], hint: "wall_mounted UNIQUEMENT si le meuble est FIXÉ au mur avec le SOL VISIBLE dessous (aucun contact au sol). Un meuble bas ou haut POSÉ AU SOL contre un mur = floor — c'est le cas par défaut" },
  ],
  dresser: [
    { key: "shape", type: "enum", vocab: ["wide_low", "tall_chest", "corner"] },
    { key: "color", type: "hex" },
    { key: "material", type: "enum", vocab: ["light_wood", "dark_wood", "oak", "walnut", "white", "black", "colored", "cane", "fabric", "metal"], hint: "'fabric' = armoire souple en tissu non-tissé sur structure tube (type dressing pas cher), pas un revêtement sur meuble rigide. 'metal' = corps métallique identifiable même peint d'une couleur non standard (teinte captée par `color`) — pas 'colored' dans ce cas." },
    { key: "drawers", type: "enum", vocab: ["1", "2", "3", "4", "5+"] },
    { key: "legs", type: "enum", vocab: ["tapered", "straight", "metal", "casters", "plinth"] },
  ],
  floor_material: [
    { key: "type", type: "enum", vocab: ["wood_laminate", "tile", "polished_concrete", "vinyl", "seagrass", "carpet"] },
    { key: "color", type: "hex" },
    { key: "pattern", type: "enum", vocab: ["straight_planks", "chevron", "herringbone", "broken_bond", "plain", "cement_tiles"] },
    { key: "finish", type: "enum", vocab: ["matte", "satin", "gloss", "brushed"] },
  ],
  floor_lamp: [
    // Refonte (harvest : base_material confondait forme et finition) → on sépare
    // base_shape (la forme du socle) de base_finish (le métal/finition).
    // 'overhang' + 'stick' ajoutés 2026-07-11 (QA Alexis) : deux formes très
    // courantes n'avaient AUCUNE valeur et tombaient toutes deux en 'column' —
    // un repli plausible, donc jamais remonté par l'auto-harvest (le modèle ne
    // répond 'unknown' que s'il ne voit AUCUN fit) :
    //  · la potence (fût droit + bras au sommet, abat-jour SUSPENDU) → 'overhang'
    //  · la tige fine + abat-jour posé dessus (le lampadaire le plus banal) → 'stick'
    // 'column' est désormais réservé à son sens strict : la lampe EST un volume
    // vertical plein qui diffuse par son corps (colonne tressée, totem) — masse
    // visuelle radicalement différente d'une tige de 2 cm.
    // Le critère décisif est COMMENT l'abat-jour est porté, pas la forme du pied.
    { key: "structure", type: "enum", vocab: ["arc", "overhang", "stick", "column", "tripod", "reading", "multi_arm"], hint: "Juge COMMENT la lumière est portée, dans cet ordre : 3 pieds écartés visibles = 'tripod' · plusieurs bras/spots = 'multi_arm' · bras orientable de liseuse = 'reading' · abat-jour SUSPENDU au bout d'un bras COURBÉ en arc (déporté loin du pied) = 'arc' · abat-jour SUSPENDU au bout d'un bras DROIT ou coudé à angle, fût vertical (potence) = 'overhang' · abat-jour DISTINCT posé AU SOMMET d'une TIGE FINE (barre/tube étroit, métal ou bois) = 'stick' (cas le plus courant) · la lampe EST un VOLUME vertical PLEIN et large qui diffuse la lumière par son corps, sans abat-jour distinct sur une tige (colonne tressée, totem, cocoon) = 'column'. Une tige fine surmontée d'un abat-jour n'est JAMAIS 'column'. Regarde le BAS du pied (souvent masqué par un meuble) : si le bas est invisible, juge sur la partie visible sans inventer" },
    { key: "shade_type", type: "enum", vocab: ["fabric_drum", "metal_dome", "rattan_bamboo", "glass_opal", "paper_lantern", "rectangular", "cage", "none"] },
    // conditional 2026-07-11 : beaucoup de photos produit sont RECADRÉES sur le haut de la
    // lampe — le socle est purement hors champ (ex. « Lampadaire en acier bronze » EVA, MdM).
    // Sans 'n/a', le modèle n'avait AUCUNE façon de dire « je ne le vois pas » : il répondait
    // 'unknown' (à raison — il ne doit pas inventer), ce qui arrêtait tout le run.
    { key: "base_shape", type: "enum", conditional: true, vocab: ["disc", "round_weighted", "square", "tripod", "integrated_shelf"], hint: "FORME du socle posé au sol. Réponds 'n/a' si le socle n'est PAS VISIBLE sur la photo (cadrage serré sur le haut de la lampe, pied coupé hors cadre, base masquée) — n'invente JAMAIS une forme que tu ne vois pas" },
    { key: "base_finish", type: "enum", conditional: true, vocab: ["black_metal", "white_metal", "gold_brass", "chrome", "brushed_metal", "colored_metal", "wood"], hint: "FINITION du socle/structure. Métal peint d'une couleur non standard (rouge, vert, bleu…) = 'colored_metal' (teinte exacte dans color)" },
    { key: "color", type: "hex" },
  ],
  pendant_lamp: [
    { key: "shape", type: "enum", vocab: ["dome", "globe", "cylinder", "cascade", "disc", "cage", "chandelier", "linear"], hint: "'linear' = suspension barre/réglette LED horizontale (au-dessus d'une table)" },
    { key: "shade_material", type: "enum", vocab: ["metal", "rattan_bamboo", "glass_opal", "glass_clear", "fabric", "paper_rice", "plastic"], hint: "glass_opal = verre opalin/laiteux · glass_clear = verre transparent, fumé ou teinté" },
    { key: "color", type: "hex" },
    { key: "finish", type: "enum", conditional: true, vocab: ["black_matte", "gold_brass", "chrome", "copper", "white", "colored_metal", "rattan_rope"], hint: "FINITION. Métal peint d'une couleur non standard (rouge, vert, bleu…) = 'colored_metal' (teinte exacte dans color)" },
    { key: "number_of_bulbs", type: "enum", vocab: ["1", "2", "3", "4+"], hint: "nombre de points lumineux/ampoules. Si l'ampoule n'est pas visible (luminaire fermé/plafonnier à source unique intégrée) → '1' par défaut. 'unknown' seulement si vraiment indéterminable" },
    { key: "fixation_color", type: "hex", conditional: true, hint: "couleur de la rosace/fixation au plafond ; n/a si non visible" },
    { key: "mount", type: "enum", vocab: ["corded", "flush"], hint: "corded=suspendu par câble/tige · flush=plafonnier collé au plafond" },
  ],
  sideboard: [
    { key: "shape", type: "enum", vocab: ["low_credenza", "tall_hutch", "corner", "modular"] },
    { key: "color", type: "hex" },
    { key: "material", type: "enum", vocab: ["light_wood", "dark_wood", "oak", "walnut", "white", "black", "colored", "cane", "wood_metal_mix", "metal", "marble", "stone"], hint: "MATIÈRE de la structure/corps, indépendamment de la couleur (captée par `color`) : si le métal est identifiable malgré une peinture non standard (gris, vert, bleu…), utilise 'metal', pas 'colored'. 'marble' = effet marbre visible ; 'stone' = aspect minéral/pierre non-marbré (granit, béton, effet minéral brut) — matière DOMINANTE visuellement quand plusieurs matières se combinent (ex. structure métal + façade minérale → 'stone'). 'colored' seulement si la matière de base n'est vraiment pas identifiable visuellement (surface entièrement laquée/peinte sans indice de matière)." },
    { key: "front", type: "enum", vocab: ["solid_doors", "cane", "glass", "drawers", "open", "mixed"] },
    { key: "legs", type: "enum", vocab: ["tapered", "straight", "metal", "plinth", "wall_mounted"] },
  ],
  dining_table: [
    { key: "shape", type: "enum", vocab: ["round", "oval", "rectangular", "square", "extendable"] },
    { key: "top_material", type: "enum", vocab: ["light_wood", "dark_wood", "oak", "walnut", "white_lacquer", "black", "colored", "marble", "ceramic", "glass", "metal", "travertine", "concrete"], hint: "APPARENCE du plateau. Surface peinte/laquée d'une couleur non standard (gris, vert, bleu…) = 'colored' (teinte exacte dans top_color)" },
    { key: "top_color", type: "hex" },
    { key: "legs_type", type: "enum", vocab: ["four_legs", "central", "trestle", "sled", "u_frame"] },
    { key: "legs_material", type: "enum", conditional: true, vocab: ["wood", "metal", "plastic", "stone", "glass"], hint: "MATIÈRE du pied, et RIEN d'autre (la couleur est captée par legs_color, la finition ne compte pas) : wood (tout bois, clair/foncé/laqué/placage), metal (tout métal, quelle que soit sa couleur ou finition), plastic, stone (marbre, travertin, béton, pierre), glass. Si le pied est dans la MÊME matière que le plateau, indique cette MATIÈRE — jamais une valeur du type « identique au plateau »" },
    { key: "legs_color", type: "hex", conditional: true },
    { key: "number_of_people", type: "enum", conditional: true, vocab: ["2", "4", "6", "8+"], hint: "nombre de couverts ESTIMÉ d'après la longueur du plateau ; n/a si indéterminable" },
  ],
  table_lamp: [
    { key: "shade_type", type: "enum", vocab: ["fabric_drum", "metal_dome", "metal_cylinder", "rattan_bamboo", "glass_opal", "none"], hint: "metal_dome = abat-jour métal arrondi/cloche · metal_cylinder = abat-jour métal cylindrique/tubulaire droit" },
    { key: "shade_color", type: "hex", conditional: true, hint: "couleur de l'abat-jour ; n/a si pas d'abat-jour" },
    { key: "base_shape", type: "enum", vocab: ["column", "sphere", "mushroom", "bottle", "sculptural", "tripod", "task_arm"], hint: "task_arm = lampe de bureau/liseuse à bras courbé ou articulé (base + tige orientable)" },
    { key: "base_material", type: "enum", vocab: ["ceramic", "glass", "black_metal", "gold_brass", "chrome", "colored_metal", "wood", "marble", "rattan_rope", "fabric"], hint: "colored_metal = métal peint d'une couleur non standard (teinte dans color) ; fabric = pied gainé de tissu" },
    { key: "color", type: "hex" },
  ],
  desk: [
    { key: "shape", type: "enum", vocab: ["straight", "corner", "wall_mounted", "secretary", "sit_stand"] },
    { key: "color", type: "hex" },
    { key: "top_material", type: "enum", vocab: ["light_wood", "dark_wood", "white", "black", "colored", "glass"] },
    { key: "storage", type: "enum", vocab: ["none", "drawers", "shelf"] },
    { key: "legs_type", type: "enum", vocab: ["four_legs", "a_frame", "u_frame", "trestle", "panel"] },
  ],
  wall_sconce: [
    { key: "type", type: "enum", vocab: ["up_down", "swing_arm", "globe", "plaster", "picture_light", "half_moon"] },
    { key: "shade_type", type: "enum", vocab: ["fabric_drum", "glass_opal", "metal_dome", "rattan_bamboo", "none"] },
    { key: "shade_color", type: "hex", conditional: true, hint: "n/a si shade_type=none" },
    { key: "finish", type: "enum", vocab: ["black_matte", "gold_brass", "chrome", "white", "plaster_paintable", "wood"] },
    { key: "color", type: "hex" },
  ],
  dressing_table: [
    { key: "type", type: "enum", vocab: ["with_mirror", "with_led_mirror", "without_mirror", "wall_mounted"] },
    { key: "color", type: "hex" },
    { key: "material", type: "enum", vocab: ["light_wood", "dark_wood", "white", "black", "colored", "cane", "glass_metal"] },
    { key: "storage", type: "enum", vocab: ["1_drawer", "2-3_drawers", "open_shelf", "none"] },
    { key: "legs_type", type: "enum", vocab: ["four_legs", "hairpin", "u_frame", "panel"] },
  ],
  display_cabinet: [
    { key: "type", type: "enum", vocab: ["tall", "low", "wall_mounted", "corner"] },
    { key: "glazing", type: "enum", vocab: ["full_glass", "glass_doors", "glass_grid", "fluted_glass"] },
    { key: "color", type: "hex" },
    { key: "material", type: "enum", vocab: ["wood", "metal", "wood_metal", "white", "black"] },
    { key: "lighting", type: "enum", vocab: ["with", "without"] },
  ],
  bar_cabinet: [
    { key: "type", type: "enum", vocab: ["cabinet", "open_shelf", "trolley", "corner_bar", "globe"] },
    { key: "color", type: "hex" },
    { key: "material", type: "enum", vocab: ["dark_wood", "light_wood", "black", "metal_gold", "rattan_cane", "glass_metal"] },
    { key: "interior", type: "enum", vocab: ["bottle_racks", "glass_holder", "mirror_back", "simple"] },
  ],
  room_divider: [
    { key: "type", type: "enum", vocab: ["folding_screen", "slat_divider", "shelf_divider", "hanging_panel", "glass_partition"] },
    { key: "material", type: "enum", vocab: ["wood", "cane_rattan", "fabric", "metal", "glass_metal"] },
    { key: "color", type: "hex" },
    { key: "panels", type: "enum", vocab: ["3", "4", "5+"] },
  ],
  headboard: [
    { key: "type", type: "enum", vocab: ["upholstered", "wood_panel", "rattan_cane", "slatted", "shelf_headboard", "wall_panel"] },
    { key: "material", type: "enum", vocab: ["fabric", "velvet", "boucle", "wood", "rattan_cane", "metal"] },
    { key: "color", type: "hex" },
    { key: "shape", type: "enum", vocab: ["straight", "arched", "wavy", "winged"] },
  ],
  // Dormant (NON_SHOPPABLE côté matcher, comme mirror) : importés pour préparer une
  // activation future du matching décoratif, pas utilisés aujourd'hui.
  mirror: [
    { key: "shape", type: "enum", vocab: ["round", "oval", "arch", "rectangular", "square", "irregular", "full_length"] },
    { key: "frame_material", type: "enum", vocab: ["black_metal", "gold_brass", "wood", "rattan", "frameless", "colored"] },
    { key: "frame_color", type: "hex" },
    { key: "lighting", type: "enum", vocab: ["none", "led_backlit"] },
    { key: "mount", type: "enum", vocab: ["wall", "standing", "leaning"] },
  ],
  vase: [
    { key: "shape", type: "enum", vocab: ["bottle", "sphere", "cylinder", "amphora", "organic", "pitcher"] },
    { key: "material", type: "enum", vocab: ["ceramic", "glass", "terracotta", "metal", "stone", "wood", "rattan_cane", "resin", "concrete"], hint: "rattan_cane = tressé (rotin, osier, bambou, ET corde/papier tressé — même texture tressée)" },
    { key: "color", type: "hex" },
    { key: "size", type: "enum", vocab: ["small", "medium", "large"] },
  ],
  decorative_object: [
    { key: "type", type: "enum", vocab: ["sculpture", "candle_holder", "bowl_tray", "bookend", "box", "clock", "candle"] },
    { key: "material", type: "enum", vocab: ["ceramic", "metal_brass", "wood", "glass", "stone_marble", "resin", "terracotta", "plastic", "rattan_cane", "fabric"], hint: "fabric = matière souple non rigide (textile, plumes...) ; rattan_cane = tressé (rotin, osier, bambou)" },
    { key: "color", type: "hex" },
    { key: "size", type: "enum", vocab: ["small", "medium", "large"] },
  ],
  // mouldings/batten : `width` (number, gros poids Notion) = spec PRODUIT, non extractible du
  // rendu → on garde le profil (visuel). Le coverage-aware gère l'absence de width côté rendu.
  mouldings: [
    { key: "shape", type: "enum", vocab: ["flat", "cove", "ogee", "dentil", "quarter_round", "ornate_cornice"] },
  ],
  batten: [
    { key: "shape", type: "enum", vocab: ["square", "rectangular", "half_round", "fluted"] },
  ],
  default: [
    { key: "color", type: "hex" },
    { key: "material", type: "enum", vocab: ["light_wood", "dark_wood", "metal", "fabric", "plastic", "glass", "rattan", "white", "black"] },
    { key: "shape", type: "enum", vocab: ["horizontal", "vertical", "compact", "rounded", "angular"] },
  ],
};

export function getSchemaV3(schema: string): AttrV3[] {
  return SCHEMA_V3[schema] ?? SCHEMA_V3.default;
}

/** Catégories dont le nom diffère de leur schéma V3 — partagé avec l'instruction
 * d'extraction : le MODÈLE matche par nom de catégorie (`floor`), pas par nom de
 * schéma (`floor_material`) ; sans alias affiché il n'émettait JAMAIS d'attrs pour
 * le sol (matcher sol privé d'attrs — QA Alexis 2026-07-16, ND5qBys). */
export const CATEGORY_SCHEMA_ALIASES: Record<string, string> = {
  floor: "floor_material",
  lamp: "pendant_lamp",
  footstool: "pouf",
};

/** Mappe une catégorie catalogue vers un schéma V3 (certaines diffèrent). */
export function schemaForCategory(category: string): string {
  return CATEGORY_SCHEMA_ALIASES[category] ?? (SCHEMA_V3[category] ? category : "default");
}

/**
 * Prompt d'extraction fermée. Distingue "unknown" (s'applique mais indéterminable) de
 * "n/a" (ne s'applique pas à ce produit) → "n/a" est exclu du score sans polluer la
 * récolte de vocab (ex. matière des pieds quand il n'y a pas de pieds).
 */
export function buildExtractionPrompt(attrs: AttrV3[]): string {
  const lines = attrs.map((a) => {
    const base = a.type === "hex" ? `  "${a.key}": "#rrggbb (couleur dominante de l'objet)"` : `  "${a.key}": one of [${a.vocab!.join(", ")}]`;
    return a.hint ? `${base}  — ${a.hint}` : base;
  });
  return (
    `Décris l'OBJET PRINCIPAL de cette photo produit (ignore le fond/décor). JSON STRICT, ` +
    `une valeur EXACTE du vocabulaire par clé.\n` +
    `- Pour les MATIÈRES (matière, matériau), juge l'APPARENCE VISUELLE (ce à quoi ça ` +
    `ressemble), PAS la construction réelle : un placage / mélaminé / MDF effet bois = "bois" ` +
    `(light_wood ou dark_wood selon la teinte). N'utilise "unknown" sur une matière que si ` +
    `l'aspect est vraiment indéterminable.\n` +
    `- "unknown" si l'attribut S'APPLIQUE mais n'est pas déterminable depuis l'image.\n` +
    `- "n/a" si l'attribut NE S'APPLIQUE PAS à ce produit (ex. matière des pieds s'il n'y a pas de pieds visibles).\n` +
    `- PIEDS : si l'objet REPOSE AU SOL sans pieds apparents (canapé bas, socle plein, pieds ` +
    `cachés sous l'assise), alors legs_type = "none" ET legs_material = "n/a". N'invente PAS ` +
    `des pieds (ex. "block"/"dark_wood") quand on n'en voit pas.\n` +
    `{\n${lines.join(",\n")}\n}`
  );
}
