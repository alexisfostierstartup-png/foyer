// Diagnostic coût réel des appels vision : usageMetadata COMPLET (dont thinking
// tokens), sur les vrais prompts détection (vision_detect_extended) et verdict
// (verdict_elements), en chaînant détection -> getCandidateActions -> verdict.
//
// Sert à : (1) voir si Gemini renvoie des thoughtsTokenCount facturés en plus ;
// (2) comparer coût FUSIONNÉ (vision_analyze_full) vs SÉPARÉ (détection+verdict).
//
// Usage: node scripts/measure-detection-verdict.mjs
// Lecture seule + appels API. Ne touche aucune donnée de prod.

import fs from "node:fs/promises";
import sharp from "sharp";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const MODEL = "gemini-2.5-flash-lite";
const STYLE = {
  id: "doux",
  name: "Doux",
  mood: "calm, bright, natural materials, warm daylight, soft tones. palette: #F5EFE6, #E5DCC3, #A8957A",
};
const IMAGES = [
  { label: "SIMPLE (render1)", file: "public/demo/render1.png" },
  { label: "CHARGEE (after)", file: "public/landing/after.jpg" },
];

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function model() {
  return genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: { responseMimeType: "application/json" },
  });
}

async function getPrompt(slug) {
  const { data, error } = await sb
    .from("prompts")
    .select("template")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();
  if (error) throw new Error(`${slug}: ${error.message}`);
  return data.template;
}

// Port JS de lib/diy/rules.ts::getCandidateActions (filtre déterministe)
function matchesRequires(req, p) {
  if (req?.material_family?.length && !req.material_family.includes(p.material_family)) return false;
  if (req?.surface_features?.length && !req.surface_features.some((f) => (p.surface_features ?? []).includes(f))) return false;
  if (req?.condition?.length && !req.condition.includes(p.condition)) return false;
  return true;
}
function matchesExcludes(exc, p) {
  if (exc?.material_family?.length && exc.material_family.includes(p.material_family)) return true;
  if (exc?.surface_features?.length && exc.surface_features.some((f) => (p.surface_features ?? []).includes(f))) return true;
  if (exc?.condition?.length && exc.condition.includes(p.condition)) return true;
  return false;
}
async function getCandidateActions(profile, styleId, allActions) {
  return allActions
    .filter((a) => (a.applies_to_categories ?? []).includes(profile.category))
    .filter((a) => matchesRequires(a.requires, profile) && !matchesExcludes(a.excludes, profile))
    .sort((a, b) => (b.style_affinity?.[styleId] ?? 0) - (a.style_affinity?.[styleId] ?? 0))
    .slice(0, 10);
}

function dumpUsage(u) {
  // tous les champs renvoyés par l'API (dont thoughtsTokenCount si présent)
  return {
    promptTokenCount: u?.promptTokenCount ?? 0,
    candidatesTokenCount: u?.candidatesTokenCount ?? 0,
    thoughtsTokenCount: u?.thoughtsTokenCount ?? 0,
    cachedContentTokenCount: u?.cachedContentTokenCount ?? 0,
    totalTokenCount: u?.totalTokenCount ?? 0,
    _rawKeys: Object.keys(u ?? {}),
  };
}

// Coût officiel flash-lite : in $0.10/1M, out $0.40/1M. Les thinking tokens sont
// facturés au tarif OUTPUT chez Google → on les ajoute à l'output pour le coût.
function cost(u) {
  const inTok = u.promptTokenCount;
  const outTok = u.candidatesTokenCount + u.thoughtsTokenCount;
  return (inTok / 1e6) * 0.1 + (outTok / 1e6) * 0.4;
}

async function call(prompt, imgBuf) {
  const t0 = Date.now();
  const res = await model().generateContent([
    prompt,
    { inlineData: { data: imgBuf.toString("base64"), mimeType: "image/jpeg" } },
  ]);
  const u = dumpUsage(res.response.usageMetadata);
  let parsed = null;
  try { parsed = JSON.parse(res.response.text()); } catch {}
  return { u, parsed, ms: Date.now() - t0 };
}

async function main() {
  const [detTpl, verdictTpl, fusedTpl] = await Promise.all([
    getPrompt("vision_detect_extended"),
    getPrompt("verdict_elements"),
    getPrompt("vision_analyze_full"),
  ]);
  const { data: allActions } = await sb.from("diy_actions").select("*").eq("is_active", true);
  const allActionsJson = JSON.stringify(
    allActions.map((a) => ({ slug: a.slug, label: a.label, applies_to_categories: a.applies_to_categories })), null, 2,
  );

  const out = [];
  for (const img of IMAGES) {
    const raw = await fs.readFile(img.file);
    // resize 1024 côté long pour matcher la prod (upload cape déjà à 1024)
    const buf = await sharp(raw).rotate().resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    const meta = await sharp(buf).metadata();
    console.log(`\n================= ${img.label} (${meta.width}x${meta.height}) =================`);

    // ---- FUSIONNÉ (état actuel) ----
    const fused = await call(
      fusedTpl.replace("{{styleName}}", STYLE.name).replace("{{styleMood}}", STYLE.mood).replace("{{allActionsJson}}", allActionsJson),
      buf,
    );
    console.log(`\n[FUSIONNÉ vision_analyze_full]`, JSON.stringify(fused.u));
    console.log(`  coût=$${cost(fused.u).toFixed(6)} | ${fused.parsed?.elements?.length ?? "?"} elts | ${fused.ms}ms`);

    // ---- SÉPARÉ : Appel 1 DÉTECTION ----
    const det = await call(detTpl, buf);
    const profiles = det.parsed?.elementProfiles ?? [];
    console.log(`\n[DÉTECTION vision_detect_extended]`, JSON.stringify(det.u));
    console.log(`  coût=$${cost(det.u).toFixed(6)} | ${profiles.length} profils | ${det.ms}ms`);

    // ---- Entre les deux : getCandidateActions par élément ----
    const candidateMap = [];
    for (const p of profiles) {
      const cands = await getCandidateActions(p, STYLE.id, allActions);
      candidateMap.push({ element_id: p.element_id, category: p.category, candidates: cands.map((c) => ({ slug: c.slug, label: c.label })) });
    }
    const elementsJson = JSON.stringify(profiles.map((p) => ({ element_id: p.element_id, element: p.element, category: p.category, description: p.description, material_family: p.material_family, surface_features: p.surface_features, condition: p.condition })), null, 2);
    const candidateActionsJson = JSON.stringify(candidateMap, null, 2);
    const totalCands = candidateMap.reduce((s, c) => s + c.candidates.length, 0);
    console.log(`  getCandidateActions: ${profiles.length} éléments → ${totalCands} actions candidates (vs ${allActions.length} dispo). candidateActionsJson=${candidateActionsJson.length} chars`);

    // ---- Appel 2 VERDICT (texte seul + image pour rester comparable au provider vision) ----
    const verdictPrompt = verdictTpl
      .replace("{{styleName}}", STYLE.name).replace("{{styleMood}}", STYLE.mood)
      .replace("{{elementsJson}}", elementsJson).replace("{{candidateActionsJson}}", candidateActionsJson);
    const verdict = await call(verdictPrompt, buf);
    console.log(`\n[VERDICT verdict_elements]`, JSON.stringify(verdict.u));
    console.log(`  coût=$${cost(verdict.u).toFixed(6)} | ${verdict.parsed?.decisions?.length ?? "?"} décisions | ${verdict.ms}ms`);

    const sepCost = cost(det.u) + cost(verdict.u);
    const fusedCost = cost(fused.u);
    console.log(`\n  >>> FUSIONNÉ=$${fusedCost.toFixed(6)}  vs  SÉPARÉ=$${sepCost.toFixed(6)}  (surcoût séparation: $${(sepCost - fusedCost).toFixed(6)})`);

    out.push({ image: img.label, resolution: `${meta.width}x${meta.height}`, fused: { usage: fused.u, cost: fusedCost }, detection: { usage: det.u, cost: cost(det.u), profiles: profiles.length }, candidates: { totalCands, allActions: allActions.length }, verdict: { usage: verdict.u, cost: cost(verdict.u) }, separatedCost: sepCost });
  }
  await fs.writeFile("scripts/out/detection-verdict-results.json", JSON.stringify(out, null, 2));
  console.log(`\n→ scripts/out/detection-verdict-results.json`);
}
main().catch((e) => { console.error(e); process.exit(1); });
