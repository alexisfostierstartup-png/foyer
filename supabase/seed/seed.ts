import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../lib/db/database.types";

// Load .env.local
import { config } from "dotenv";
config({ path: ".env.local" });

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Source canonique des ambiances : data/styles.json (aussi utilisée pour la
// validation API). Modifier un style = éditer le JSON puis relancer ce seed.
import stylesData from "../../data/styles.json";

const ambiances = stylesData as { slug: string; data: Json }[];

// Anciens slugs v0 remplacés par le set canonique (mediterraneen est réutilisé).
// On les désactive au lieu de les supprimer : les vieux projets restent résolubles
// par loadStyleContext (qui ne filtre pas is_active).
const LEGACY_AMBIANCE_SLUGS = ["doux", "brut", "bois-clair", "vintage", "bohemian"];

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

  const { error: legacyErr } = await supabase
    .from("assets")
    .update({ is_active: false })
    .eq("category", "ambiance")
    .in("slug", LEGACY_AMBIANCE_SLUGS);
  if (legacyErr) throw new Error(`legacy ambiance deactivation: ${legacyErr.message}`);
  console.log(`  ✓ ${LEGACY_AMBIANCE_SLUGS.length} legacy ambiances désactivées`);
  await upsertAssets("room_defaults", roomDefaults);
  await upsertAssets("floor_preset", floorPresets);
  await upsertAssets("wall_palette", wallPalettes);

  console.log("\nSeed done ✓");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
