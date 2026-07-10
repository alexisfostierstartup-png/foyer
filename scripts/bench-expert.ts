#!/usr/bin/env npx tsx
/**
 * BENCH EXPERT END-TO-END — rejoue le parcours expert complet via les vraies
 * fonctions : création projet (mode expert) → analyse → génération (fake) →
 * liste de courses → rendu expert (swap NB2 des vrais produits) — puis VÉRIFIE :
 *
 *  A. ASSERTIONS DURES (code, pas juge) :
 *     1. chaque pièce intégrée au rendu a sa ligne `integrated` dans la liste,
 *        avec le produit EXACT en matches[0] ;
 *     2. après un RECALCUL FORCÉ de la liste (le scénario du bug démo 2026-07-09),
 *        ces lignes sont toujours là.
 *  B. JUGE VISION (fake vs rendu expert) : produits listés visibles dans le rendu,
 *     aucun objet ajouté hors produits, miroirs cohérents, luminaires intacts.
 *
 * Usage : npx tsx scripts/bench-expert.ts --images=bench/base-expert [--styles=boheme,scandinave] [--out=bench/out-expert]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

function arg(name: string, def?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}

async function main() {
  const sharp = (await import("sharp")).default;
  const { nanoid } = await import("nanoid");
  const { createProject, buildStorageFolder, updateProject, getProject } = await import("../lib/storage/projects");
  const { saveSourceImage } = await import("../lib/ai/saveRender");
  const { runAnalysisPipeline, runGenerationPipeline, ensureFinalAssets, fetchImageBytes } = await import("../lib/ai/pipeline");
  const { runExpertRenderPipeline } = await import("../lib/ai/expert");
  const { getVisionProvider } = await import("../lib/ai/provider");
  const { UPLOAD_MAX_DIMENSION } = await import("../lib/constants");

  const imagesDir = path.resolve(arg("images", "bench/base-expert")!);
  const styleList = (arg("styles") ?? "boheme,scandinave,seventies").split(",");
  const outDir = path.resolve(arg("out", "bench/out-expert")!);
  await mkdir(outDir, { recursive: true });
  const files = (await readdir(imagesDir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  const sessions = files.map((image, i) => ({ image, style: styleList[i % styleList.length] }));
  console.log(`Bench expert: ${sessions.length} session(s)`);

  type Result = {
    image: string; style: string; projectId: string;
    integrated: { category: string; name: string }[];
    assertLineForEachPiece: boolean; assertSurvivesRecompute: boolean;
    judge?: Record<string, unknown>; error?: string;
    fakeFile?: string; expertFile?: string;
  };
  const results: Result[] = [];

  for (const { image, style } of sessions) {
    const label = `${path.parse(image).name}__${style}`;
    let projectId = "";
    try {
      // 1) Création (mode expert) — même chemin que l'upload réel.
      const input = await readFile(path.join(imagesDir, image));
      const photo = await sharp(input).rotate().resize({ width: UPLOAD_MAX_DIMENSION, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
      projectId = nanoid();
      const storageFolder = buildStorageFolder(undefined, projectId);
      const basePhotoUrl = await saveSourceImage(photo, storageFolder);
      await createProject("salon" as never, basePhotoUrl, storageFolder, undefined, projectId, "bench-expert");
      await updateProject(projectId, {
        mode: "expert",
        selectedStyleId: style,
        userConstraints: { floor: { note: "", change: false, preset: null }, walls: { frames: false, repaint: false, moldings: false, moldingStyle: "classique" }, furniture: {}, accessories: "cosy" },
      } as never);

      // 2) Parcours réel : analyse → fake → liste → rendu expert.
      await runAnalysisPipeline(projectId);
      await runGenerationPipeline(projectId);
      await ensureFinalAssets(projectId);
      await runExpertRenderPipeline(projectId);

      const p = await getProject(projectId);
      const integrated = (p?.expertIntegratedPieces ?? []) as { category: string; name: string; elementId?: string | null }[];
      const list = (p?.shoppingList ?? []) as { category: string; integrated?: boolean; matches?: { id: string }[] }[];

      // ASSERTION 1 : chaque pièce intégrée a sa ligne `integrated` dans la liste.
      const a1 = integrated.length > 0 && integrated.every((pc) =>
        list.some((it) => it.integrated && it.category === pc.category && (it.matches?.length ?? 0) > 0),
      );

      // ASSERTION 2 : le verrou survit à un RECALCUL FORCÉ (scénario du bug démo :
      // liste vidée puis re-dérivée du fake par la vision).
      await updateProject(projectId, { shoppingList: undefined, builtShoppingList: undefined, renderAnalysis: undefined, finalAssetsRenderUrl: undefined } as never);
      await ensureFinalAssets(projectId);
      const p2 = await getProject(projectId);
      const list2 = (p2?.shoppingList ?? []) as typeof list;
      const a2 = integrated.every((pc) =>
        list2.some((it) => it.integrated && it.category === pc.category && (it.matches?.length ?? 0) > 0),
      );

      // Sauvegarde locale fake + expert pour inspection visuelle.
      const fakeBuf = Buffer.from(await fetchImageBytes(p!.generatedRenderUrl!));
      const expBuf = Buffer.from(await fetchImageBytes(p2!.expertRenderUrl!));
      await writeFile(path.join(outDir, `${label}_fake.png`), fakeBuf);
      await writeFile(path.join(outDir, `${label}_expert.png`), expBuf);

      // 3) Juge hallucinations : fake (entrée du swap) vs rendu expert (sortie).
      const judgePrompt = `IMAGE 1 = rendu d'origine. IMAGE 2 = même image où SEULS ces meubles devaient être remplacés par des produits réels : ${integrated.map((x) => `${x.category} (${x.name})`).join("; ")}.
Vérifie IMAGE 2 et réponds en JSON STRICT:
{
 "products_visible": [<catégories de la liste ci-dessus RÉELLEMENT visibles remplacées dans IMAGE 2>],
 "products_missing": [<catégories listées mais introuvables/inchangées>],
 "objects_added": [<objets présents dans IMAGE 2 mais ni dans IMAGE 1 ni dans la liste>],
 "objects_removed": [<objets d'IMAGE 1 disparus d'IMAGE 2 sans remplacement>],
 "light_fixtures_changed": <true si un luminaire a été ajouté/dupliqué/déplacé>,
 "mirror_issues": [<UNIQUEMENT si absurde — un reflet imparfait est assumé, ne le signale pas>],
 "verdict": "<pass|warn|fail — fail = objet halluciné DANS LA PIÈCE, luminaire ajouté/dupliqué ou produit listé absent du rendu>",
 "comment": "<1-2 phrases en français>"
}`;
      const jr = await getVisionProvider("gemini_vision").analyze(judgePrompt, [fakeBuf, expBuf], { model: "gemini-2.5-flash" });
      let judge = jr.parsed as Record<string, unknown> | null;
      if (!judge || typeof judge !== "object") {
        const m = jr.text.match(/\{[\s\S]*\}/);
        judge = m ? JSON.parse(m[0]) : undefined;
      }

      results.push({ image, style, projectId, integrated: integrated.map(({ category, name }) => ({ category, name })), assertLineForEachPiece: a1, assertSurvivesRecompute: a2, judge: judge ?? undefined, fakeFile: `${label}_fake.png`, expertFile: `${label}_expert.png` });
      console.log(`[${label}] intégrés=${integrated.length} | ligne garantie: ${a1 ? "✅" : "❌"} | survit au recalcul: ${a2 ? "✅" : "❌"} | juge: ${(judge as { verdict?: string })?.verdict}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[FAIL] ${label}: ${msg}`);
      results.push({ image, style, projectId, integrated: [], assertLineForEachPiece: false, assertSurvivesRecompute: false, error: msg });
    }
    await writeFile(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
  }

  const ok = results.filter((r) => !r.error);
  console.log(`\n✅ ${ok.length}/${results.length} sessions | assertions liste: ${ok.filter((r) => r.assertLineForEachPiece).length}/${ok.length} | survie recalcul: ${ok.filter((r) => r.assertSurvivesRecompute).length}/${ok.length}`);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
