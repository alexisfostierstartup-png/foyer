// Vérifie que vision_detect_extended (DB-driven {{categories}}) fait émettre au
// modèle les nouveaux types précis. Réplique l'injection du pipeline.
import fs from "node:fs/promises";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function buildEnum(roomType) {
  const { data } = await sb.from("assets").select("slug,data,sort_order").eq("category", "element_category").eq("is_active", true).order("sort_order");
  const filtered = (data ?? []).filter((a) => !roomType || !a.data.room_types?.length || a.data.room_types.includes(roomType));
  return filtered.map((a) => `- ${a.slug} = ${a.data.label_fr}`).join("\n");
}

async function vision(prompt, buf) {
  for (let i = 0; i < 5; i++) {
    try {
      const res = await ai.models.generateContent({ model: "gemini-2.5-flash-lite", contents: [{ text: prompt }, { inlineData: { data: buf.toString("base64"), mimeType: "image/jpeg" } }], config: { responseMimeType: "application/json", temperature: 0, mediaResolution: "MEDIA_RESOLUTION_HIGH" } });
      return JSON.parse(res.text ?? "null");
    } catch (e) { if (![429, 500, 503].includes(e?.status)) throw e; await sleep(2000 * 2 ** i); }
  }
}

async function main() {
  const { data: p } = await sb.from("prompts").select("template").eq("slug", "vision_detect_extended").single();
  const enumStr = await buildEnum("salon");
  console.log("=== {{categories}} injecté (salon) ===\n" + enumStr + "\n");
  const prompt = p.template.replace("{{categories}}", enumStr);
  for (const f of ["public/demo/final.png", "public/landing/before.jpg"]) {
    const buf = await sharp(await fs.readFile(f)).rotate().jpeg({ quality: 92 }).toBuffer();
    const r = await vision(prompt, buf);
    const profs = r?.elementProfiles ?? [];
    console.log(`\n### ${f} → ${profs.length} éléments`);
    for (const e of profs) console.log(`  ${e.category.padEnd(16)} | color=${(e.color ?? "∅").padEnd(18)} | ${e.element}`);
  }
}
main().catch((e) => { console.error("FATAL", e.message ?? e); process.exit(1); });
