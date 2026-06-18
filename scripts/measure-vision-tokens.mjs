// Mesure coût + qualité de la détection vision Gemini en fonction de la résolution
// d'entrée. Usage:
//   node scripts/measure-vision-tokens.mjs
// Variables: GEMINI_API_KEY, SUPABASE (via .env.local)
//
// Pour chaque image et chaque palier de résolution (côté long), on:
//  - redimensionne via sharp (fit inside, jpeg q85)
//  - mesure largeur×hauteur + poids octets
//  - appelle gemini-2.5-flash-lite (temperature 0) avec le PROMPT VERDICT réel
//  - lit promptTokenCount / candidatesTokenCount réels (usageMetadata)
//  - calcule le coût (prix officiels ET prix actuels en base)
//  - parse le JSON de détection et résume les éléments
//
// Ne touche à AUCUNE image de production. Lecture seule + appels API.

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const MODEL = "gemini-2.5-flash-lite";

// Paliers de résolution (côté long, px). 0 = natif (pas de resize).
const DIMS = [0, 1568, 1280, 1024, 768, 512];

// Prix OFFICIELS (vérifiés doc Google juin 2026), $/1M tokens
const OFFICIAL = { in: 0.1, out: 0.4 };
// Prix ACTUELS en base (lib/ai/pricing.ts) — inclut le poste fantôme per_image_in
const APP = { in: 0.1, out: 0.4, perImageIn: 0.001316 };
const USD_EUR = 0.92; // approx pour lecture; les chiffres clés restent en $

const IMAGES = [
  { label: "SIMPLE (render1)", file: "public/demo/render1.png" },
  { label: "CHARGEE (after)", file: "public/landing/after.jpg" },
];

function tileEstimate(w, h) {
  // Modèle Gemini 2.x: <=384px sur les 2 côtés => 258 tokens.
  // Sinon découpage en tuiles ~768px, 258 tokens/tuile.
  if (w <= 384 && h <= 384) return { tiles: 1, tokens: 258 };
  const tiles = Math.ceil(w / 768) * Math.ceil(h / 768);
  return { tiles, tokens: tiles * 258 };
}

async function buildVerdictPrompt(sb) {
  const { data, error } = await sb
    .from("diy_actions")
    .select("slug,label,applies_to_categories");
  if (error) throw new Error("diy_actions: " + error.message);
  const allActionsJson = JSON.stringify(
    (data ?? []).map((a) => ({
      slug: a.slug,
      label: a.label,
      applies_to_categories: a.applies_to_categories,
    })),
    null,
    2,
  );

  const { data: prow, error: perr } = await sb
    .from("prompts")
    .select("template")
    .eq("slug", "vision_analyze_full")
    .eq("is_active", true)
    .single();
  if (perr) throw new Error("prompt: " + perr.message);

  // Contexte style réaliste (ambiance "doux")
  const styleName = "Doux";
  const styleMood =
    "calm, bright, natural materials, warm daylight, soft tones. palette: #F5EFE6, #E5DCC3, #A8957A. materials: lin, bois clair, lainage";

  return prow.template
    .replace("{{styleName}}", styleName)
    .replace("{{styleMood}}", styleMood)
    .replace("{{allActionsJson}}", allActionsJson);
}

async function resizeImage(buf, maxDim) {
  let pipe = sharp(buf).rotate();
  if (maxDim && maxDim > 0) {
    pipe = pipe.resize({
      width: maxDim,
      height: maxDim,
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  const out = await pipe.jpeg({ quality: 85 }).toBuffer();
  const meta = await sharp(out).metadata();
  return { out, w: meta.width, h: meta.height };
}

function summarizeElements(parsed) {
  const els = parsed?.elements ?? [];
  return els
    .map((e) => ({
      id: e.element_id,
      element: e.element,
      category: e.category,
      material: e.material_family,
      surface: e.surface_features ?? [],
      mismatch: e.mismatch_type,
      action: e.action_slug,
    }))
    .sort((a, b) => String(a.element).localeCompare(String(b.element)));
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY manquant");
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const prompt = await buildVerdictPrompt(sb);
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: { responseMimeType: "application/json", temperature: 0 },
  });

  // Tokens texte seul (isole la contribution image)
  const textOnly = await model.countTokens([prompt]);
  console.log(`\n# Prompt verdict: ${prompt.length} chars`);
  console.log(`# Tokens texte seul (countTokens): ${textOnly.totalTokens}\n`);

  const results = [];

  for (const img of IMAGES) {
    const raw = await fs.readFile(img.file);
    const nativeMeta = await sharp(raw).metadata();
    console.log(`\n========== ${img.label} — natif ${nativeMeta.width}x${nativeMeta.height} ==========`);

    for (const dim of DIMS) {
      const { out, w, h } = await resizeImage(raw, dim);
      const est = tileEstimate(w, h);
      const t0 = Date.now();
      const res = await model.generateContent([
        prompt,
        { inlineData: { data: out.toString("base64"), mimeType: "image/jpeg" } },
      ]);
      const ms = Date.now() - t0;
      const meta = res.response.usageMetadata ?? {};
      const inTok = meta.promptTokenCount ?? 0;
      const outTok = meta.candidatesTokenCount ?? 0;
      const imageTok = inTok - textOnly.totalTokens;

      let parsed = null;
      try {
        parsed = JSON.parse(res.response.text());
      } catch {
        parsed = null;
      }
      const els = summarizeElements(parsed);

      const costOfficial =
        (inTok / 1e6) * OFFICIAL.in + (outTok / 1e6) * OFFICIAL.out;
      const costApp =
        (inTok / 1e6) * APP.in + (outTok / 1e6) * APP.out + APP.perImageIn;

      const row = {
        image: img.label,
        maxDim: dim === 0 ? "natif" : dim,
        resolution: `${w}x${h}`,
        bytesKB: +(out.length / 1024).toFixed(0),
        estTiles: est.tiles,
        estImageTokens: est.tokens,
        promptTokenCount: inTok,
        imageTokensMeasured: imageTok,
        candidatesTokenCount: outTok,
        costOfficialUSD: +costOfficial.toFixed(6),
        costAppUSD: +costApp.toFixed(6),
        costAppEUR: +(costApp * USD_EUR).toFixed(6),
        latencyMs: ms,
        nbElements: els.length,
        elements: els,
      };
      results.push(row);
      console.log(
        `  ${String(row.maxDim).padEnd(6)} ${row.resolution.padEnd(10)} ${String(row.bytesKB + "KB").padEnd(7)} ` +
          `in=${inTok} (img≈${imageTok}, est${est.tokens}/${est.tiles}t) out=${outTok} ` +
          `| $off=${row.costOfficialUSD} $app=${row.costAppUSD} | ${els.length} elts | ${ms}ms`,
      );
    }
  }

  const outPath = path.join("scripts", "out", "vision-token-results.json");
  await fs.writeFile(outPath, JSON.stringify({ textOnlyTokens: textOnly.totalTokens, results }, null, 2));
  console.log(`\n→ Résultats détaillés (JSON complet) écrits dans ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
