#!/usr/bin/env npx tsx
/**
 * BANC DISPOSITIONS : pourquoi les 3 dispositions réinventent-elles la pièce ?
 *
 * Constat (QA Alexis 2026-07-16, projets lsGcdl / UJAH8T sur test1.jpg) : D1/D2
 * sortent une pièce ENTIÈREMENT différente (baie balcon → porte-fenêtre inventée,
 * fenêtres jardin plain-pied inventées) — la photo est quasi ignorée. Le test admin
 * (prompt maigre) marche ; le pipeline (prompt gonflé) casse. Le template actif v38
 * fait 18,9k car. contre ~9,2k au dernier état fiable (10/07 ~15h Paris).
 *
 * Hypothèse : DILUTION — l'instruction « édite CETTE photo » se noie dans ~25k car.
 * résolus, NB1 bascule en texte→image générique.
 *
 * 4 bras, MÊME photo, MÊME contexte détecté une seule fois, MÊMES briefs :
 *   v38        — template actif (repro exacte du pipeline qui échoue)
 *   v38-slim   — même template, visionJson remplacé par une ligne (teste le POIDS du contexte)
 *   j10        — template archivé du 10/07 15:40 Paris (teste la régression de template)
 *   lean       — édition stricte minimale ~1,2k car. (plancher de référence)
 *
 * Juge vision (gemini-2.5-flash) : même pièce ? ouvertures identiques ? baie conservée ?
 * cadrage ? doublons ? — comptage factuel contre la photo d'origine.
 *
 * Aucun projet réel touché (projectId bench-*). Canary d'abord :
 *   npx tsx scripts/bench-dispositions.ts --canary          (1 bras × 1 brief)
 *   npx tsx scripts/bench-dispositions.ts                   (4 bras × 3 briefs = 12)
 * Options : --photo=bench/base/test1.jpg --style=boheme --room=salon
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function arg(name: string, def?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}
const CANARY = process.argv.includes("--canary");
// --parallel : les 3 briefs d'un bras partent SIMULTANÉMENT (Promise.all), comme le
// pipeline réel — dernière différence structurelle entre le banc (séquentiel, propre)
// et le pipeline (parallèle, cassé) après élimination du prompt (byte-identique),
// de la photo, du modèle et de la température.
const PARALLEL = process.argv.includes("--parallel");
const ROUNDS = Number(arg("rounds", "1")) || 1;

type Verdict = {
  meme_piece: boolean;
  ouvertures_identiques: boolean;
  baie_principale_conservee: boolean;
  ouverture_inventee: boolean;
  ouverture_supprimee: boolean;
  boiserie_moulure_ajoutee: boolean;
  cadrage_identique: boolean;
  meuble_duplique: boolean;
  engagement_style: number;
  beaute: number;
  commentaire: string;
};

const JUGE = `Tu es un contrôleur qualité impitoyable spécialisé en ARCHITECTURE intérieure. IMAGE 1 = la photo ORIGINALE. IMAGE 2 = le rendu.

La seule question qui compte : le rendu montre-t-il LA MÊME PIÈCE (mêmes murs, mêmes ouvertures aux mêmes endroits, même caméra) simplement redécorée — ou une pièce réinventée ?

Réponds en JSON STRICT, sans texte autour :
{
  "meme_piece": <true si un habitant reconnaîtrait immédiatement SA pièce : mêmes murs, mêmes ouvertures aux mêmes positions, même point de vue>,
  "ouvertures_identiques": <true si CHAQUE fenêtre/porte/baie/passage de la photo est au même endroit, à la même taille, avec le même type de menuiserie, et qu'AUCUNE nouvelle n'apparaît>,
  "baie_principale_conservee": <true si la ou les plus grandes surfaces vitrées de la photo (baie, mur de fenêtres) sont conservées à l'identique : même largeur, même menuiserie, même vue>,
  "ouverture_inventee": <true si le rendu montre une fenêtre/porte/baie qui n'existe PAS dans la photo>,
  "ouverture_supprimee": <true si une ouverture de la photo a disparu ou a été murée dans le rendu>,
  "boiserie_moulure_ajoutee": <true si le rendu ajoute boiseries, moulures murales, lambris ou soubassements absents de la photo>,
  "cadrage_identique": <true si même point de vue, même hauteur de caméra, même focale — pas de pan/zoom/recadrage>,
  "meuble_duplique": <true si le rendu contient DEUX exemplaires d'un meuble structurant (2 canapés, 2 meubles TV, 2 buffets…) là où la photo n'en montre qu'un>,
  "engagement_style": <1 à 5 : 1 = timide, 5 = style pleinement assumé>,
  "beaute": <1 à 5>,
  "commentaire": "<une phrase factuelle sur la principale différence>"
}`;

// Édition stricte minimale — le plancher : si CE prompt est fiable et pas v38,
// la dilution est prouvée.
function leanPrompt(styleName: string, brief: string, roomType: string): string {
  return `Edit the attached photo of a real ${roomType}. Keep the architecture EXACTLY as photographed: every wall, window, door, opening, the ceiling, the floor structure and the camera framing stay identical — never add, move, resize or remove any of them. Change ONLY the decoration and movable furniture: restyle the room in the "${styleName}" style — furniture, rug, textiles, wall paint colour, plants, art. ${brief} Output one photorealistic photograph of the SAME room from the SAME viewpoint, restyled.`;
}

async function main() {
  const { detectElementProfiles, buildFixedFeaturesSummary, buildRemoveList,
    buildLightingPlanLine, buildRoomScaleLine, buildVariationLine, buildInventoryLockLine,
    constraintsToChoices, refsAssisesConservees, DISPOSITION_BRIEFS } = await import("../lib/ai/pipeline");
  const { loadStyleContext, loadRoomDefaults, loadRoomRemoveCategories,
    formatUserInstructions, formatDesignPlan } = await import("../lib/prompts/helpers");
  const { resolvePrompt, resolveRawTemplate } = await import("../lib/prompts/engine");
  const { getImageProvider, getVisionProvider } = await import("../lib/ai/provider");
  const { createSupabaseAdmin } = await import("../lib/supabase/server");

  const photoPath = path.resolve(arg("photo", "bench/base/test1.jpg")!);
  const roomType = arg("room", "salon")!;
  const styleId = arg("style", "boheme")!;
  // --visionFrom=<projectId> : rejoue avec le visionOutput EXACT d'un projet réel —
  // c'est l'entrée qui varie entre les runs (détection flash-lite bruitée), donc la
  // seule façon de reproduire un échec observé au lieu de retirer les dés.
  const visionFrom = arg("visionFrom");
  // --ctxFrom=<projectId> : réplication INTÉGRALE du contexte du projet (photo,
  // visionOutput, element_decisions → designPlan réel, contraintes, roomScale,
  // variation par project.id) + bras d'ABLATION des blocs ajoutés depuis a275927.
  // Constat Alexis 2026-07-16 : même prompts DB, ancien code Vercel OK, nouveau
  // cassé → le déclencheur est un bloc de contexte construit par le CODE.
  const ctxFrom = arg("ctxFrom");
  const runId = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const outDir = path.resolve(arg("out", `bench/dispositions-${runId}`)!);
  const projectId = `bench-dispositions-${runId}`;

  await mkdir(outDir, { recursive: true });

  // Projet source (mode ctxFrom) : photo + visionOutput + décisions + contraintes.
  type ProjetRow = {
    basePhotoUrl?: string; visionOutput?: unknown[]; element_decisions?: unknown[];
    userConstraints?: unknown; roomScale?: "small" | "medium" | "large"; roomType?: string;
    selectedStyleId?: string; id?: string;
  };
  let projet: ProjetRow | null = null;
  if (ctxFrom) {
    const { data: prow, error: perr } = await createSupabaseAdmin()
      .from("foyer_projects").select("data").eq("id", ctxFrom).single();
    if (perr || !prow) throw new Error(`projet ${ctxFrom} introuvable: ${perr?.message}`);
    projet = prow.data as ProjetRow;
  }

  const buf = projet?.basePhotoUrl
    ? Buffer.from(await (await fetch(projet.basePhotoUrl)).arrayBuffer())
    : await readFile(photoPath);

  // Template archivé du 10/07 15:40 Paris (13:40 UTC) — dernier état fiable connu.
  const { data: j10row, error: j10err } = await createSupabaseAdmin()
    .from("prompt_versions")
    .select("template")
    .eq("slug", "gen_wow_3_dispositions")
    .eq("saved_at", "2026-07-10 13:40:25.893266+00")
    .limit(1)
    .single();
  if (j10err || !j10row) throw new Error(`template j10 introuvable: ${j10err?.message}`);
  const j10Template = j10row.template as string;

  const roomTypeEff = projet?.roomType ?? roomType;
  const styleIdEff = projet?.selectedStyleId ?? styleId;
  const choices = projet?.userConstraints ? constraintsToChoices(projet.userConstraints as never) : {};
  const { styleName, styleMood } = await loadStyleContext(styleIdEff, {
    lockWalls: Boolean((choices as { walls?: { repaint?: boolean } }).walls?.repaint),
  });
  const furnitureDefaults = await loadRoomDefaults(roomTypeEff);
  const removeCategories = await loadRoomRemoveCategories(roomTypeEff);

  // Détection UNE fois — tous les bras reçoivent EXACTEMENT le même contexte.
  let profiles;
  const visionSrc = ctxFrom ?? visionFrom;
  if (visionSrc) {
    const src = ctxFrom ? projet! : ((await createSupabaseAdmin()
      .from("foyer_projects").select("data").eq("id", visionSrc).single()).data?.data as ProjetRow | undefined);
    profiles = ((src?.visionOutput ?? []) as unknown[]) as Awaited<ReturnType<typeof detectElementProfiles>>;
    if (!profiles.length) throw new Error(`projet ${visionSrc}: visionOutput vide`);
    console.log(`visionOutput repris du projet ${visionSrc} (${profiles.length} éléments)`);
  } else {
    profiles = await detectElementProfiles(projectId, buf, "bench:dispositions");
  }

  // Contexte : réplication du pipeline (designPlan RÉEL depuis element_decisions,
  // contraintes, roomScale, variation par id projet) quand ctxFrom est donné.
  const designPlanCore = projet
    ? formatDesignPlan(projet.element_decisions as never) || "None — restyle freely to fit the style."
    : "None — restyle freely to fit the style.";
  const userInstructions = projet
    ? await formatUserInstructions(choices as never)
    : "None — use your judgment within the guidance.";
  const planSuffix =
    `\n${await buildLightingPlanLine(profiles, styleName)}` +
    `${buildRoomScaleLine(projet?.roomScale ?? "large")}` +
    `${buildVariationLine(projet?.id ?? projectId)}`;
  const inventoryLine = buildInventoryLockLine(profiles);

  const baseCtx = {
    styleName,
    styleMood,
    roomType: roomTypeEff,
    furnitureDefaults,
    visionJson: JSON.stringify(profiles, null, 2),
    fixedFeatures: await buildFixedFeaturesSummary(profiles),
    removeList: buildRemoveList(profiles, removeCategories),
    userInstructions,
    designPlan: `${designPlanCore}${planSuffix}${inventoryLine}`,
  };
  // Ablations : mêmes blocs, retirés un à un.
  const sansInventaire = { ...baseCtx, designPlan: `${designPlanCore}${planSuffix}` };
  const moodSansDecor = styleMood.replace(/\. STAGE THIS DECOR[\s\S]*?(?=\. NEVER: |$)/, "");
  const sansDecor = { ...baseCtx, styleMood: moodSansDecor };
  const sansLesDeux = { ...sansInventaire, styleMood: moodSansDecor };

  // Résumé d'ouvertures APPAUVRI (état avant le fix du 2026-07-16) : catégorie nue,
  // sans description ni primauté de la photo — reconstruit par chirurgie de chaîne sur
  // le nouveau résumé, pour rejouer exactement ce que recevait le pipeline qui échouait.
  const fixedAppauvri = (fixed: string) =>
    fixed
      .replace(/ \(in the photo: [^)]*\)/g, "")
      .replace(/ Each opening keeps its PHOTOGRAPHED[\s\S]*?reproduce exactly what is photographed\./, "");

  type Arm = {
    cle: string;
    rawBrief?: boolean; // true = brief injecté BRUT ({{styleName}} littéral), comme le pipeline avant fix
    withCrops?: boolean; // true = joint les crops d'assises + note, EXACTEMENT comme le pipeline
    resolve: (ctx: Record<string, unknown>, brief: string) => Promise<string> | string;
  };
  const viaSlug = async (ctx: Record<string, unknown>) =>
    (await resolvePrompt("gen_wow_3_dispositions", ctx as never, { strict: false })).resolvedTemplate;

  // Les crops d'assises conservées — LA différence banc/pipeline restée non répliquée
  // (les 3 projets cassés du 2026-07-16 ont tous 3 assises mismatch_type:none → le
  // pipeline joint 3 gros plans en refImages ; le banc, jamais). Hypothèse : le
  // multi-images fait basculer NB1 d'ÉDITION en COMPOSITION (pièce réinventée autour
  // des meubles montrés, ratio de sortie décroché de la photo).
  const assises = projet
    ? await refsAssisesConservees(projet.basePhotoUrl!, profiles, projet.element_decisions as never)
    : { images: [], note: "" };
  if (assises.images.length) console.log(`${assises.images.length} crop(s) d'assises conservées répliqué(s)`);

  // Mode ctxFrom : repro exacte (brief brut, comme le pipeline) + ablations des blocs
  // ajoutés depuis a275927 (dernier code Vercel sain). Sinon : bras historiques.
  const ARMS: Arm[] = ctxFrom
    ? [
        // avec-crops = le pipeline EXACT (crops d'assises joints) ; repro = idem sans crops.
        { cle: "avec-crops", rawBrief: true, withCrops: true, resolve: (ctx: Record<string, unknown>) => viaSlug({ ...baseCtx, dispositionBrief: ctx.dispositionBrief }) },
        { cle: "repro", rawBrief: true, resolve: (ctx: Record<string, unknown>) => viaSlug({ ...baseCtx, dispositionBrief: ctx.dispositionBrief }) },
        { cle: "sans-inv", rawBrief: true, resolve: (ctx: Record<string, unknown>) => viaSlug({ ...sansInventaire, dispositionBrief: ctx.dispositionBrief }) },
        { cle: "sans-decor", rawBrief: true, resolve: (ctx: Record<string, unknown>) => viaSlug({ ...sansDecor, dispositionBrief: ctx.dispositionBrief }) },
        { cle: "sans-2", rawBrief: true, resolve: (ctx: Record<string, unknown>) => viaSlug({ ...sansLesDeux, dispositionBrief: ctx.dispositionBrief }) },
      ]
    : [
        {
          // Repro du résumé appauvri (avant fix) + brief brut.
          cle: "repro",
          rawBrief: true,
          resolve: async (ctx) =>
            viaSlug({ ...ctx, fixedFeatures: fixedAppauvri((ctx as { fixedFeatures: string }).fixedFeatures) }),
        },
        {
          // Pipeline corrigé : résumé riche (description + largeur + photo-vérité) + brief résolu.
          cle: "fix",
          resolve: async (ctx) => viaSlug(ctx),
        },
        {
          cle: "j10",
          resolve: (ctx) => resolveRawTemplate(j10Template, ctx as never).resolved,
        },
        {
          cle: "lean",
          resolve: (_ctx, brief) => leanPrompt(styleName, brief, roomTypeEff),
        },
      ];

  // --arm=repro (ou liste: repro,sans-inv) : ne lancer que ces bras.
  const armFilter = arg("arm")?.split(",");
  const arms = (CANARY ? ARMS.slice(0, 1) : ARMS).filter((a) => !armFilter || armFilter.includes(a.cle));
  const briefs = CANARY ? DISPOSITION_BRIEFS.slice(0, 1) : DISPOSITION_BRIEFS;
  console.log(`Banc dispositions : ${arms.length} bras × ${briefs.length} brief(s) = ${arms.length * briefs.length} rendus`);
  console.log(`Photo: ${photoPath} · style: ${styleId} · pièce: ${roomType}\nSortie: ${outDir}\n`);

  const lignes: Array<Record<string, unknown>> = [];

  const unRendu = async (armDef: (typeof arms)[number], i: number, round: number) => {
    // Le moteur ne substitue pas les placeholders NICHÉS ({{styleName}} DANS le
    // brief) : le pipeline réel envoie donc le brief BRUT (littéral {{styleName}}).
    // Les bras `rawBrief` rejouent cet état ; les autres résolvent avant.
    const brief = armDef.rawBrief ? briefs[i] : briefs[i].replaceAll("{{styleName}}", styleName);
    const ctx = { ...baseCtx, dispositionBrief: brief };
    const t0 = Date.now();
    const prompt = await armDef.resolve(ctx, brief);
    const suffixe = ROUNDS > 1 ? `_r${round}` : "";
    let res;
    try {
      res = armDef.withCrops
        ? await getImageProvider("nano_banana").generateFromText(prompt + assises.note, buf, assises.images.length ? assises.images : undefined)
        : await getImageProvider("nano_banana").generateFromText(prompt, buf);
    } catch (e) {
      console.error(`[gen] ${armDef.cle} d${i + 1}${suffixe} ÉCHEC: ${e instanceof Error ? e.message : e}`);
      lignes.push({ bras: armDef.cle, brief: i + 1, round, promptLen: prompt.length, echec: true });
      return;
    }
    const nom = `${armDef.cle}__d${i + 1}${suffixe}.png`;
    await writeFile(path.join(outDir, nom), res.imageBuffer);
    // Prompt COMPLET sur disque : le log ai_calls tronque à 5000 car., ce qui a
    // masqué le contenu réel du verrou pendant tout le debug du 2026-07-16.
    await writeFile(path.join(outDir, `${armDef.cle}__d${i + 1}${suffixe}.prompt.txt`), prompt);
    // Marqueur objectif de régénération : ratio de sortie ≠ ratio de la photo
    // (les pièces réinventées du pipeline sortent en 2,09/2,55:1 sur photo 4:3).
    const dims = (() => {
      try {
        const b = res.imageBuffer;
        if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
      } catch { /* dims = bonus */ }
      return null;
    })();
    console.log(`[gen] ${nom} (${Math.round((Date.now() - t0) / 1000)}s · prompt ${prompt.length} car.${dims ? ` · ${dims.w}x${dims.h}` : ""})`);

    let verdict: Verdict | null = null;
    try {
      const jugeRes = await getVisionProvider("gemini_vision").analyze(
        JUGE, [buf, res.imageBuffer], { model: "gemini-2.5-flash" },
      );
      verdict = jugeRes.parsed as Verdict | null;
    } catch (e) {
      console.warn(`  ⚠ juge illisible: ${e instanceof Error ? e.message : e}`);
    }
    if (verdict) {
      const fautes =
        (verdict.meme_piece ? 0 : 1) +
        (verdict.ouvertures_identiques ? 0 : 1) +
        (verdict.baie_principale_conservee ? 0 : 1) +
        (verdict.ouverture_inventee ? 1 : 0) +
        (verdict.ouverture_supprimee ? 1 : 0) +
        (verdict.boiserie_moulure_ajoutee ? 1 : 0) +
        (verdict.cadrage_identique ? 0 : 1) +
        (verdict.meuble_duplique ? 1 : 0);
      lignes.push({ bras: armDef.cle, brief: i + 1, round, promptLen: prompt.length, fautes,
        largeur: dims?.w, hauteur: dims?.h, ...verdict });
      console.log(`  → ${fautes} faute(s) archi · même pièce: ${verdict.meme_piece} · ${verdict.commentaire}`);
    }
  };

  for (const armDef of arms) {
    for (let round = 1; round <= ROUNDS; round++) {
      if (PARALLEL) {
        // Comme le pipeline : les 3 briefs partent ENSEMBLE.
        await Promise.all(briefs.map((_, i) => unRendu(armDef, i, round)));
      } else {
        for (let i = 0; i < briefs.length; i++) await unRendu(armDef, i, round);
      }
    }
  }

  await writeFile(path.join(outDir, "resultats.json"), JSON.stringify(lignes, null, 2));

  console.log(`\n${"═".repeat(78)}\nSYNTHÈSE (fautes d'architecture — 0 = pièce fidèle)\n${"═".repeat(78)}`);
  const entete = ["bras", "d1", "d2", "d3", "total", "même pièce", "prompt (car.)"];
  console.log(entete.map((h, j) => h.padEnd(j === 0 ? 10 : 12)).join(""));
  for (const armDef of arms) {
    const rows = lignes.filter((l) => l.bras === armDef.cle && !l.echec);
    const par = [1, 2, 3].map((b) => {
      const r = rows.find((l) => l.brief === b);
      return r ? String(r.fautes) : "—";
    });
    const total = rows.reduce((n, l) => n + ((l.fautes as number) || 0), 0);
    const memes = rows.filter((l) => l.meme_piece).length;
    const plen = rows[0]?.promptLen ?? "—";
    console.log(
      armDef.cle.padEnd(10) + par.map((p) => p.padEnd(12)).join("") +
      String(total).padEnd(12) + `${memes}/${rows.length}`.padEnd(12) + String(plen),
    );
  }
  console.log(`\nRendus : ${outDir}`);
}

main().catch((e) => { console.error("erreur:", e); process.exit(1); });
