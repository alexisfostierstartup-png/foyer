/**
 * Référentiel d'attributs V3 (vocab EN fermé) — miroir code de la page Notion
 * « Référentiel liste shopping ». Source de vérité pour l'extraction structurée (Étape 2).
 * Quand le vocab Notion évolue (promotion de candidats), on met ce fichier à jour.
 *
 * NB : sous-ensemble des catégories ayant des produits au catalogue. Poids/conditionnels
 * gérés côté scoring (pas ici) ; ici on ne garde que clés + types + vocab pour l'extraction.
 */
export type AttrV3 = { key: string; type: "enum" | "hex"; vocab?: string[] };

export const SCHEMA_V3: Record<string, AttrV3[]> = {
  sofa: [
    { key: "seats", type: "enum", vocab: ["1", "2", "3", "4", "5+"] },
    { key: "configuration", type: "enum", vocab: ["straight", "corner_left", "corner_right", "chaise", "modular", "panoramic", "sofa_bed"] },
    { key: "color", type: "hex" },
    { key: "upholstery", type: "enum", vocab: ["fabric", "velvet", "corduroy", "linen", "boucle", "chenille", "leather", "faux_leather"] },
    { key: "legs_type", type: "enum", vocab: ["tapered", "block", "metal_thin", "plinth", "casters", "none"] },
    { key: "legs_material", type: "enum", vocab: ["light_wood", "dark_wood", "black_metal", "gold_metal", "chrome_metal"] },
  ],
  armchair: [
    { key: "shape", type: "enum", vocab: ["wingback", "tub", "egg", "scandinavian", "low", "cabriolet", "club"] },
    { key: "color", type: "hex" },
    { key: "upholstery", type: "enum", vocab: ["fabric", "velvet", "corduroy", "boucle", "linen", "leather", "faux_leather", "rattan_cane"] },
    { key: "legs_type", type: "enum", vocab: ["tapered", "four_legs", "central", "tripod", "swivel", "rocking", "sled"] },
    { key: "armrests", type: "enum", vocab: ["with", "without"] },
  ],
  chair: [
    { key: "shape", type: "enum", vocab: ["shell", "scandinavian_wood", "medallion", "bistro", "rush_cane", "upholstered", "transparent"] },
    { key: "color", type: "hex" },
    { key: "material", type: "enum", vocab: ["wood", "metal", "plastic", "padded_fabric", "velvet", "leather", "rattan_cane"] },
    { key: "legs_type", type: "enum", vocab: ["four_legs", "tapered", "cantilever", "central", "wood_splayed"] },
    { key: "armrests", type: "enum", vocab: ["with", "without"] },
  ],
  coffee_table: [
    { key: "shape", type: "enum", vocab: ["round", "oval", "rectangular", "square", "nesting", "organic"] },
    { key: "top_material", type: "enum", vocab: ["light_wood", "dark_wood", "oak", "walnut", "white_lacquer", "black", "marble", "glass", "metal", "travertine", "concrete"] },
    { key: "top_color", type: "hex" },
    { key: "legs_material", type: "enum", vocab: ["wood", "black_metal", "gold_metal", "chrome_metal", "same_as_top"] },
    { key: "legs_type", type: "enum", vocab: ["four_legs", "central", "tapered", "sled", "casters"] },
    { key: "storage", type: "enum", vocab: ["none", "lower_shelf", "drawers", "lift_top"] },
  ],
  side_table: [
    { key: "shape", type: "enum", vocab: ["round", "square", "rectangular", "irregular"] },
    { key: "top_material", type: "enum", vocab: ["light_wood", "dark_wood", "white", "black", "marble", "glass", "metal", "rattan"] },
    { key: "top_color", type: "hex" },
    { key: "legs_type", type: "enum", vocab: ["four_legs", "central", "tapered", "nesting", "c_shape"] },
  ],
  rug: [
    { key: "pattern", type: "enum", vocab: ["plain", "geometric", "chevron", "berber_diamond", "oriental", "abstract", "striped", "checked"] },
    { key: "color", type: "hex" },
    { key: "weave", type: "enum", vocab: ["flatweave", "shaggy", "berber", "tufted", "braided_jute", "kilim", "fringed", "low_velvet"] },
    { key: "shape", type: "enum", vocab: ["rectangular", "round", "oval", "runner"] },
    { key: "material", type: "enum", vocab: ["wool", "cotton", "jute_sisal", "synthetic", "viscose"] },
  ],
  tv_stand: [
    { key: "shape", type: "enum", vocab: ["low_bench", "cabinet", "column", "wall_mounted", "corner"] },
    { key: "color", type: "hex" },
    { key: "material", type: "enum", vocab: ["light_wood", "dark_wood", "oak", "walnut", "white", "black", "cane", "metal", "glass"] },
    { key: "storage", type: "enum", vocab: ["doors", "drawers", "open_niches", "mixed"] },
    { key: "legs", type: "enum", vocab: ["tapered", "metal", "casters", "floor_block", "wall_mounted"] },
  ],
  bookshelf: [
    { key: "shape", type: "enum", vocab: ["tall_bookcase", "wall_shelf", "ladder", "cube", "modular", "narrow_column"] },
    { key: "color", type: "hex" },
    { key: "material", type: "enum", vocab: ["light_wood", "dark_wood", "black_metal", "white", "wood_metal_mix", "glass"] },
    { key: "structure", type: "enum", vocab: ["open", "closed_doors", "mixed"] },
    { key: "mount", type: "enum", vocab: ["floor", "wall_mounted", "leaning_ladder"] },
  ],
  dresser: [
    { key: "shape", type: "enum", vocab: ["wide_low", "tall_chest", "corner"] },
    { key: "color", type: "hex" },
    { key: "material", type: "enum", vocab: ["light_wood", "dark_wood", "oak", "walnut", "white", "black", "cane"] },
    { key: "drawers", type: "enum", vocab: ["2", "3", "4", "5+"] },
    { key: "legs", type: "enum", vocab: ["tapered", "straight", "metal", "casters", "plinth"] },
  ],
  floor_material: [
    { key: "type", type: "enum", vocab: ["wood_laminate", "tile", "polished_concrete", "vinyl", "seagrass", "carpet"] },
    { key: "color", type: "hex" },
    { key: "pattern", type: "enum", vocab: ["straight_planks", "chevron", "herringbone", "broken_bond", "plain", "cement_tiles"] },
    { key: "finish", type: "enum", vocab: ["matte", "satin", "gloss", "brushed"] },
  ],
  floor_lamp: [
    { key: "structure", type: "enum", vocab: ["arc", "column", "tripod", "reading", "multi_arm"] },
    { key: "shade_type", type: "enum", vocab: ["fabric_drum", "metal_dome", "rattan_bamboo", "glass_opal", "none"] },
    { key: "base_material", type: "enum", vocab: ["black_metal", "gold_brass", "chrome", "wood"] },
    { key: "color", type: "hex" },
  ],
  pendant_lamp: [
    { key: "shape", type: "enum", vocab: ["dome", "globe", "cylinder", "cascade", "disc", "cage", "chandelier"] },
    { key: "shade_material", type: "enum", vocab: ["metal", "rattan_bamboo", "glass_opal", "fabric", "paper_rice", "plastic"] },
    { key: "color", type: "hex" },
    { key: "finish", type: "enum", vocab: ["black_matte", "gold_brass", "chrome", "copper", "white"] },
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

/** Mappe une catégorie catalogue vers un schéma V3 (certaines diffèrent). */
export function schemaForCategory(category: string): string {
  const map: Record<string, string> = { floor: "floor_material", lamp: "pendant_lamp", mirror: "default" };
  return map[category] ?? (SCHEMA_V3[category] ? category : "default");
}
