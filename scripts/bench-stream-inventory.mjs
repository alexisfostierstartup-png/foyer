// Banc d'essai levier 3 (streaming) — AUCUN code produit touché.
// Compare, sur le MÊME prompt d'inventaire (variante lean prod) et la MÊME photo :
//   A. generateContent        → un mur : tout arrive à la fin
//   B. generateContentStream  → éléments parsés au fil de l'eau (temps du 1er, de chaque suivant)
// Usage : npx tsx scripts/bench-stream-inventory.mjs [chemin/photo.jpg]
import { GoogleGenAI } from "@google/genai";
import { readFile } from "fs/promises";
import { config } from "dotenv";
config({ path: ".env.local" });

const MODEL = "gemini-2.5-flash-lite";
const IMG = process.argv[2] ?? "public/uploads/vGNSt9A1km8Dqb0T9U635.jpg";

const CATEGORIES = [
  "sofa", "armchair", "chair", "dining_chair", "dining_table", "bed", "wardrobe", "dresser",
  "bookshelf", "tv_stand", "coffee_table", "side_table", "nightstand", "shelf", "floor",
  "wall", "ceiling", "window", "door", "headboard", "bench", "rug", "lamp", "table_lamp",
  "ceiling_light", "plant", "frame", "mirror", "curtains", "decor_object", "other",
].map((c) => `- ${c} = ${c}`).join("\n");

// Réplique du prompt render_inventory prod (vision_detect_extended + BBOX_SUFFIX + lean).
const PROMPT = `Analyse cette photo de pièce intérieure avec précision.

Retourne UNIQUEMENT un JSON valide (sans texte avant/après) avec cette structure exacte :
{
  "elementProfiles": [
    {
      "element_id": "string (identifiant court unique, ex: sofa_1)",
      "element": "string (type en minuscules)",
      "category": "string — le slug EXACT choisi dans la liste CATÉGORIES ci-dessous",
      "description": "string (description concise en français)",
      "color": "string (couleur dominante, TOUJOURS renseignée)",
      "movable": true
    }
  ],
  "qualityWarnings": []
}

CATÉGORIES AUTORISÉES :
${CATEGORIES}

EN PLUS, ajoute à CHAQUE élément : (1) "bbox": [x, y, w, h] valeurs 0-1, cadre SERRÉ ; (2) "color_hex": couleur dominante "#rrggbb".
SORTIE ALLÉGÉE : OMETS les champs "material_family", "surface_features", "condition" et "dims".`;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const imgB64 = (await readFile(IMG)).toString("base64");
const parts = [
  { text: PROMPT },
  { inlineData: { data: imgB64, mimeType: "image/jpeg" } },
];
const genConfig = {
  responseMimeType: "application/json",
  temperature: 0,
  mediaResolution: "MEDIA_RESOLUTION_HIGH",
};

// Extraction incrémentale : compte les objets {…} COMPLETS au 1er niveau du tableau
// elementProfiles dans un buffer JSON partiel.
function countCompleteElements(buf) {
  const start = buf.indexOf('"elementProfiles"');
  if (start === -1) return 0;
  let depth = 0, count = 0, inStr = false, esc = false;
  for (let i = buf.indexOf("[", start) + 1; i > 0 && i < buf.length; i++) {
    const ch = buf[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) count++; }
    else if (ch === "]" && depth === 0) break;
  }
  return count;
}

async function runStream() {
  const t0 = Date.now();
  const marks = [];
  let buf = "", firstChunk = null, seen = 0;
  const stream = await ai.models.generateContentStream({ model: MODEL, contents: parts, config: genConfig });
  for await (const chunk of stream) {
    if (firstChunk === null) firstChunk = Date.now() - t0;
    buf += chunk.text ?? "";
    const n = countCompleteElements(buf);
    while (seen < n) { seen++; marks.push({ el: seen, ms: Date.now() - t0 }); }
  }
  return { total: Date.now() - t0, firstChunk, marks, elements: seen };
}

async function runBlocking() {
  const t0 = Date.now();
  const res = await ai.models.generateContent({ model: MODEL, contents: parts, config: genConfig });
  const n = countCompleteElements(res.text ?? "");
  return { total: Date.now() - t0, elements: n };
}

// Retry basique : Gemini 503 « high demand » fréquent aujourd'hui.
async function withRetry(fn, label) {
  for (let i = 0; i < 5; i++) {
    try {
      return await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/503|UNAVAILABLE|high demand|overloaded|429/i.test(msg) || i === 4) throw e;
      const wait = 2000 * (i + 1);
      console.log(`   (${label}: 503, retry dans ${wait / 1000}s)`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

console.log(`Photo: ${IMG} — modèle ${MODEL} (HIGH, lean)\n`);
for (let round = 1; round <= 2; round++) {
  console.log(`── Round ${round} ──`);
  const s = await withRetry(runStream, "stream");
  const firstEl = s.marks[0]?.ms ?? null;
  const mid = s.marks[Math.floor(s.marks.length / 2)]?.ms ?? null;
  console.log(`STREAM   : ${s.elements} éléments en ${s.total} ms | 1er chunk ${s.firstChunk} ms | 1er élément ${firstEl} ms | médian ${mid} ms`);
  console.log(`           arrivées: ${s.marks.map((m) => `#${m.el}@${(m.ms / 1000).toFixed(1)}s`).join(" ")}`);
  const b = await withRetry(runBlocking, "bloquant");
  console.log(`BLOQUANT : ${b.elements} éléments en ${b.total} ms (tout à la fin)\n`);
}
