#!/usr/bin/env npx tsx
/**
 * BENCH DE FIDÉLITÉ DE STYLE — génère le rendu "quick create" (gen_wow_generic,
 * plan vide = restyle libre, colorway par défaut) pour CHAQUE photo de base ×
 * CHAQUE style, puis fait juger chaque rendu par Gemini Vision (fidélité au
 * style, palette, éléments signature, doublons, interpénétrations, architecture
 * inventée). Sort un results.json + un report.html (grille visuelle).
 *
 * Réplique fidèlement l'assemblage de runGenerationPipeline (lib/ai/pipeline.ts)
 * SANS créer de projets : détection vision 1× par photo (réutilisée pour tous
 * les styles), puis 1 génération par (photo × style).
 *
 * Usage :
 *   npx tsx scripts/bench-styles.ts --images=bench/base [--styles=japandi,scandinave]
 *                                   [--room=salon] [--out=bench/out] [--dry] [--concurrency=3]
 *
 * Coût indicatif : N_images × N_styles générations d'image (~$0.04/u) + autant
 * d'appels juge flash (~$0.002/u) + 1 détection par photo. 12×18 ≈ $9-10.
 * Les appels sont tracés dans ai_calls sous project_id "bench-styles-<runId>".
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

type Judge = {
  style_fidelity: number;
  palette_match: number;
  signature_elements_present: string[];
  signature_elements_missing: string[];
  duplicated_items: string[];
  placement_issues: string[];
  architecture_issues: string[];
  desirability?: number;
  beauty_flaws?: string[];
  mirror_issues?: string[];
  hallucinations: string[];
  perspective_changed: boolean;
  verdict: "pass" | "warn" | "fail";
  comment: string;
};

type BenchResult = {
  image: string;
  style: string;
  renderFile: string | null;
  durationMs: number;
  error?: string;
  judge?: Judge;
};

function arg(name: string, def?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}

// Pool de concurrence minimal (pas de dépendance).
async function pool<T>(items: T[], size: number, fn: (item: T, i: number) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const { detectElementProfiles, buildFixedFeaturesSummary, buildRemoveList, constraintsToChoices } =
    await import("../lib/ai/pipeline");
  const { loadStyleContext, loadRoomDefaults, loadRoomRemoveCategories, formatUserInstructions } =
    await import("../lib/prompts/helpers");
  const { resolvePrompt } = await import("../lib/prompts/engine");
  const { getImageProvider, getVisionProvider } = await import("../lib/ai/provider");

  const imagesDir = path.resolve(arg("images", "bench/base")!);
  const roomType = arg("room", "salon")!;
  const dry = process.argv.includes("--dry");
  const concurrency = Number(arg("concurrency", "3"));
  const runId = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const outDir = path.resolve(arg("out", `bench/out-${runId}`)!);
  const projectId = `bench-styles-${runId}`;

  const stylesJson = JSON.parse(await readFile(path.join(process.cwd(), "data/styles.json"), "utf8"));
  const allSlugs: string[] = (Array.isArray(stylesJson) ? stylesJson : stylesJson.styles).map(
    (s: { slug: string }) => s.slug,
  );
  const styles = arg("styles") ? arg("styles")!.split(",").map((s) => s.trim()) : allSlugs;
  const unknown = styles.filter((s) => !allSlugs.includes(s));
  if (unknown.length) throw new Error(`Styles inconnus: ${unknown.join(", ")} (dispo: ${allSlugs.join(", ")})`);

  const files = (await readdir(imagesDir))
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort();
  if (!files.length) throw new Error(`Aucune image dans ${imagesDir}`);

  console.log(`Bench: ${files.length} photos × ${styles.length} styles = ${files.length * styles.length} rendus`);
  console.log(`Sortie: ${outDir}\nTracking ai_calls project_id: ${projectId}`);
  if (dry) {
    for (const f of files) for (const s of styles) console.log(`- ${f} × ${s}`);
    return;
  }
  await mkdir(outDir, { recursive: true });

  // Contexte partagé (identique pour tous les rendus d'une même pièce).
  const furnitureDefaults = await loadRoomDefaults(roomType);
  const removeCategories = await loadRoomRemoveCategories(roomType);
  // Contraintes par défaut du quick flow (mêmes valeurs que la page /create).
  const userInstructions = await formatUserInstructions(
    constraintsToChoices({
      floor: { note: "", change: false, preset: null },
      walls: { frames: false, repaint: false, moldings: false, moldingStyle: "classique" },
      furniture: {},
      accessories: "cosy",
    } as never),
  );

  // 1) Détection vision — 1× par photo, réutilisée pour tous les styles.
  const detectionByFile = new Map<string, Awaited<ReturnType<typeof detectElementProfiles>>>();
  for (const f of files) {
    const buf = await readFile(path.join(imagesDir, f));
    console.log(`[detect] ${f}…`);
    const profiles = await detectElementProfiles(projectId, buf, `bench:${f}`, roomType);
    detectionByFile.set(f, profiles);
    console.log(`[detect] ${f}: ${profiles.length} éléments`);
  }

  // 2) Générations + juge (pipeline par combo, pas de barrière entre combos).
  const combos = files.flatMap((image) => styles.map((style) => ({ image, style })));
  const results: BenchResult[] = [];

  await pool(combos, concurrency, async ({ image, style }) => {
    const label = `${path.parse(image).name}__${style}`;
    const t0 = Date.now();
    try {
      const profiles = detectionByFile.get(image)!;
      const { styleName, styleMood } = await loadStyleContext(style, { colorwayIndex: 0, lockWalls: false });
      const genCtx = {
        styleName,
        styleMood,
        roomType,
        furnitureDefaults,
        visionJson: JSON.stringify(profiles, null, 2),
        fixedFeatures: await buildFixedFeaturesSummary(profiles),
        removeList: buildRemoveList(profiles, removeCategories),
        userInstructions,
        designPlan: "None — restyle freely to fit the style.",
      };
      const genPrompt = await resolvePrompt("gen_wow_generic", genCtx, { strict: false });
      const buf = await readFile(path.join(imagesDir, image));
      const gen = await getImageProvider(genPrompt.prompt.provider).generateFromText(genPrompt.resolvedTemplate, buf);
      const ext = gen.mimeType.includes("png") ? "png" : "jpg";
      const renderFile = `${label}.${ext}`;
      await writeFile(path.join(outDir, renderFile), gen.imageBuffer);
      console.log(`[gen] ${label} ok (${Math.round((Date.now() - t0) / 1000)}s)`);

      // Juge : beauté/désirabilité + fidélité + rédhibitoire seulement (calibrage
      // validé avec Alexis : fail = hallucination majeure/archi/laideur flagrante,
      // pas les détails de placement soft).
      const judgePrompt = `Tu es un directeur artistique en design d'intérieur, exigeant sur le BEAU et factuel sur les défauts.
IMAGE 1 = photo ORIGINALE de la pièce. IMAGE 2 = rendu redesigné censé être dans le style "${styleName}".
Référent du style (dont "craft" = ce qui le rend beau, "NEVER" = ses pièges): ${styleMood}

Évalue IMAGE 2 et réponds en JSON STRICT (aucun texte hors JSON):
{
 "desirability": <0-10, envie d'habiter cette pièce : lumière, cohérence de palette, matières réalistes, styling — 8+ = digne d'un magazine, 5 = correct mais froid/plat, <4 = moche ou artificiel>,
 "style_fidelity": <0-10, à quel point le rendu incarne ce style précis (pas un style générique "moderne beige")>,
 "palette_match": <0-10, adhérence à la palette canonique ci-dessus>,
 "beauty_flaws": [<ce qui empêche le rendu d'être désirable : lumière plate, palette incohérente, matière plastique, piège "NEVER" du style présent…>],
 "signature_elements_present": [<éléments signature du style réellement visibles dans le rendu>],
 "signature_elements_missing": [<éléments signature attendus mais absents>],
 "duplicated_items": [<objets du rendu qui DUPLIQUENT un objet déjà présent (ex. 2e lampadaire à côté d'un lampadaire)>],
 "mirror_issues": [<reflets incohérents : objet visible dans un miroir mais absent de la pièce, reflet impossible>],
 "placement_issues": [<défauts physiques: objet qui en traverse un autre, objet flottant, meuble bloquant une porte/passage, échelle aberrante>],
 "architecture_issues": [<vs IMAGE 1: fenêtre/porte/poutre/cheminée/mur/niche ajoutée, supprimée ou déplacée; pièce agrandie>],
 "hallucinations": [<objets impossibles, artefacts (IGNORE les watermarks d'agence type leboncoin — assumés)>],
 "perspective_changed": <true si le point de vue/cadrage diffère sensiblement de IMAGE 1>,
 "verdict": "<fail UNIQUEMENT pour un RÉDHIBITOIRE : architecture inventée/supprimée, doublon de luminaire, objet halluciné majeur, desirability<4 ou style méconnaissable | warn = défauts mineurs | pass = fidèle, beau, sans défaut majeur. Un reflet de miroir IMPARFAIT n'est PAS un défaut (assumé) — ne le signale que s'il est absurde>",
 "comment": "<2 phrases max, en français>"
}`;
      const judgeRes = await getVisionProvider("gemini_vision").analyze(
        judgePrompt,
        [await readFile(path.join(imagesDir, image)), gen.imageBuffer],
        { model: "gemini-2.5-flash" },
      );
      let judge = judgeRes.parsed as Judge | null;
      if (!judge || typeof judge !== "object") {
        const m = judgeRes.text.match(/\{[\s\S]*\}/);
        judge = m ? (JSON.parse(m[0]) as Judge) : undefined!;
      }
      results.push({ image, style, renderFile, durationMs: Date.now() - t0, judge: judge ?? undefined });
      console.log(
        `[judge] ${label}: beau ${judge?.desirability}/10, fidélité ${judge?.style_fidelity}/10, verdict ${judge?.verdict}${judge?.mirror_issues?.length ? `, miroirs: ${judge.mirror_issues.length}` : ""}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[FAIL] ${label}: ${msg}`);
      results.push({ image, style, renderFile: null, durationMs: Date.now() - t0, error: msg });
    }
    await writeFile(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
  });

  // 3) Rapport HTML (grille par photo, synthèse par style).
  await writeFile(path.join(outDir, "report.html"), buildReport(files, styles, results));
  console.log(`\n✅ Terminé: ${results.filter((r) => !r.error).length}/${results.length} rendus.`);
  console.log(`Rapport: open ${path.join(outDir, "report.html")}`);
}

function buildReport(files: string[], styles: string[], results: BenchResult[]): string {
  const by = (img: string, st: string) => results.find((r) => r.image === img && r.style === st);
  const esc = (s: unknown) => String(s ?? "").replace(/</g, "&lt;");
  const badge = (v?: string) =>
    v === "pass" ? "#22a06b" : v === "warn" ? "#e2a336" : v === "fail" ? "#d64545" : "#999";

  // Synthèse par style (moyennes + défauts cumulés) — la "big picture".
  const styleRows = styles
    .map((st) => {
      const rs = results.filter((r) => r.style === st && r.judge);
      const avg = (f: (j: Judge) => number) =>
        rs.length ? (rs.reduce((a, r) => a + f(r.judge!), 0) / rs.length).toFixed(1) : "—";
      const count = (f: (j: Judge) => unknown[]) => rs.reduce((a, r) => a + f(r.judge!).length, 0);
      const fails = rs.filter((r) => r.judge!.verdict === "fail").length;
      return { st, fid: avg((j) => j.style_fidelity), pal: avg((j) => j.palette_match), dup: count((j) => j.duplicated_items), pla: count((j) => j.placement_issues), arc: count((j) => j.architecture_issues), fails, n: rs.length };
    })
    .sort((a, b) => Number(a.fid) - Number(b.fid));

  const summary = `<h2>Synthèse par style (trié du pire au meilleur)</h2>
<table><tr><th>Style</th><th>Fidélité /10</th><th>Palette /10</th><th>Doublons</th><th>Placement</th><th>Archi</th><th>Fails</th><th>N</th></tr>
${styleRows.map((r) => `<tr><td><b>${r.st}</b></td><td>${r.fid}</td><td>${r.pal}</td><td>${r.dup}</td><td>${r.pla}</td><td>${r.arc}</td><td>${r.fails}</td><td>${r.n}</td></tr>`).join("\n")}</table>`;

  const grids = files
    .map((img) => {
      const cells = styles
        .map((st) => {
          const r = by(img, st);
          if (!r) return "";
          if (r.error) return `<div class="cell err"><div class="hd">${st}</div><div class="body">ERREUR: ${esc(r.error)}</div></div>`;
          const j = r.judge;
          const issues = j
            ? [...(j.duplicated_items || []).map((x) => `🔁 ${x}`), ...(j.placement_issues || []).map((x) => `📐 ${x}`), ...(j.architecture_issues || []).map((x) => `🏗 ${x}`), ...(j.hallucinations || []).map((x) => `👻 ${x}`)]
            : [];
          return `<div class="cell"><div class="hd">${st} <span class="badge" style="background:${badge(j?.verdict)}">${j?.verdict ?? "?"}</span> <span class="score">${j?.style_fidelity ?? "?"}/10</span></div>
<a href="${r.renderFile}" target="_blank"><img loading="lazy" src="${r.renderFile}"></a>
<div class="body">${esc(j?.comment)}${issues.length ? `<ul>${issues.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : ""}</div></div>`;
        })
        .join("\n");
      return `<h2>${img}</h2><div class="row"><div class="cell"><div class="hd">ORIGINAL</div><img loading="lazy" src="../base/${img}"></div>${cells}</div>`;
    })
    .join("\n");

  return `<!doctype html><meta charset="utf-8"><title>Bench styles Foyer</title>
<style>
body{font:14px/1.4 -apple-system,sans-serif;margin:20px;background:#141414;color:#eee}
table{border-collapse:collapse;margin:12px 0}td,th{border:1px solid #444;padding:4px 10px}
.row{display:flex;gap:10px;overflow-x:auto;padding-bottom:8px}
.cell{flex:0 0 340px;background:#1e1e1e;border-radius:8px;overflow:hidden}
.cell img{width:100%;display:block}.hd{padding:6px 8px;font-weight:600}
.badge{color:#fff;border-radius:4px;padding:1px 6px;font-size:12px}.score{float:right}
.body{padding:6px 8px;color:#bbb;font-size:12px}.err .body{color:#f88}
ul{margin:6px 0 0 16px;padding:0}
</style>
<h1>Bench fidélité styles — ${new Date().toISOString().slice(0, 10)}</h1>
${summary}
${grids}`;
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
