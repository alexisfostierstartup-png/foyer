// Mesure du CACHE IMPLICITE Gemini selon l'ordre des parts — AUCUN code produit touché.
// Hypothèse : [image, texte] fait de l'image (le gros du prefill) un préfixe commun
// entre deux appels sur la même photo (détection à l'upload puis verdict à la review)
// → le 2e appel réutilise le prefill (usageMetadata.cachedContentTokenCount > 0).
// Usage : npx tsx scripts/bench-implicit-cache.mjs [chemin/photo.jpg]
import { GoogleGenAI } from "@google/genai";
import { readFile } from "fs/promises";
import { config } from "dotenv";
config({ path: ".env.local" });

const MODEL = "gemini-2.5-flash-lite";
const IMG = process.argv[2] ?? "public/uploads/vGNSt9A1km8Dqb0T9U635.jpg";

// Deux prompts DIFFÉRENTS (comme détection puis verdict) : seul le préfixe image est commun.
const PROMPT_A = `Analyse cette photo de pièce. Retourne UNIQUEMENT un JSON {"elements":[{"element_id":"string","element":"string","description":"string","color":"string"}]} listant les meubles et surfaces visibles.`;
const PROMPT_B = `Pour chaque meuble visible dans cette photo, retourne UNIQUEMENT un JSON {"verdicts":[{"element":"string","fits_japandi":true,"reason":"string"}]} : dis s'il s'accorde à un style japandi (bois clair, épuré, zen).`;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const imgB64 = (await readFile(IMG)).toString("base64");
const image = { inlineData: { data: imgB64, mimeType: "image/jpeg" } };
const genConfig = { responseMimeType: "application/json", temperature: 0, mediaResolution: "MEDIA_RESOLUTION_HIGH" };

async function call(parts, label) {
  for (let i = 0; i < 6; i++) {
    try {
      const t0 = Date.now();
      const res = await ai.models.generateContent({ model: MODEL, contents: parts, config: genConfig });
      const u = res.usageMetadata ?? {};
      console.log(
        `${label}: ${Date.now() - t0} ms | prompt ${u.promptTokenCount ?? "?"} tok | ` +
        `CACHÉ ${u.cachedContentTokenCount ?? 0} tok | out ${u.candidatesTokenCount ?? "?"} tok`,
      );
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/503|UNAVAILABLE|high demand|429/i.test(msg) || i === 5) throw e;
      await new Promise((r) => setTimeout(r, 2500 * (i + 1)));
    }
  }
}

console.log(`Photo: ${IMG} — ${MODEL} HIGH\n`);
console.log("── Ordre ACTUEL [texte, image] — 2 appels, prompts différents ──");
await call([{ text: PROMPT_A }, image], "détection");
await call([{ text: PROMPT_B }, image], "verdict  ");

console.log("\n── Ordre IMAGE D'ABORD [image, texte] — préfixe image commun ──");
await call([image, { text: PROMPT_A }], "détection");
await call([image, { text: PROMPT_B }], "verdict  ");
console.log("\n(un cachedContentTokenCount élevé au 2e appel image-first = cache implicite actif)");
