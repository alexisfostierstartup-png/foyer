// Seed de la taxonomie d'éléments (assets category="element_category").
// Source UNIQUE des catégories que la détection (vision_detect_extended) peut
// émettre. Hiérarchie famille → type précis (slug feuille en anglais).
// Idempotent : purge la catégorie puis ré-insère. Dimensions = laissées dans
// l'asset `standard_dims` (pas de duplication ici).
//
// Usage: node scripts/seed-element-categories.mjs
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// [slug, label_fr, family, rooms, movable, diy_eligible, catalog_category, extraFlags]
// rooms: "salon" | "chambre" | "any"
const C = (slug, label_fr, family, rooms, movable, diy_eligible, catalog_category, extra = {}) => ({
  slug, data: { label_fr, label_en: slug.replace(/_/g, " "), family, room_types: rooms === "any" ? ["salon", "chambre"] : [rooms], movable, diy_eligible, catalog_category, ...extra },
});

const CATS = [
  // ── ASSISE ──────────────────────────────────────────────────────────────
  C("sofa", "Canapé", "assise", "salon", true, true, "sofa"),
  C("armchair", "Fauteuil", "assise", "any", true, true, "armchair"),
  C("chair", "Chaise", "assise", "any", true, true, null),
  C("dining_chair", "Chaise de salle à manger", "assise", "salon", true, true, null),
  C("bench", "Banc", "assise", "any", true, true, null),
  C("stool", "Tabouret", "assise", "any", true, false, null),
  C("pouf", "Pouf", "assise", "any", true, false, null),
  // ── TABLE ───────────────────────────────────────────────────────────────
  C("coffee_table", "Table basse", "table", "salon", true, true, "coffee_table"),
  C("side_table", "Table d'appoint", "table", "salon", true, true, "side_table"),
  C("dining_table", "Table à manger", "table", "salon", true, true, null),
  C("console_table", "Console", "table", "any", true, true, null),
  C("bar_table", "Table haute / mange-debout", "table", "salon", true, true, null),
  C("desk", "Bureau", "table", "any", true, true, null),
  // ── RANGEMENT ───────────────────────────────────────────────────────────
  C("bookshelf", "Bibliothèque", "rangement", "any", true, true, "bookshelf"),
  C("shelf", "Étagère", "rangement", "any", true, true, null),
  C("tv_stand", "Meuble TV", "rangement", "salon", true, true, "tv_stand"),
  C("dresser", "Commode", "rangement", "chambre", true, true, "dresser"),
  C("sideboard", "Buffet", "rangement", "salon", true, true, null),
  C("wardrobe", "Armoire", "rangement", "chambre", true, true, null),
  C("cabinet", "Meuble de rangement", "rangement", "any", true, true, null),
  C("nightstand", "Table de chevet", "rangement", "chambre", true, true, "nightstand"),
  // ── COUCHAGE ────────────────────────────────────────────────────────────
  C("bed", "Lit", "couchage", "chambre", true, false, "bed"),
  C("headboard", "Tête de lit", "couchage", "chambre", true, true, null),
  C("mattress", "Matelas", "couchage", "chambre", true, false, null),
  // ── LUMINAIRE ───────────────────────────────────────────────────────────
  C("ceiling_light", "Luminaire plafonnier", "luminaire", "any", false, false, "lamp", { fixed_lightpoint: true }),
  C("wall_sconce", "Applique murale", "luminaire", "any", false, false, "lamp", { fixed_lightpoint: true }),
  C("table_lamp", "Lampe de table", "luminaire", "any", true, false, "lamp"),
  C("floor_lamp", "Lampadaire", "luminaire", "any", true, false, "floor_lamp"),
  // ── TEXTILE ─────────────────────────────────────────────────────────────
  C("rug", "Tapis", "textile", "any", true, false, "rug"),
  C("curtains", "Rideaux", "textile", "any", true, false, "curtains"),
  C("cushion", "Coussin", "textile", "any", true, false, "cushion"),
  // ── OUVERTURE ───────────────────────────────────────────────────────────
  C("window", "Fenêtre", "ouverture", "any", false, false, null, { preserve_behind: true }),
  C("french_door", "Porte-fenêtre", "ouverture", "any", false, false, null, { preserve_behind: true }),
  C("door", "Porte", "ouverture", "any", false, false, null),
  // ── SURFACE ─────────────────────────────────────────────────────────────
  C("floor", "Sol", "surface", "any", false, true, "floor_material"),
  C("wall", "Mur", "surface", "any", false, true, "paint"),
  C("ceiling", "Plafond", "surface", "any", false, false, null),
  // ── DÉCO ────────────────────────────────────────────────────────────────
  C("plant", "Plante", "deco", "any", true, false, "plant"),
  C("mirror", "Miroir", "deco", "any", true, false, null),
  C("frame", "Cadre / tableau", "deco", "any", true, false, null),
  C("decor_object", "Objet déco", "deco", "any", true, false, null),
  // ── ÉLECTROMÉNAGER ──────────────────────────────────────────────────────
  C("television", "Téléviseur", "electromenager", "salon", true, false, null),
  C("radiator", "Radiateur", "electromenager", "any", false, false, null, { preserve_behind: true }),
  // ── FALLBACK ────────────────────────────────────────────────────────────
  C("other", "Autre", "autre", "any", true, false, "other"),
];

async function main() {
  console.log(`Seeding ${CATS.length} element_category…`);
  const { error: delErr } = await sb.from("assets").delete().eq("category", "element_category");
  if (delErr) throw delErr;
  const rows = CATS.map((c, i) => ({
    slug: c.slug,
    category: "element_category",
    data: c.data,
    is_active: true,
    sort_order: i,
    notes: c.data.family,
  }));
  const { error: insErr } = await sb.from("assets").insert(rows);
  if (insErr) throw insErr;
  const { count } = await sb.from("assets").select("id", { count: "exact", head: true }).eq("category", "element_category");
  console.log(`✅ ${count} element_category insérées.`);
  // résumé par famille
  const byFam = {};
  for (const c of CATS) byFam[c.data.family] = (byFam[c.data.family] ?? 0) + 1;
  console.log("Familles:", byFam);
}
main().catch((e) => { console.error("FATAL", e.message ?? e); process.exit(1); });
