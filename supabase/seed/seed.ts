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

const prompts = [
  {
    slug: "vision_detect", purpose: "detection" as const, conditions: {}, provider: "gemini_vision" as const,
    notes: "Détection pure : Vision ne décide jamais, il observe.",
    template: `Analyze this interior room photo. Return ONLY a JSON object listing what you observe. Do not give any instruction or recommendation — only describe what is present.

{
  "roomType": "salon | chambre | autre",
  "architecture": {
    "floor": "material and condition",
    "walls": "color, material, condition",
    "ceiling": "description",
    "windows": "count, size, position, light direction",
    "doors": "count, position"
  },
  "detectedElements": [
    {
      "element": "short label",
      "type": "furniture | architectural | fixture | decor",
      "location": "where in the room",
      "description": "color, material, style, condition",
      "movable": true
    }
  ],
  "qualityWarnings": []
}

Rules: List EVERY visible element. "movable": false for built-in/structural. Describe only. Return ONLY the JSON.`,
  },
  {
    slug: "gen_wow_generic", purpose: "generation" as const, conditions: {}, provider: "nano_banana" as const,
    notes: "Prompt génération générique, archi 3 couches. Fallback quand aucun prompt spécifique ne matche les conditions.",
    template: `Here is a photo of an interior room (attached). Furnish and redecorate it into a complete, beautiful, realistic interior in the "{{styleName}}" style. Act as a professional interior designer.

ROOM TYPE: {{roomType}}
ELEMENTS PRESENT — raw detection (JSON): {{visionJson}}
PRIORITY RULE: Every detected element stays in its exact original position. You MAY restyle their finish. Anything you ADD must adapt around these fixed elements.
HOW TO TREAT THE ROOM: A complete {{roomType}} usually includes: {{furnitureDefaults}}. Add whatever is missing.
USER INSTRUCTIONS (hard — override): {{userInstructions}}

Photorealistic, natural daylight, same framing as the original.`,
  },
  {
    slug: "iterate_generic", purpose: "iteration" as const, conditions: {}, provider: "nano_banana" as const,
    notes: "Itération édition localisée. À long terme, basculer sur flux_kontext.",
    template: `This is an EDIT of the attached image, NOT a new generation. Output the SAME room with only ONE element changed.

KEEP 100% IDENTICAL: the whole room, all furniture, walls, lighting, objects, colors, and the exact camera angle, framing and perspective.

THE ONLY CHANGE: {{userRequest}}

Photorealistic interior photograph, same viewpoint as the attached image.`,
  },
  {
    slug: "audit_quality", purpose: "audit" as const, conditions: {}, provider: "gemini_vision" as const,
    notes: "Audit qualité post-génération. Score < 7 = rejet.",
    template: `Compare these two interior images. Image 1 = source photo. Image 2 = generated render.

Return ONLY valid JSON:
{
  "architecturalConsistency": 0-10,
  "furniturePreservation": 0-10,
  "perspectiveMatch": 0-10,
  "sameRoom": true/false,
  "issues": [],
  "overallPass": true/false
}

Score 7+ on each axis = acceptable. "sameRoom" false = critical failure.`,
  },
  {
    slug: "extract_alterations", purpose: "alterations" as const, conditions: {}, provider: "gemini_vision" as const,
    notes: "Compare source et rendu final, extrait la liste des changements pour la liste de courses.",
    template: `Compare these two interior images. Image 1 = original source. Image 2 = final render.

Return ONLY valid JSON:
{
  "alterations": [
    {
      "element": "description of what changed",
      "action": "added | replaced | restyled | painted | floor_changed | removed",
      "category": "sofa | armchair | coffee_table | rug | floor | paint | lamp | etc.",
      "detail": "what specifically",
      "shoppingImpact": "none | to_buy | to_buy_secondhand | diy_material"
    }
  ]
}`,
  },
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

async function seed() {
  console.log("Seeding assets…");
  await upsertAssets("ambiance", ambiances);
  await upsertAssets("room_defaults", roomDefaults);
  await upsertAssets("floor_preset", floorPresets);
  await upsertAssets("wall_palette", wallPalettes);

  console.log("Seeding prompts…");
  for (const p of prompts) {
    // Désactiver l'ancien actif s'il existe
    await supabase.from("prompts").update({ is_active: false })
      .eq("slug", p.slug).eq("purpose", p.purpose).eq("is_active", true);
    // Insérer le nouveau (le trigger snapshot_prompt_version s'en charge)
    const { error } = await supabase.from("prompts").insert({
      slug: p.slug, purpose: p.purpose, conditions: p.conditions,
      provider: p.provider, template: p.template, notes: p.notes, is_active: true,
    });
    if (error) throw new Error(`prompt ${p.slug}: ${error.message}`);
    console.log(`  ✓ ${p.slug} (${p.purpose})`);
  }

  console.log("\nSeed done ✓");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
