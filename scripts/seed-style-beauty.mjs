// RÉFÉRENT BEAUTÉ PAR STYLE — source de vérité du « beau » par collection.
// Deux champs ajoutés à chaque style (data/styles.json + asset ambiance en DB) :
//  - beauty : la direction artistique qui rend un rendu DÉSIRABLE (lumière, textures,
//    composition, styling) — injectée dans le prompt image via loadStyleContext.
//  - avoid  : les pièges/clichés qui enlaidissent ce style — injectés en interdits.
// Écrit en ANGLAIS (consommé par le modèle image). Un rendu doit donner envie
// d'habiter la pièce : styling précis mais habitable, jamais « showroom IA ».
//
// Usage: node scripts/seed-style-beauty.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BEAUTY = {
  scandinave: {
    beauty: "Bright airy daylight, whites warmed by pale oak and wool; one sculptural accent piece; layered soft textiles (sheepskin, chunky knit); everything breathes — generous negative space, nothing pushed against walls",
    avoid: ["grey flatness / clinical showroom feel", "IKEA-catalog uniformity with zero character", "cold blue-white light", "cluttered shelves"],
  },
  japandi: {
    beauty: "Low warm light and deep shadows, tea-stained neutrals; tactile contrast of slatted walnut against bouclé and travertine; sparse composition where each object earns its place; one ikebana branch as the only flourish",
    avoid: ["busy decor or filled shelves", "cool grey minimalism", "glossy lacquered surfaces", "matchy furniture sets"],
  },
  boheme: {
    beauty: "Sun-washed warmth, layered kilims and worn leather, plants cascading at different heights; collected-over-years mix of patinas and origins; warm brass and amber glass catching light",
    avoid: ["floral chintz or grandma wallpaper", "doily / lace fabrics", "flat beige uniformity", "brand-new matching rattan set"],
  },
  boho: {
    beauty: "Light natural fibres — jute, rattan, macramé — over warm white; low-slung seating with generous cushions; sun-bleached palette with terracotta touches; airy, beachy ease",
    avoid: ["floral chintz wallpaper", "heavy dark furniture", "overloaded knick-knacks", "plastic-looking rattan"],
  },
  "mid-century": {
    beauty: "Warm walnut and teak with tapered legs, one saturated accent (mustard, burnt orange) against calm neutrals; iconic silhouettes with breathing room; graphic art and sculptural lighting as jewelry",
    avoid: ["theme-park 50s diner look", "crowding icons together", "orange-brown everything", "fake vintage patina"],
  },
  industriel: {
    beauty: "Moody depth: charcoal metal, worn leather cognac, warm Edison glow against raw textures; generous scale pieces, uncluttered; softened by one plush rug and greenery",
    avoid: ["turning painted walls into fake brick or concrete", "gadget decor (route 66 signs, fake pipes)", "everything black — no warmth", "hangar emptiness"],
  },
  mediterraneen: {
    beauty: "White-warm plaster feel achieved with PAINT only, olive and terracotta accents, natural woods; strong daylight with soft shadows; ceramics and linen, uncluttered surfaces; the calm of a summer house",
    avoid: ["adding arches, niches or beams that don't exist", "kitsch souvenirs (anchors, fishnets)", "saturated blue-white Santorini cliché", "rough plaster texture painted on real walls"],
  },
  haussmannien: {
    beauty: "Elegant contrast of period shell and contemporary pieces; muted sophisticated palette (off-white, sage, camel); one strong modern artwork; herringbone floor and mouldings CELEBRATED when present — light, refined, Parisian",
    avoid: ["adding fake mouldings, fireplaces or ceiling roses", "total antique reconstitution (museum feel)", "gilded Louis XVI pastiche", "heavy drapes"],
  },
  "wabi-sabi": {
    beauty: "Humble materials with visible life — raw wood, unbleached linen, stoneware; muted earth tones in soft north light; asymmetry and emptiness as luxury; every surface matte and tactile",
    avoid: ["polished or glossy anything", "symmetrical staging", "bright saturated colour", "decor abundance"],
  },
  "quiet-luxury": {
    beauty: "Impeccable tailoring: plush neutral textiles (cashmere tones, ivory bouclé), stone and pale wood; soft indirect lighting layers; visible quality in every seam, zero logos, zero clutter — hotel-suite serenity",
    avoid: ["bling (gold chrome, mirror furniture)", "visible brands or ornate patterns", "colour shocks", "sparse cheap-minimal look"],
  },
  "art-deco": {
    beauty: "Rich jewel tones (emerald, sapphire) with brass and dark wood; velvet and marble; strong geometry in textiles and lighting; glamorous but curated — two or three statement pieces, not a casino",
    avoid: ["gold overload / casino vibe", "painting fake geometric murals on every wall", "adding period mouldings or chandeliers to a plain room", "black-gold everything"],
  },
  "cottage-anglais": {
    beauty: "Cosy layered comfort: warm woods, soft plaids, books and ceramics; muted heritage tones (sage, cream, oxblood accents); gentle patterns SMALL and balanced (one armchair, one cushion) — inviting, lived-in, never fussy",
    avoid: ["floral wallpaper covering walls", "chintz on every surface", "doily-grandma accumulation", "dark cluttered Victorian pastiche"],
  },
  "dark-academia": {
    beauty: "Deep bookish warmth: forest green or aubergine walls, dark wood, brass reading lamps, stacked books and art; pools of warm light in a moody room; leather and tweed textures — a private-library intimacy",
    avoid: ["adding fake wall panelling or a fireplace", "halloween gloom (candles everywhere)", "crowding every surface with props", "pitch-black lighting"],
  },
  desert: {
    beauty: "Sun-baked warmth: sand, rust and clay tones on textiles and decor, cacti and dried grasses, leather and raw wood; strong warm light, long shadows; open uncluttered ground — PAINT and objects only, never sculpted walls",
    avoid: ["sculpting adobe niches or curved plaster walls", "southwestern kitsch (skulls, wagon wheels)", "orange-washing every surface", "crowded cactus collection"],
  },
  seventies: {
    beauty: "Sunset palette (burnt orange, ochre, chocolate) on velvet and corduroy; low-slung curved seating; one graphic rug or artwork as the statement; chrome and smoked glass details; warm, cinematic, groovy but composed",
    avoid: ["costume-party psychedelia", "clashing patterns on every surface", "shag carpet everywhere", "brown-on-brown murk"],
  },
  "color-block": {
    beauty: "Confident planes of saturated colour on WALLS ONLY (painted blocks, not paper), balanced by white ground and neutral floor; furniture in solid joyful hues; graphic and gallery-clean — 3 colours maximum, composed like an artwork",
    avoid: ["painting the ceiling or floor blocks", "wallpaper or murals", "more than 3 competing colours", "colour on every single object"],
  },
  memphis: {
    beauty: "Playful primary accents and geometric pattern in SMALL doses (one rug, one artwork, one lamp) on a clean bright ground; sculptural quirky furniture shapes; gallery-like negative space so each piece pops",
    avoid: ["pattern on every surface (visual noise)", "kindergarten primary overload", "cheap plastic look", "cluttered squiggles"],
  },
  maximaliste: {
    beauty: "Rich curated abundance: layered patterns UNIFIED by a controlled palette (2-3 families), gallery walls hung precisely, saturated velvet seating; abundance with intention — every layer deliberate, lighting warm and theatrical",
    avoid: ["hoarder chaos without palette discipline", "clashing undertones (warm+cool jumble)", "covering windows or blocking flow", "flea-market dust feel"],
  },
};

async function main() {
  const path = "data/styles.json";
  const styles = JSON.parse(readFileSync(path, "utf8"));
  let patched = 0;
  for (const s of styles) {
    const b = BEAUTY[s.slug];
    if (!b) { console.warn(`⚠️ pas de référent beauté pour ${s.slug}`); continue; }
    s.data.beauty = b.beauty;
    s.data.avoid = b.avoid;
    patched++;
    const { error } = await sb.from("assets")
      .update({ data: s.data })
      .eq("category", "ambiance")
      .eq("slug", s.slug);
    if (error) throw new Error(`${s.slug}: ${error.message}`);
  }
  writeFileSync(path, JSON.stringify(styles, null, 2) + "\n");
  console.log(`✅ ${patched}/18 styles enrichis (beauty + avoid) — styles.json + assets DB`);
}
main().catch((e) => { console.error("FATAL", e.message ?? e); process.exit(1); });
