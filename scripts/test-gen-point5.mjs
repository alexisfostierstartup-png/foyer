// Test point 5 : avec un designPlan "RESTYLE" sur le canapé (scénario verdict),
// le nouveau gen_wow_generic doit REMPLACER l'assise par une pièce du style, pas
// la recolorer. Source = salon meublé (canapé beige + fauteuils).
import fs from "node:fs/promises";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SRC = "public/landing/before.jpg";
const STYLE_SLUG = "vintage";

async function getPrompt(slug) {
  const { data } = await sb.from("prompts").select("template").eq("slug", slug).eq("is_active", true).single();
  return data.template;
}
async function buildEnum(roomType) {
  const { data } = await sb.from("assets").select("slug,data,sort_order").eq("category", "element_category").eq("is_active", true).order("sort_order");
  const f = (data ?? []).filter((a) => !roomType || !a.data.room_types?.length || a.data.room_types.includes(roomType));
  return f.map((a) => `- ${a.slug} = ${a.data.label_fr}`).join("\n");
}
async function call(model, parts, json) {
  for (let i = 0; i < 5; i++) {
    try {
      return await ai.models.generateContent({ model, contents: parts,
        config: json ? { responseMimeType: "application/json", temperature: 0, mediaResolution: "MEDIA_RESOLUTION_HIGH" } : undefined });
    } catch (e) { if (![429, 500, 503].includes(e?.status)) throw e; await sleep(2000 * 2 ** i); }
  }
}
const img = (b) => ({ inlineData: { data: b.toString("base64"), mimeType: "image/jpeg" } });

async function main() {
  const buf = await sharp(await fs.readFile(SRC)).rotate().jpeg({ quality: 92 }).toBuffer();

  // 1. détection (visionJson)
  const detTpl = (await getPrompt("vision_detect_extended")).replace("{{categories}}", await buildEnum("salon"));
  const det = await call("gemini-2.5-flash-lite", [{ text: detTpl }, img(buf)], true);
  const profiles = JSON.parse(det.text ?? "{}").elementProfiles ?? [];
  console.log(`détection: ${profiles.length} éléments`);

  // 2. style
  const { data: amb } = await sb.from("assets").select("data").eq("category", "ambiance").eq("slug", STYLE_SLUG).single();
  const styleName = amb?.data?.name ?? STYLE_SLUG;
  const styleMood = `${amb?.data?.mood}. palette: ${(amb?.data?.palette ?? []).join(", ")}. materials: ${(amb?.data?.materials ?? []).join(", ")}`;

  // 3. test triptyque 3 dispositions (1 appel)
  const designPlan = "None — restyle freely to fit the style.";

  const genTpl = (await getPrompt("gen_wow_3_dispositions"))
    .replaceAll("{{styleName}}", styleName).replaceAll("{{styleMood}}", styleMood)
    .replaceAll("{{roomType}}", "salon").replaceAll("{{furnitureDefaults}}", "sofa, coffee table, armchair, rug, lighting, bookshelf")
    .replaceAll("{{visionJson}}", JSON.stringify(profiles, null, 2))
    .replaceAll("{{designPlan}}", designPlan)
    .replaceAll("{{userInstructions}}", "None — use your judgment within the guidance.");

  console.log(`Style cible: ${styleName}. designPlan: RESTYLE canapé (doit être REMPLACÉ, pas recoloré).`);
  const res = await call("gemini-2.5-flash-image", [{ text: genTpl }, img(buf)], false);
  const part = (res.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.mimeType?.startsWith("image/"));
  if (part) {
    const out = "scripts/out/gen-point5-vintage.png";
    await fs.writeFile(out, Buffer.from(part.inlineData.data, "base64"));
    console.log(`✅ rendu → ${out}`);
  } else {
    console.log("❌ pas d'image:", (res.candidates?.[0]?.content?.parts ?? []).find((p) => p.text)?.text?.slice(0, 300));
  }
}
main().catch((e) => { console.error("FATAL", e.message ?? e); process.exit(1); });
