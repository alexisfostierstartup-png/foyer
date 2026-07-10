#!/usr/bin/env node
/**
 * DISTILLATION DES RÉFÉRENCES DE STYLE (public/style-refs/<slug>_<n>.jpg)
 * → référent v2 par style : la sélection d'images d'Alexis devient le
 * mood/palette/materials/signature/beauty/avoid du style (source de vérité du
 * goût, au lieu de priors génériques).
 *
 * RÉVERSIBLE : les champs v1 sont sauvegardés dans data.referent_v1 au premier
 * passage ; `--revert` les restaure (et réactive cottage-anglais / désactive
 * campagne-francaise).
 *
 * Cas particuliers :
 *  - campagne-france_* → NOUVEAU style "campagne-francaise" (clone de
 *    cottage-anglais, qu'on désactive) — demande Alexis : moins kitsch.
 *  - boheme et boho = deux styles DB distincts, pas de fusion.
 *
 * Usage : node scripts/distill-style-refs.mjs [--only=seventies,boheme] [--revert] [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { readdir, readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";

const REFS_DIR = "public/style-refs";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ai = new GoogleGenAI({ apiKey: process.env.NANO_BANANA_API_KEY || process.env.GEMINI_API_KEY });
const MODEL = "gemini-flash-latest";

const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
const revert = process.argv.includes("--revert");
const dry = process.argv.includes("--dry");

// slug dossier → slug DB (campagne-france = nouveau style remplaçant cottage-anglais)
const SLUG_MAP = { "campagne-france": "campagne-francaise" };
const NEW_STYLES = {
  "campagne-francaise": { cloneFrom: "cottage-anglais", name: "Campagne française",
    description: "Pierre, lin lavé et bois patiné — la maison de famille dans son jus, sans le kitsch." },
};

async function getAsset(slug) {
  const { data, error } = await sb.from("assets").select("*").eq("category", "ambiance").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`${slug}: ${error.message}`);
  return data;
}

async function revertAll() {
  const { data: rows } = await sb.from("assets").select("*").eq("category", "ambiance");
  for (const row of rows ?? []) {
    if (NEW_STYLES[row.slug]) {
      await sb.from("assets").update({ is_active: false }).eq("id", row.id);
      const src = NEW_STYLES[row.slug].cloneFrom;
      await sb.from("assets").update({ is_active: true }).eq("category", "ambiance").eq("slug", src);
      console.log(`↩︎ ${row.slug} désactivé, ${src} réactivé`);
    } else if (row.data?.referent_v1) {
      const { referent_v1, referent_version, referent_source, ...rest } = row.data;
      await sb.from("assets").update({ data: { ...rest, ...referent_v1 } }).eq("id", row.id);
      console.log(`↩︎ ${row.slug} restauré en v1`);
    }
  }
}

async function distill(slug, files) {
  const parts = [{
    text:
      `You are the artistic director of a home-redesign product. The attached photos are CURATED references the founder ` +
      `finds gorgeous for the interior style "${slug}". Distill what they have in common into a REUSABLE style referent ` +
      `for an image-generation prompt.\n` +
      `Strict JSON: {"mood": "<1 vivid sentence, English>", "palette": [5-7 precise colour names], ` +
      `"materials": [4-6], "signature": [5-7 concrete RECOGNIZABLE elements — furniture shapes, textiles, decor; ` +
      `NEVER architectural features (no fireplace, mouldings, parquet pattern, beams — those depend on the client's room)], ` +
      `"beauty": "<2-3 sentences: the art direction of a successful render — light, composition, what makes it desirable>", ` +
      `"avoid": [3-5 traps that make this style ugly or kitsch — infer from what these photos deliberately do NOT do]}`,
  }];
  for (const f of files) {
    const buf = await sharp(await readFile(path.join(REFS_DIR, f))).resize(1024, 1024, { fit: "inside" }).jpeg({ quality: 82 }).toBuffer();
    parts.push({ inlineData: { mimeType: "image/jpeg", data: buf.toString("base64") } });
  }
  const res = await ai.models.generateContent({
    model: MODEL, contents: parts,
    config: { responseMimeType: "application/json", temperature: 0.2 },
  });
  return JSON.parse(res.text ?? "{}");
}

async function main() {
  if (revert) return revertAll();

  const all = await readdir(REFS_DIR);
  const groups = new Map();
  for (const f of all) {
    const m = f.toLowerCase().match(/^([a-z0-9-]+)_\d+\.(jpe?g|png|webp)$/);
    if (!m) { console.warn(`ignoré (nom non conforme): ${f}`); continue; }
    const slug = SLUG_MAP[m[1]] ?? m[1];
    if (only && !only.includes(slug)) continue;
    if (!groups.has(slug)) groups.set(slug, []);
    groups.get(slug).push(f);
  }

  for (const [slug, files] of groups) {
    let asset = await getAsset(slug);
    const isNew = !asset && NEW_STYLES[slug];
    if (!asset && !isNew) { console.warn(`⚠️ ${slug}: pas d'asset DB, ignoré`); continue; }

    console.log(`\n=== ${slug} (${files.length} images)${isNew ? " [NOUVEAU]" : ""}`);
    const v2 = await distill(slug, files);
    if (!v2.mood || !Array.isArray(v2.palette) || !v2.beauty) { console.error(`  ✗ distillation invalide, skip`); continue; }
    console.log(`  palette: ${v2.palette.join(", ")}`);
    console.log(`  beauty:  ${v2.beauty.slice(0, 140)}…`);
    console.log(`  avoid:   ${(v2.avoid ?? []).join(" · ").slice(0, 140)}`);
    if (dry) continue;

    if (isNew) {
      const src = await getAsset(NEW_STYLES[slug].cloneFrom);
      if (!src) { console.error(`  ✗ source ${NEW_STYLES[slug].cloneFrom} introuvable`); continue; }
      const data = {
        ...src.data, ...v2, name: NEW_STYLES[slug].name, description: NEW_STYLES[slug].description,
        moodboardUrl: `/style-refs/${files[0]}`,
        referent_version: "v2", referent_source: `style-refs ${new Date().toISOString().slice(0, 10)}`,
        referent_v1: null,
      };
      await sb.from("assets").insert({ category: "ambiance", slug, data, is_active: true, sort_order: src.sort_order });
      await sb.from("assets").update({ is_active: false }).eq("id", src.id);
      console.log(`  ✓ créé (clone ${NEW_STYLES[slug].cloneFrom}, désactivé)`);
    } else {
      const backup = asset.data.referent_v1 ?? {
        mood: asset.data.mood, palette: asset.data.palette, materials: asset.data.materials,
        signature: asset.data.signature, beauty: asset.data.beauty, avoid: asset.data.avoid,
      };
      const data = { ...asset.data, ...v2, referent_v1: backup, referent_version: "v2",
        referent_source: `style-refs ${new Date().toISOString().slice(0, 10)}` };
      await sb.from("assets").update({ data }).eq("id", asset.id);
      console.log(`  ✓ v2 posé (v1 sauvegardé)`);
    }
  }
  console.log(`\nRevert complet : node scripts/distill-style-refs.mjs --revert`);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
