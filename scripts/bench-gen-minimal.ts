#!/usr/bin/env npx tsx
/**
 * BANC RENDU UNIQUE : gen_wow_generic PROD (17k, empilement pré-13/07) vs DEV
 * « minimal data-driven » (3,5k après réinjection removeList/furnitureDefaults).
 *
 * Gate de promotion (AGENTS.md règle 2) : le minimal ne part en prod QUE si ce banc
 * montre archi fidèle + contenu au niveau (removeList honorée, pièce meublée à son
 * potentiel, style engagé). Même contexte pour les deux bras — visionJson ÉLAGUÉ
 * (audit #13) et ROOM SIZE assouplie (#18) des deux côtés : on ne mesure QUE le
 * template.
 *
 * Usage :
 *   npx tsx scripts/bench-gen-minimal.ts --ctxFrom=<projetId>          (pièce meublée réelle)
 *   npx tsx scripts/bench-gen-minimal.ts --photo=bench/base/testX.jpg  (détection fraîche)
 *   options : --rounds=2 --style=boheme --room=salon --canary
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
const ROUNDS = Number(arg("rounds", "2")) || 2;

type Verdict = {
  meme_piece: boolean;
  ouvertures_identiques: boolean;
  ouverture_inventee: boolean;
  ouverture_supprimee: boolean;
  boiserie_moulure_ajoutee: boolean;
  cadrage_identique: boolean;
  meuble_duplique: boolean;
  objet_hors_piece_restant: boolean;
  piece_a_moitie_vide: boolean;
  // Conversion de pièce (salon déclaré chambre…) — champs jugés seulement quand
  // la détection ∩ removeCategories est non vide (sinon ignorés).
  meuble_ancien_usage_restant: boolean;
  meuble_usage_cible_present: boolean;
  engagement_style: number;
  beaute: number;
  commentaire: string;
};

const JUGE = (roomType: string) => `Tu es un contrôleur qualité impitoyable. IMAGE 1 = la photo ORIGINALE de la pièce. IMAGE 2 = le rendu redécoré. La pièce CIBLE est déclarée : ${roomType} (le rendu doit être meublé comme un(e) ${roomType}, même si la photo montre un autre usage).

Réponds en JSON STRICT, sans texte autour :
{
  "meuble_ancien_usage_restant": <true si un meuble typique d'un AUTRE usage que ${roomType} (ex. canapé, table basse, meuble TV pour une chambre) visible dans la photo est ENCORE présent dans le rendu>,
  "meuble_usage_cible_present": <true si le rendu contient le mobilier ESSENTIEL d'un(e) ${roomType} (ex. un lit pour une chambre)>,
  "meme_piece": <true si un habitant reconnaîtrait immédiatement SA pièce : mêmes murs, mêmes ouvertures aux mêmes positions, même point de vue>,
  "ouvertures_identiques": <true si CHAQUE fenêtre/porte/baie/passage de la photo est au même endroit, même taille, même menuiserie, et qu'aucune nouvelle n'apparaît>,
  "ouverture_inventee": <true si le rendu montre une ouverture absente de la photo>,
  "ouverture_supprimee": <true si une ouverture de la photo a disparu ou est murée>,
  "boiserie_moulure_ajoutee": <true si le rendu ajoute boiseries, moulures, lambris ou poutres absents de la photo>,
  "cadrage_identique": <true si même point de vue, même focale — pas de pan/zoom/recadrage>,
  "meuble_duplique": <true si DEUX exemplaires d'un meuble structurant là où la photo n'en montre qu'un>,
  "objet_hors_piece_restant": <true si un objet qui n'a rien à faire dans ce type de pièce (étendoir, cartons, matériel de chantier, vaisselle sale…) visible dans la photo est ENCORE dans le rendu>,
  "piece_a_moitie_vide": <true si une large portion du sol ou des murs reste nue alors que la pièce est manifestement grande — rendu timide/incomplet>,
  "engagement_style": <1 à 5 : 1 = la pièce a à peine changé, 5 = style pleinement assumé>,
  "beaute": <1 à 5 : qualité photo de magazine>,
  "commentaire": "<une phrase factuelle>"
}`;

async function main() {
  const { detectElementProfiles, buildFixedFeaturesSummary, buildRemoveList,
    buildLightingPlanLine, buildRoomScaleLine, buildVariationLine, buildInventoryLockLine,
    constraintsToChoices, visionJsonPourPrompt, annoteDefaultsSelonDetection,
    buildConversionLine } = await import("../lib/ai/pipeline");
  const { loadStyleContext, loadRoomDefaults, loadRoomRemoveCategories,
    formatUserInstructions, formatDesignPlan } = await import("../lib/prompts/helpers");
  const { resolveRawTemplate } = await import("../lib/prompts/engine");
  const { getImageProvider, getVisionProvider } = await import("../lib/ai/provider");
  const { createSupabaseAdmin } = await import("../lib/supabase/server");

  const roomType = arg("room", "salon")!;
  const styleId = arg("style", "boheme")!;
  const ctxFrom = arg("ctxFrom");
  const photoArg = arg("photo");
  const runId = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const outDir = path.resolve(arg("out", `bench/gen-minimal-${runId}`)!);
  const projectId = `bench-gen-minimal-${runId}`;
  await mkdir(outDir, { recursive: true });

  // Les DEUX templates actifs, prod et dev, directement en DB.
  const { data: prows, error: perr } = await createSupabaseAdmin()
    .from("prompts").select("template, conditions, version")
    .eq("slug", "gen_wow_generic").eq("is_active", true);
  if (perr || !prows?.length) throw new Error(`prompts introuvables: ${perr?.message}`);
  const prodT = prows.find((r) => !(r.conditions as { channel?: string })?.channel);
  const devT = prows.find((r) => (r.conditions as { channel?: string })?.channel === "dev");
  if (!prodT || !devT) throw new Error("il faut une ligne prod ET une ligne dev actives");
  console.log(`prod v${prodT.version} (${(prodT.template as string).length} car.) vs dev v${devT.version} (${(devT.template as string).length} car.)`);

  type ProjetRow = {
    basePhotoUrl?: string; visionOutput?: unknown[]; element_decisions?: unknown[];
    userConstraints?: unknown; roomScale?: "small" | "medium" | "large"; roomType?: string;
    selectedStyleId?: string; id?: string;
  };
  let projet: ProjetRow | null = null;
  if (ctxFrom) {
    const { data: prow2, error: perr2 } = await createSupabaseAdmin()
      .from("foyer_projects").select("data").eq("id", ctxFrom).single();
    if (perr2 || !prow2) throw new Error(`projet ${ctxFrom} introuvable: ${perr2?.message}`);
    projet = prow2.data as ProjetRow;
  }
  const buf = projet?.basePhotoUrl
    ? Buffer.from(await (await fetch(projet.basePhotoUrl)).arrayBuffer())
    : await readFile(path.resolve(photoArg ?? "bench/base/test1.jpg"));

  const roomTypeEff = projet?.roomType ?? roomType;
  const styleIdEff = projet?.selectedStyleId ?? styleId;
  const choices = projet?.userConstraints ? constraintsToChoices(projet.userConstraints as never) : {};
  const { styleName, styleMood } = await loadStyleContext(styleIdEff, {
    lockWalls: Boolean((choices as { walls?: { repaint?: boolean } }).walls?.repaint),
  });
  const furnitureDefaultsBruts = await loadRoomDefaults(roomTypeEff);
  const removeCategories = await loadRoomRemoveCategories(roomTypeEff);

  let profiles;
  if (projet?.visionOutput?.length) {
    profiles = projet.visionOutput as Awaited<ReturnType<typeof detectElementProfiles>>;
    console.log(`visionOutput repris du projet ${ctxFrom} (${profiles.length} éléments)`);
  } else {
    profiles = await detectElementProfiles(projectId, buf, "bench:gen-minimal");
    console.log(`détection fraîche: ${profiles.length} éléments`);
  }

  const designPlanCore = projet
    ? formatDesignPlan(projet.element_decisions as never) || "None — restyle freely to fit the style."
    : "None — restyle freely to fit the style.";
  const furnitureDefaults = annoteDefaultsSelonDetection(furnitureDefaultsBruts, profiles as never);
  // Deux assemblages : « legacy » réplique la prod actuelle (canapé encore décrit
  // dans le JSON + variation, pas de ligne conversion), « new » = code purgé
  // (visionJson/variation sans removeCategories + THIS ROOM CHANGES FUNCTION).
  // Le bras prod tourne sur legacy, le bras dev sur new → l'A/B mesure le FIX
  // complet code+template (conversion salon→chambre, O_nmJO 2026-07-16).
  const communs = {
    styleName,
    styleMood,
    roomType: roomTypeEff,
    furnitureDefaults,
    fixedFeatures: await buildFixedFeaturesSummary(profiles),
    removeList: buildRemoveList(profiles, removeCategories),
    userInstructions: projet ? await formatUserInstructions(choices as never) : "None — use your judgment within the guidance.",
  };
  const finPlan = `\n${await buildLightingPlanLine(profiles, styleName)}${buildRoomScaleLine(projet?.roomScale ?? "large")}`;
  const ctxLegacy = {
    ...communs,
    visionJson: visionJsonPourPrompt(profiles),
    designPlan: `${designPlanCore}${finPlan}${buildVariationLine(projet?.id ?? projectId)}${buildInventoryLockLine(profiles, removeCategories)}`,
  };
  const ctxNew = {
    ...communs,
    visionJson: visionJsonPourPrompt(profiles, removeCategories),
    designPlan: `${designPlanCore}${buildConversionLine(profiles as never, removeCategories, roomTypeEff)}${finPlan}${buildVariationLine(projet?.id ?? projectId, removeCategories)}${buildInventoryLockLine(profiles, removeCategories)}`,
  };

  const ARMS = [
    { cle: "prod17k", template: prodT.template as string, ctx: ctxLegacy },
    { cle: "dev-min", template: devT.template as string, ctx: ctxNew },
  ];
  // --arm=prod17k (ou dev-min) : ne lancer que ce bras.
  const armFilter = arg("arm")?.split(",");
  const arms = (CANARY ? ARMS.slice(1) : ARMS).filter((a) => !armFilter || armFilter.includes(a.cle));
  const rounds = CANARY ? 1 : ROUNDS;
  console.log(`Banc gen : ${arms.length} bras × ${rounds} round(s)\nSortie: ${outDir}\n`);

  const lignes: Array<Record<string, unknown>> = [];
  for (const armDef of arms) {
    for (let r = 1; r <= rounds; r++) {
      const prompt = resolveRawTemplate(armDef.template, armDef.ctx as never).resolved;
      const t0 = Date.now();
      let res;
      try {
        res = await getImageProvider("nano_banana").generateFromText(prompt, buf);
      } catch (e) {
        console.error(`[gen] ${armDef.cle} r${r} ÉCHEC: ${e instanceof Error ? e.message : e}`);
        lignes.push({ bras: armDef.cle, round: r, echec: true });
        continue;
      }
      const nom = `${armDef.cle}__r${r}.png`;
      await writeFile(path.join(outDir, nom), res.imageBuffer);
      await writeFile(path.join(outDir, `${armDef.cle}__r${r}.prompt.txt`), prompt);
      const b = res.imageBuffer;
      const dims = b[0] === 0x89 && b[1] === 0x50 ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null;
      console.log(`[gen] ${nom} (${Math.round((Date.now() - t0) / 1000)}s · prompt ${prompt.length} car.${dims ? ` · ${dims.w}x${dims.h}` : ""})`);

      let verdict: Verdict | null = null;
      try {
        const jugeRes = await getVisionProvider("gemini_vision").analyze(
          JUGE(roomTypeEff), [buf, res.imageBuffer], { model: "gemini-2.5-flash" },
        );
        verdict = jugeRes.parsed as Verdict | null;
      } catch (e) {
        console.warn(`  ⚠ juge illisible: ${e instanceof Error ? e.message : e}`);
      }
      if (verdict) {
        const conversionEnJeu = profiles.some((p) => removeCategories.includes(p.category));
        const fautes =
          (verdict.meme_piece ? 0 : 1) + (verdict.ouvertures_identiques ? 0 : 1) +
          (verdict.ouverture_inventee ? 1 : 0) + (verdict.ouverture_supprimee ? 1 : 0) +
          (verdict.boiserie_moulure_ajoutee ? 1 : 0) + (verdict.cadrage_identique ? 0 : 1) +
          (verdict.meuble_duplique ? 1 : 0) + (verdict.objet_hors_piece_restant ? 1 : 0) +
          (verdict.piece_a_moitie_vide ? 1 : 0) +
          (conversionEnJeu && verdict.meuble_ancien_usage_restant ? 1 : 0) +
          (conversionEnJeu && !verdict.meuble_usage_cible_present ? 1 : 0);
        lignes.push({ bras: armDef.cle, round: r, promptLen: prompt.length, fautes, largeur: dims?.w, hauteur: dims?.h, ...verdict });
        console.log(`  → ${fautes} faute(s) · style ${verdict.engagement_style}/5 · beauté ${verdict.beaute}/5 · ${verdict.commentaire}`);
      }
    }
  }

  await writeFile(path.join(outDir, "resultats.json"), JSON.stringify(lignes, null, 2));
  console.log(`\n${"═".repeat(72)}\nSYNTHÈSE\n${"═".repeat(72)}`);
  for (const armDef of arms) {
    const rows = lignes.filter((l) => l.bras === armDef.cle && !l.echec);
    const tot = rows.reduce((n, l) => n + ((l.fautes as number) || 0), 0);
    const moy = (f: string) => rows.length ? (rows.reduce((n, l) => n + (Number(l[f]) || 0), 0) / rows.length).toFixed(1) : "—";
    console.log(`${armDef.cle.padEnd(10)} fautes=${tot} sur ${rows.length} rendu(s) · style ${moy("engagement_style")}/5 · beauté ${moy("beaute")}/5 · prompt ${rows[0]?.promptLen ?? "—"} car.`);
  }
  console.log(`\nRendus : ${outDir}`);
}

main().catch((e) => { console.error("erreur:", e); process.exit(1); });
