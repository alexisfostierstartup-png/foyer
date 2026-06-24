#!/usr/bin/env npx tsx
/**
 * CANARY extraction attributs (Étape 2) — 1 produit / catégorie, modèle gemini-2.5-flash.
 * Pour chaque produit : ref (id, marchand, nom, image) + attributs extraits par Gemini
 * (vocab V3 fermé). Lecture seule, ne persiste rien. But : juger la COHÉRENCE d'extraction
 * côté CATALOGUE (le morceau coûteux), par œil, avant d'industrialiser sur 7300 produits.
 *
 * Usage : npx tsx scripts/canary-attrs.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const MODEL = "gemini-2.5-flash"; // qualité > coût (run unique)

// 1 produit représentatif par catégorie (tiré du catalogue).
const PRODUCTS: { cat: string; schema: string; id: string }[] = [
  { cat: "sofa",         schema: "sofa",          id: "0bcef7c0-47bd-4d9c-9f62-e653cadfafb7" },
  { cat: "armchair",     schema: "armchair",      id: "7590506f-d607-49e5-9456-236fb9e5f2b1" },
  { cat: "chair",        schema: "chair",         id: "b7648a8b-71c7-46f5-a70c-1901604b9632" },
  { cat: "coffee_table", schema: "coffee_table",  id: "e0a36b6d-5726-474a-864e-7298f89435a9" },
  { cat: "side_table",   schema: "side_table",    id: "eb4f9376-d819-4c9b-8e96-2ffa58343ec9" },
  { cat: "rug",          schema: "rug",           id: "4cd437fb-a961-49f2-915e-dd6abf01c9c5" },
  { cat: "tv_stand",     schema: "tv_stand",      id: "26d3a767-5429-4ec7-baf8-3e8dd5a338af" },
  { cat: "bookshelf",    schema: "bookshelf",     id: "5ab8b0b5-798c-4548-967d-efa1758dc40f" },
  { cat: "dresser",      schema: "dresser",       id: "f1f9770e-2df9-4e87-99a7-ec1c9eaff65b" },
  { cat: "floor",        schema: "floor_material",id: "87cbb5c6-1c06-4c59-b88d-081b3dc21397" },
  { cat: "floor_lamp",   schema: "floor_lamp",    id: "399c9d6e-6b84-4c64-bbf0-cb2cac0b948d" },
  { cat: "lamp",         schema: "pendant_lamp",  id: "0fcea442-9624-400c-8078-4a95bacce024" },
  { cat: "mirror",       schema: "default",       id: "fece6d84-ee68-4424-9ed1-c38d29f914b9" },
];

type A = { key: string; type: "enum" | "hex"; vocab?: string[] };
const SCHEMA: Record<string, A[]> = {
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

function prompt(schema: string): string {
  const lines = SCHEMA[schema].map((a) =>
    a.type === "hex" ? `  "${a.key}": "#rrggbb (couleur dominante de l'objet)"` : `  "${a.key}": one of [${a.vocab!.join(", ")}]`,
  );
  return `Tu décris l'OBJET PRINCIPAL de cette photo produit pour du matching. Ignore le fond/décor. Renvoie un JSON STRICT, une valeur EXACTE du vocabulaire par clé, ou "unknown" si non déterminable :\n{\n${lines.join(",\n")}\n}`;
}

async function main() {
  const WRITE = process.argv.includes("--write"); // persiste metadata.attrs
  const { createSupabaseAdmin } = await import("../lib/supabase/server");
  const { getVisionProvider } = await import("../lib/ai/provider");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createSupabaseAdmin() as any;

  for (const { cat, schema, id } of PRODUCTS) {
    const { data: p } = await sb.from("partner_products").select("name, merchant, primary_image_url, metadata").eq("id", id).single();
    if (!p) { console.log(`\n[${cat}] produit ${id} introuvable`); continue; }
    console.log(`\n══════════ ${cat}  (schéma: ${schema})`);
    console.log(`  ref     : ${id}  ·  ${p.merchant}`);
    console.log(`  nom     : ${p.name}`);
    console.log(`  image   : ${p.primary_image_url}`);
    let attrs: Record<string, string> = {};
    try {
      const buf = Buffer.from(await (await fetch(p.primary_image_url, { headers: { "User-Agent": UA, Accept: "image/jpeg,image/webp" } })).arrayBuffer());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await getVisionProvider("gemini_vision").analyze(prompt(schema), [buf as any], { model: MODEL });
      attrs = (res.parsed ?? {}) as Record<string, string>;
    } catch (e) { attrs = { _error: e instanceof Error ? e.message.slice(0, 80) : "err" }; }
    console.log(`  ATTRS   : ${JSON.stringify(attrs)}`);

    if (WRITE && !attrs._error) {
      const newMeta = { ...(p.metadata ?? {}), attrs, attrs_model: MODEL };
      const { error } = await sb.from("partner_products").update({ metadata: newMeta }).eq("id", id);
      console.log(error ? `  ✗ écriture échouée: ${error.message}` : `  ✓ metadata.attrs écrit`);
    }
  }
  console.log(`\n(modèle: ${MODEL}${WRITE ? " · écriture metadata.attrs ON" : ""})`);
  process.exit(0);
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
