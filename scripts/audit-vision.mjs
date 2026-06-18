// AUDIT VISION — diagnostic empirique des prompts du flow Foyer.
// Lecture seule + appels API. Ne touche AUCUNE donnée de prod (pas de projet réel
// modifié). Réplique fidèlement le provider GeminiVision (lib/ai/providers/geminiVision.ts):
//   - SDK @google/genai, model gemini-2.5-flash-lite (flash pour confirm_changes)
//   - responseMimeType json, temperature 0, mediaResolution HIGH, pleine résolution
//
// Usage: node scripts/audit-vision.mjs
import fs from "node:fs/promises";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const FLASH_LITE = "gemini-2.5-flash-lite";
const FLASH = "gemini-2.5-flash";
const GEN_MODEL = "gemini-2.5-flash-image";

const COLOR_WORDS = ["black","white","grey","gray","brown","beige","dark","light","anthracite","charcoal","cream","taupe","ivory","oak","walnut","noir","blanc","gris","marron","beige","fonc","clair","sombre","brun","chêne","chene","crème","creme","bois clair","bois fonc","anthracite","ardoise","écru","ecru"];

async function getPrompt(slug) {
  const { data, error } = await sb.from("prompts").select("template").eq("slug", slug).eq("is_active", true).single();
  if (error) throw new Error(`getPrompt ${slug}: ${error.message}`);
  return data.template;
}

async function loadJpeg(file) {
  return sharp(await fs.readFile(file)).rotate().jpeg({ quality: 92 }).toBuffer();
}

// Réplique lib/ai/pipeline.ts::buildBeforeAfterComposite
async function buildComposite(beforeFile, afterFile) {
  const H = 1024, gap = 24;
  const [b, a] = await Promise.all([
    sharp(await fs.readFile(beforeFile)).rotate().resize({ height: H }).toBuffer(),
    sharp(await fs.readFile(afterFile)).rotate().resize({ height: H }).toBuffer(),
  ]);
  const [mb, ma] = await Promise.all([sharp(b).metadata(), sharp(a).metadata()]);
  const wb = mb.width ?? H, wa = ma.width ?? H;
  return sharp({ create: { width: wb + gap + wa, height: H, channels: 3, background: "#ffffff" } })
    .composite([{ input: b, left: 0, top: 0 }, { input: a, left: wb + gap, top: 0 }])
    .jpeg({ quality: 90 }).toBuffer();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retry sur 503/429/500 (modèle surchargé) — équivalent de lib/ai/retry.ts
async function withRetry(fn, label) {
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const code = e?.status ?? e?.code;
      if (![429, 500, 503].includes(code)) throw e;
      const wait = 2000 * Math.pow(2, attempt);
      console.log(`  ⏳ ${label}: ${code}, retry ${attempt + 1}/5 dans ${wait}ms`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

async function vision(prompt, bufs, model = FLASH_LITE) {
  const parts = [{ text: prompt }];
  for (const b of bufs) parts.push({ inlineData: { data: b.toString("base64"), mimeType: "image/jpeg" } });
  const t0 = Date.now();
  const res = await withRetry(() => ai.models.generateContent({
    model, contents: parts,
    config: { responseMimeType: "application/json", temperature: 0, mediaResolution: "MEDIA_RESOLUTION_HIGH" },
  }), `vision ${model}`);
  let parsed = null; try { parsed = JSON.parse(res.text ?? ""); } catch {}
  return { parsed, text: res.text, ms: Date.now() - t0 };
}

const hasColor = (s = "") => COLOR_WORDS.some((w) => s.toLowerCase().includes(w));

const report = { detection: [], finalAnalysis: [], generation: null };

async function runDetection() {
  const tpl = await getPrompt("vision_detect_extended");
  const imgs = [
    { label: "origin (pièce vide, carrelage anthracite)", file: "public/demo/origin.png", truth: "sol = carrelage gris anthracite ; 1 fenêtre + 1 porte sombre + 1 applique" },
    { label: "final (salon meublé, parquet, TV)", file: "public/demo/final.png", truth: "sol = parquet point de Hongrie bois clair ; TV + meuble TV ; table basse ronde ; canapé+fauteuil blancs ; tapis jute ; rideaux ; boiseries" },
    { label: "landing/before (salon classique)", file: "public/landing/before.jpg", truth: "table basse bois 2 niveaux ; table d'appoint ronde ; bibliothèque ; radiateur fonte ; parquet ; fenêtre haute" },
    { label: "landing/after (salon restylé)", file: "public/landing/after.jpg", truth: "table basse EN VERRE ; table d'appoint ; 2 canapés crème ; plante ; bibliothèque verte ; parquet" },
  ];
  console.log("\n############ DÉTECTION (vision_detect_extended, flash-lite, HIGH) ############");
  for (const im of imgs) {
    const buf = await loadJpeg(im.file);
    const meta = await sharp(buf).metadata();
    const r = await vision(tpl, [buf]);
    const profs = r.parsed?.elementProfiles ?? [];
    const floors = profs.filter((p) => p.category === "floor" || /sol|floor|parquet|carrel/i.test(p.element ?? ""));
    const tvs = profs.filter((p) => /tv|t[ée]l[ée]|television|t[ée]l[ée]viseur/i.test(`${p.element} ${p.description}`));
    const dinings = profs.filter((p) => /dining|à manger|a manger|salle à manger|repas/i.test(`${p.element} ${p.description}`));
    console.log(`\n=== ${im.label} (${meta.width}x${meta.height}, ${im.orientation = meta.width >= meta.height ? "paysage" : "PORTRAIT"}) ===`);
    console.log(`VÉRITÉ: ${im.truth}`);
    console.log(`→ ${profs.length} profils. Catégories: ${profs.map((p) => p.category).join(", ")}`);
    for (const f of floors) console.log(`  FLOOR: cat=${f.category} | desc="${f.description}" | material=${f.material_family} | couleur_présente=${hasColor(f.description) ? "OUI" : "*** NON ***"}`);
    for (const t of tvs) console.log(`  TV-like: element="${t.element}" cat=${t.category} desc="${t.description}"`);
    for (const d of dinings) console.log(`  DINING-like: element="${d.element}" cat=${d.category} desc="${d.description}"`);
    report.detection.push({
      image: im.label, file: im.file, resolution: `${meta.width}x${meta.height}`, orientation: im.orientation,
      truth: im.truth, count: profs.length,
      categories: profs.map((p) => p.category),
      floorColorMissing: floors.filter((f) => !hasColor(f.description)).map((f) => f.description),
      tvLike: tvs.map((t) => ({ element: t.element, category: t.category, description: t.description })),
      diningLike: dinings.map((d) => ({ element: d.element, category: d.category, description: d.description })),
      profiles: profs,
    });
  }
}

async function runFinal() {
  const altTpl = await getPrompt("extract_alterations");
  const confTpl = await getPrompt("confirm_changes");
  const pairs = [
    { label: "origin → final (vide → meublé)", before: "public/demo/origin.png", after: "public/demo/final.png",
      truth: "Changements réels: sol carrelage→parquet ; murs nus→boiseries ; + canapé, fauteuil, table basse, tapis, lampadaire, TV+meuble TV, rideaux, déco. (≈10+ ajouts)" },
    { label: "before → after (restylage)", before: "public/landing/before.jpg", after: "public/landing/after.jpg",
      truth: "Changements réels: bibliothèque sombre→verte ; canapé beige→2 canapés crème ; table basse bois→verre ; tapis motifs→jute ; + plante ; murs ~beige. Parquet ~identique." },
  ];
  console.log("\n############ ANALYSE FINALE (extract_alterations) — variance sur 3 runs ############");
  for (const p of pairs) {
    const comp = await buildComposite(p.before, p.after);
    console.log(`\n=== ${p.label} ===\nVÉRITÉ: ${p.truth}`);
    const runs = [];
    for (let i = 0; i < 3; i++) {
      const r = await vision(altTpl, [comp], FLASH_LITE);
      const alts = r.parsed?.alterations ?? [];
      runs.push(alts);
      console.log(`  [flash-lite run ${i + 1}] ${alts.length} alterations: ${alts.map((a) => `${a.element}(${a.action})`).join(", ")}`);
    }
    // run flash (modèle fort) pour comparer
    const rf = await vision(altTpl, [comp], FLASH);
    const altsF = rf.parsed?.alterations ?? [];
    console.log(`  [FLASH run] ${altsF.length} alterations: ${altsF.map((a) => `${a.element}(${a.action})`).join(", ")}`);
    // confirm_changes (flash) avec un plan synthétique
    const candidates = JSON.stringify([
      { element_id: "floor_1", element: "sol existant", category: "floor", intended_action: "changer pour un parquet bois clair" },
      { element_id: "wall_1", element: "murs", category: "wall", intended_action: "ajouter des moulures / boiseries" },
    ], null, 2);
    const rc = await vision(confTpl.replace("{{candidatesJson}}", candidates), [comp], FLASH);
    console.log(`  [confirm_changes/flash] results=${JSON.stringify(rc.parsed?.results)} | additions=${(rc.parsed?.additions ?? []).map((a) => a.element).join(", ")}`);
    report.finalAnalysis.push({
      pair: p.label, truth: p.truth,
      flashLiteRuns: runs.map((alts) => alts.map((a) => ({ element: a.element, action: a.action, category: a.category, detail: a.detail }))),
      flashRun: altsF.map((a) => ({ element: a.element, action: a.action, category: a.category, detail: a.detail })),
      confirmChanges: rc.parsed,
      counts: { run1: runs[0].length, run2: runs[1].length, run3: runs[2].length, flash: altsF.length },
    });
  }
}

async function runGeneration() {
  console.log("\n############ GÉNÉRATION (best-effort — vérifie si l'image gen marche) ############");
  try {
    const genTpl = await getPrompt("gen_wow_generic");
    const { data: amb } = await sb.from("assets").select("data").eq("category", "ambiance").eq("slug", "doux").single();
    const { data: rd } = await sb.from("assets").select("data").eq("category", "room_defaults").eq("slug", "salon").single();
    const styleName = amb?.data?.name ?? "Doux";
    const styleMood = amb?.data ? `${amb.data.mood}. palette: ${(amb.data.palette ?? []).join(", ")}. materials: ${(amb.data.materials ?? []).join(", ")}` : "calm, bright, natural";
    const furnitureDefaults = rd?.data?.englishFurniture ?? "a sofa, a coffee table, a rug, lighting";
    const srcBuf = await loadJpeg("public/demo/origin.png");
    // détection rapide pour visionJson
    const detTpl = await getPrompt("vision_detect_extended");
    const det = await vision(detTpl, [srcBuf]);
    const prompt = genTpl
      .replaceAll("{{styleName}}", styleName).replaceAll("{{styleMood}}", styleMood)
      .replaceAll("{{roomType}}", "salon").replaceAll("{{furnitureDefaults}}", furnitureDefaults)
      .replaceAll("{{visionJson}}", JSON.stringify(det.parsed, null, 2))
      .replaceAll("{{designPlan}}", "None — restyle freely to fit the style.")
      .replaceAll("{{userInstructions}}", "None — use your judgment within the guidance.");
    const t0 = Date.now();
    const res = await withRetry(() => ai.models.generateContent({ model: GEN_MODEL, contents: [{ text: prompt }, { inlineData: { data: srcBuf.toString("base64"), mimeType: "image/jpeg" } }] }), "gen");
    const parts = res.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p) => p.inlineData?.mimeType?.startsWith("image/"));
    if (imgPart?.inlineData?.data) {
      const out = "scripts/out/gen-origin-doux.png";
      await fs.writeFile(out, Buffer.from(imgPart.inlineData.data, "base64"));
      console.log(`  ✅ Génération OK → ${out} (${Date.now() - t0}ms)`);
      report.generation = { ok: true, out, ms: Date.now() - t0 };
      // analyse origin → render pour observer les soucis de génération
      const comp = await buildComposite("public/demo/origin.png", out);
      const altTpl = await getPrompt("extract_alterations");
      const r = await vision(altTpl, [comp], FLASH);
      console.log(`  origin→render alterations: ${(r.parsed?.alterations ?? []).map((a) => `${a.element}(${a.action})`).join(", ")}`);
      report.generation.renderAlterations = r.parsed?.alterations ?? [];
    } else {
      const txt = parts.find((p) => p.text)?.text;
      console.log(`  ❌ Pas d'image renvoyée. Message: ${txt?.slice(0, 300)}`);
      report.generation = { ok: false, message: txt?.slice(0, 500) };
    }
  } catch (e) {
    console.log(`  ❌ Génération bloquée: ${e.message?.slice(0, 300)}`);
    report.generation = { ok: false, error: e.message?.slice(0, 500) };
  }
}

async function main() {
  await runDetection();
  await runFinal();
  await runGeneration();
  await fs.writeFile("scripts/out/audit-vision-results.json", JSON.stringify(report, null, 2));
  console.log("\n→ scripts/out/audit-vision-results.json écrit.");
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
