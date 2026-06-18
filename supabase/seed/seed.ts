import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../lib/db/database.types";

// Load .env.local
import { config } from "dotenv";
config({ path: ".env.local" });

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ambiances = [
  { slug: "doux", data: { name: "Doux", description: "Lumière tamisée, matériaux naturels. Une pièce où l'on souffle.", palette: ["#F5EFE6", "#E5DCC3", "#A8957A"], materials: ["lin écru", "chêne blanc", "céramique blanche", "laine douce"], mood: "calm, bright, natural materials, warm daylight, soft tones" } },
  { slug: "brut", data: { name: "Brut", description: "Métal noir, bois foncé, contrastes francs.", palette: ["#2B2723", "#5C4B3C", "#A18671"], materials: ["métal noir mat", "noyer foncé", "cuir brun", "béton lissé"], mood: "contrasted, industrial soft, masculine sober" } },
  { slug: "bois-clair", data: { name: "Bois clair", description: "Chêne blanc, blanc cassé, tons crayeux.", palette: ["#FFFFFF", "#E8DFD0", "#C9B89A"], materials: ["chêne blanc", "lin blanc", "céramique écrue", "laiton brossé"], mood: "pure, bright, light natural materials, modern scandinavian" } },
  { slug: "vintage", data: { name: "Vintage", description: "Mid-century, couleurs saturées, courbes douces.", palette: ["#C9853E", "#3D6B7C", "#F4E8D8"], materials: ["noyer", "velours moutarde", "laiton", "verre fumé"], mood: "mid-century, retro chic, curves, saturated contrasts" } },
  { slug: "mediterraneen", data: { name: "Méditerranéen", description: "Blanc cassé, terre cuite, lin froissé.", palette: ["#F4EDE0", "#C6855C", "#7A8B6F"], materials: ["terre cuite", "lin brut", "bois peint", "céramique émaillée"], mood: "bright, salty, raw materials, warm simplicity" } },
  { slug: "bohemian", data: { name: "Bohemian", description: "Rotin, ocre, motifs ethniques.", palette: ["#C8703A", "#E8C896", "#5C4632"], materials: ["rotin", "lin brut", "jute", "céramique artisanale"], mood: "warm, layered, travel, artisanal materials" } },
];

const roomDefaults = [
  { slug: "salon", data: { label: "Salon", expectedFurniture: ["canapé", "table basse", "meuble TV", "tapis", "fauteuil", "lampe", "bibliothèque", "accessoires déco"], englishFurniture: "sofa, coffee table, TV stand with TV, rug, armchair, floor lamp, bookshelf, decorative accessories" } },
  { slug: "chambre", data: { label: "Chambre", expectedFurniture: ["lit", "table de chevet", "commode", "tapis", "suspension", "miroir", "rideaux", "accessoires déco"], englishFurniture: "bed, nightstand, dresser, rug, pendant light, mirror, curtains, decorative accessories" } },
];

const floorPresets = [
  { slug: "parquet-droit", data: { label: "Parquet droit", description: "wood parquet, straight planks installed parallel in the same direction, simple alignment, no offset pattern" } },
  { slug: "pose-anglaise", data: { label: "Pose à l'anglaise", description: "wood parquet, STRAIGHT planks in a staggered/offset brick-bond layout, each row shifted by half a plank, all planks parallel in the same direction. NOT herringbone, NOT chevron, no diagonal pattern." } },
  { slug: "chevron", data: { label: "Chevron", description: "wood parquet, herringbone pattern, planks at 90° angle forming a zigzag" } },
  { slug: "point-hongrie", data: { label: "Point de Hongrie", description: "wood parquet, Hungarian point pattern, planks cut at angle forming V-shapes, more refined than herringbone" } },
  { slug: "beton-cire", data: { label: "Béton ciré", description: "polished concrete floor (béton ciré), warm grey tone, matte finish, seamless surface" } },
  { slug: "carrelage", data: { label: "Carrelage", description: "ceramic floor tiles, neutral tone, matte finish" } },
];

const wallPalettes = [
  { slug: "cream", data: { label: "Crème chaud", hex: "#FAF6F0", description: "warm off-white" } },
  { slug: "blanc-casse", data: { label: "Blanc cassé", hex: "#F5EFE6", description: "soft warm white" } },
  { slug: "vert-eau", data: { label: "Vert d'eau", hex: "#A5B8A0", description: "soft water green" } },
  { slug: "sable", data: { label: "Sable", hex: "#E5DCC3", description: "warm sand beige" } },
  { slug: "gris-chaud", data: { label: "Gris chaud", hex: "#9D958A", description: "warm grey" } },
];


async function upsertAssets(
  category: "ambiance" | "room_defaults" | "floor_preset" | "wall_palette",
  items: { slug: string; data: Json }[],
) {
  for (let i = 0; i < items.length; i++) {
    const { error } = await supabase.from("assets").upsert(
      { category, slug: items[i].slug, data: items[i].data, sort_order: i },
      { onConflict: "category,slug" },
    );
    if (error) throw new Error(`assets ${category}/${items[i].slug}: ${error.message}`);
  }
  console.log(`  ✓ ${items.length} ${category}`);
}

// NOTE — ce seed ne couvre QUE les assets de design statiques (ambiances, defaults
// pièce, presets sol, palettes murales). Les autres données sont gérées ailleurs :
//   - prompts            → table `prompts`, éditée via l'admin (/admin/prompts).
//                          (NE PAS re-seeder ici : on régresserait les templates en prod.)
//   - element_category   → scripts/seed-element-categories.mjs
//   - standard_dims / diy_actions → migrations supabase/migrations/
async function seed() {
  console.log("Seeding design assets…");
  await upsertAssets("ambiance", ambiances);
  await upsertAssets("room_defaults", roomDefaults);
  await upsertAssets("floor_preset", floorPresets);
  await upsertAssets("wall_palette", wallPalettes);

  console.log("\nSeed done ✓");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
