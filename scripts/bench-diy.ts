#!/usr/bin/env npx tsx
/**
 * BENCH DIY BETA — rejoue N sessions complètes du flux réel :
 *   création projet (photo uploadée en storage, diyMode=beta) → runAnalysisPipeline
 *   (détection + verdict DIY) → runGenerationPipeline (prompt gen_wow_generic_diy_beta)
 *   → juge Gemini qui vérifie CHAQUE décision (keep intact / customize = même objet
 *   nouvelle finition / replace = autre modèle) + color wash global.
 *
 * Usage :
 *   npx tsx scripts/bench-diy.ts --images=bench/base [--out=bench/out-diy] [--concurrency=2]
 *
 * Les projets créés sont taggés anon_id="bench-diy" (nettoyage facile).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

type DecisionCheck = {
  element_id: string;
  expected: string;
  applied: "yes" | "no" | "partial";
  note: string;
};
type Judge = {
  decisions: DecisionCheck[];
  color_wash: boolean;
  major_issues: string[];
  verdict: "pass" | "warn" | "fail";
  comment: string;
};
type SessionResult = {
  image: string;
  style: string;
  projectId: string;
  renderFile: string | null;
  plan: { element_id: string; category: string; description: string; expected: string }[];
  durationMs: number;
  error?: string;
  judge?: Judge;
};

function arg(name: string, def?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}

async function pool<T>(items: T[], size: number, fn: (item: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i], i);
      }
    }),
  );
}

// Styles variés (roulement) — le DIY dépend surtout des meubles présents, le style
// pilote le verdict (garder/customiser/remplacer selon l'affinité).
const STYLES = [
  "scandinave", "japandi", "boheme", "industriel", "seventies",
  "haussmannien", "wabi-sabi", "color-block", "mid-century", "art-deco",
];

async function main() {
  const sharp = (await import("sharp")).default;
  const { nanoid } = await import("nanoid");
  const { createProject, buildStorageFolder, updateProject, getProject } = await import("../lib/storage/projects");
  const { saveSourceImage } = await import("../lib/ai/saveRender");
  const { runAnalysisPipeline, runGenerationPipeline } = await import("../lib/ai/pipeline");
  const { getRenderableActionSlugs } = await import("../lib/diy/rules");
  const { getVisionProvider } = await import("../lib/ai/provider");
  const { UPLOAD_MAX_DIMENSION } = await import("../lib/constants");

  const imagesDir = path.resolve(arg("images", "bench/base")!);
  const concurrency = Number(arg("concurrency", "2"));
  const runId = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const outDir = path.resolve(arg("out", `bench/out-diy-${runId}`)!);
  await mkdir(outDir, { recursive: true });

  const onlyImages = arg("only")?.split(",").map((s) => s.trim());
  const styleList = arg("styles")?.split(",").map((s) => s.trim()) ?? STYLES;
  const files = (await readdir(imagesDir))
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .filter((f) => !onlyImages || onlyImages.some((o) => f.startsWith(o)))
    .sort();
  // --only=test1,test2 + --styles=seventies → produit cartésien images × styles.
  // Sans arguments : 1 session par photo avec roulement de styles, complété à 10.
  const sessions = arg("only") || arg("styles")
    ? files.flatMap((image) => styleList.map((style) => ({ image, style })))
    : Array.from({ length: Math.max(10, files.length) }, (_, i) => ({
        image: files[i % files.length],
        style: styleList[i % styleList.length],
      }));
  const renderableSlugs = new Set(await getRenderableActionSlugs());
  console.log(`Bench DIY: ${sessions.length} sessions → ${outDir}`);
  sessions.forEach((s, i) => console.log(`  #${i + 1} ${s.image} × ${s.style}`));

  const results: SessionResult[] = [];

  await pool(sessions, concurrency, async ({ image, style }, i) => {
    const label = `s${String(i + 1).padStart(2, "0")}_${path.parse(image).name}__${style}`;
    const t0 = Date.now();
    let projectId = "";
    try {
      // 1) Création projet — même chemin que app/api/upload/route.ts.
      const input = await readFile(path.join(imagesDir, image));
      const photo = await sharp(input).rotate().resize({ width: UPLOAD_MAX_DIMENSION, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
      projectId = nanoid();
      const storageFolder = buildStorageFolder(undefined, projectId);
      const basePhotoUrl = await saveSourceImage(photo, storageFolder);
      await createProject("salon" as never, basePhotoUrl, storageFolder, undefined, projectId, "bench-diy");
      await updateProject(projectId, {
        diyMode: "beta",
        selectedStyleId: style,
        userConstraints: {
          floor: { note: "", change: false, preset: null },
          walls: { frames: false, repaint: false, moldings: false, moldingStyle: "classique" },
          furniture: {},
          accessories: "cosy",
        },
      } as never);

      // 2) Analyse (détection + verdict DIY) puis génération (slug diy_beta auto).
      await runAnalysisPipeline(projectId);
      const afterAnalysis = await getProject(projectId);
      const decisions = (afterAnalysis?.element_decisions ?? []) as {
        element_id: string; description: string; category: string;
        mismatch_type: string; action_slug: string | null; action_label_en: string | null; action_label: string | null;
      }[];
      // Remaster déco 2026-07-10 : la petite déco non alignée est RETIRÉE (pas remplacée).
      const DECOR = new Set(["decor_object", "frame", "mirror", "plant", "cushion"]);
      const plan = decisions.map((d) => {
        const expected =
          d.mismatch_type === "none"
            ? "KEEP — objet inchangé (même objet, même couleur, même place)"
            : d.mismatch_type === "surface" && d.action_slug && renderableSlugs.has(d.action_slug)
              ? `RESTYLE (${d.action_label_en ?? d.action_label ?? d.action_slug}) — MÊME objet, seule cette finition change, uniforme`
              : DECOR.has(d.category)
                ? "REMOVE — objet retiré de la pièce, SANS remplacement obligatoire (surface nue OK ; une nouvelle déco du style ailleurs est OK aussi)"
                : "REPLACE — objet clairement différent au même emplacement";
        return { element_id: d.element_id, category: d.category, description: d.description, expected };
      });
      console.log(`[${label}] analyse: ${decisions.length} décisions (${plan.filter((p) => p.expected.startsWith("RESTYLE")).length} RESTYLE)`);

      await runGenerationPipeline(projectId);
      const done = await getProject(projectId);
      const renderUrl = done?.generatedRenderUrl;
      if (!renderUrl) throw new Error("Pas de render généré");
      const renderBuf = Buffer.from(await (await fetch(renderUrl)).arrayBuffer());
      const renderFile = `${label}.png`;
      await writeFile(path.join(outDir, renderFile), renderBuf);
      console.log(`[${label}] render ok (${Math.round((Date.now() - t0) / 1000)}s)`);

      // 3) Juge — vérifie chaque décision. Calibrage : fail = rédhibitoire seulement.
      const judgePrompt = `Tu es contrôleur qualité de rendus de rénovation. IMAGE 1 = photo originale, IMAGE 2 = rendu.
Le rendu devait appliquer EXACTEMENT ce plan par élément :
${JSON.stringify(plan, null, 2)}

Pour CHAQUE élément du plan, vérifie dans IMAGE 2 :
- KEEP : l'objet original est-il présent, inchangé (même objet, même couleur, même place) ?
- RESTYLE (action) : est-ce le MÊME objet (même forme/structure/position) avec UNIQUEMENT la finition décrite changée, appliquée uniformément ? (un objet différent = "no")
- REPLACE : y a-t-il un objet CLAIREMENT différent au même emplacement ? (le même objet recoloré = "no")
- REMOVE : l'objet original a-t-il DISPARU ? ("yes" s'il n'est plus là — aucun remplacement requis ; "no" s'il est toujours présent)

Réponds en JSON STRICT:
{
 "decisions": [{"element_id": "...", "expected": "<KEEP|RESTYLE|REPLACE>", "applied": "<yes|no|partial>", "note": "<court, seulement si no/partial>"}],
 "color_wash": <true si une teinte globale est plaquée sur toute la scène au lieu de changements par objet>,
 "major_issues": [<UNIQUEMENT le rédhibitoire: architecture ajoutée/supprimée (mur, fenêtre, porte, escalier, chauffe-eau, cheminée), objet qui en traverse un autre, pièce méconnaissable, perspective changée>],
 "verdict": "<pass si plan globalement appliqué et zéro rédhibitoire | warn si écarts mineurs | fail UNIQUEMENT si rédhibitoire ou plan massivement ignoré>",
 "comment": "<2 phrases max en français>"
}`;
      // Le modèle juge sort parfois un JSON invalide (variance) → 1 retry.
      let judge: Judge | null = null;
      for (let attempt = 0; attempt < 2 && !judge; attempt++) {
        const judgeRes = await getVisionProvider("gemini_vision").analyze(
          judgePrompt,
          [photo, renderBuf],
          { model: "gemini-2.5-flash" },
        );
        judge = judgeRes.parsed as Judge | null;
        if (!judge || typeof judge !== "object") {
          try {
            const m = judgeRes.text.match(/\{[\s\S]*\}/);
            judge = m ? (JSON.parse(m[0]) as Judge) : null;
          } catch {
            judge = null;
            if (attempt === 0) console.warn(`[${label}] juge JSON invalide, retry…`);
          }
        }
      }
      if (!judge) throw new Error("juge: JSON invalide après retry");
      results.push({ image, style, projectId, renderFile, plan, durationMs: Date.now() - t0, judge: judge ?? undefined });
      const ko = judge?.decisions?.filter((d) => d.applied !== "yes").length ?? "?";
      console.log(`[${label}] juge: verdict ${judge?.verdict}, ${ko} décision(s) non conformes, color_wash=${judge?.color_wash}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[FAIL] ${label}: ${msg}`);
      results.push({ image, style, projectId, renderFile: null, plan: [], durationMs: Date.now() - t0, error: msg });
    }
    await writeFile(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
  });

  const ok = results.filter((r) => !r.error);
  const allChecks = ok.flatMap((r) => r.judge?.decisions ?? []);
  console.log(`\n✅ ${ok.length}/${results.length} sessions.`);
  console.log(`Décisions vérifiées: ${allChecks.length} — conformes: ${allChecks.filter((d) => d.applied === "yes").length}, partielles: ${allChecks.filter((d) => d.applied === "partial").length}, non appliquées: ${allChecks.filter((d) => d.applied === "no").length}`);
  console.log(`Color wash: ${ok.filter((r) => r.judge?.color_wash).length}, fails: ${ok.filter((r) => r.judge?.verdict === "fail").length}`);
  console.log(`Résultats: ${path.join(outDir, "results.json")}`);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
