#!/usr/bin/env npx tsx
/**
 * BANC : prompt long (gen_wow_generic, ~19,5k) vs prompt compacté (~12k).
 *
 * Hypothèse à trancher : les fautes signalées par Alexis (appliques en trop, moulures à
 * moitié peintes, canapé retapissé au lieu d'être remplacé, meuble encastré, frigo devenu
 * buffet) ne viennent pas de règles MANQUANTES — elles y sont toutes — mais de la DILUTION
 * d'un prompt devenu trop long. 12 versions ont été empilées le 13/07 ; une compaction
 * antérieure (10k → 6,8k) avait déjà été faite pour cette raison.
 *
 * On ne juge pas « au feeling » : un modèle vision COMPTE les violations sur chaque rendu,
 * en comparant à la photo d'origine. Même contexte, même photo, même style → seule la
 * longueur du prompt change.
 *
 * Aucun projet n'est touché (comme bench-styles : on rejoue le pipeline sans en créer).
 *
 * Usage : npx tsx scripts/bench-prompt-compaction.ts --images=<dir> --room=salon --style=moderne
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function arg(name: string, def?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}

type Verdict = {
  appliques_photo: number;
  appliques_rendu: number;
  peinture_partielle: boolean;
  cheminee_bloquee: boolean;
  meuble_devant_porte: boolean;
  cloison_ou_encastre_ajoute: boolean;
  assise_retapissee: boolean;
  objet_devant_miroir: boolean;
  electromenager_transforme: boolean;
  engagement_style: number;
  beaute: number;
  commentaire: string;
};

const JUGE = `Tu es un contrôleur qualité impitoyable. IMAGE 1 = la photo ORIGINALE de la pièce. IMAGE 2 = le rendu redécoré.

Compte les fautes, factuellement. Ne sois pas indulgent : en cas de doute visible, tu signales.

Réponds en JSON STRICT, sans texte autour :
{
  "appliques_photo": <nombre d'appliques MURALES visibles sur l'IMAGE 1>,
  "appliques_rendu": <nombre d'appliques MURALES visibles sur l'IMAGE 2>,
  "peinture_partielle": <true si, dans le rendu, un mur ou une moulure/boiserie reste dans son ancienne couleur à côté d'une surface fraîchement peinte, ou si une boiserie n'est peinte qu'à moitié>,
  "cheminee_bloquee": <true si une cheminée existe et qu'un meuble est posé devant, contre, ou masque son foyer>,
  "meuble_devant_porte": <true si un meuble bloque une porte, une embrasure ou un passage>,
  "cloison_ou_encastre_ajoute": <true si le rendu ajoute une cloison, un meuble ENCASTRÉ dans le mur, ou rétrécit une ouverture qui existait>,
  "assise_retapissee": <true si un canapé/fauteuil du rendu est visiblement l'assise D'ORIGINE recolorée ou re-tapissée, ou n'a changé que partiellement (un accoudoir resté de l'ancienne couleur)>,
  "objet_devant_miroir": <true si un cadre, un tableau ou un objet est posé devant un miroir, ou un miroir empilé sur un autre>,
  "electromenager_transforme": <true si un appareil de l'IMAGE 1 (frigo, four, hotte…) a disparu ou est devenu un meuble>,
  "engagement_style": <1 à 5 : 1 = rendu timide, la pièce a à peine changé ; 5 = style pleinement assumé>,
  "beaute": <1 à 5>,
  "commentaire": "<une phrase>"
}`;

async function main() {
  const { detectElementProfiles, buildFixedFeaturesSummary, buildRemoveList,
    buildLightingPlanLine, buildRoomScaleLine, buildVariationLine } = await import("../lib/ai/pipeline");
  const { loadStyleContext, loadRoomDefaults, loadRoomRemoveCategories } = await import("../lib/prompts/helpers");
  const { resolvePrompt } = await import("../lib/prompts/engine");
  const { getImageProvider, getVisionProvider } = await import("../lib/ai/provider");

  const imagesDir = path.resolve(arg("images", "bench/base")!);
  const roomType = arg("room", "salon")!;
  const styleId = arg("style", "moderne")!;
  const runId = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const outDir = path.resolve(arg("out", `bench/compaction-${runId}`)!);
  const projectId = `bench-compaction-${runId}`;

  const VERSIONS = [
    { cle: "long", slug: "gen_wow_generic" },
    { cle: "compact", slug: "gen_wow_generic_compact" },
  ];

  const files = (await readdir(imagesDir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  if (!files.length) throw new Error(`aucune image dans ${imagesDir}`);
  await mkdir(outDir, { recursive: true });

  console.log(`Banc compaction : ${files.length} photos × ${VERSIONS.length} versions = ${files.length * 2} rendus`);
  console.log(`Style: ${styleId} · pièce: ${roomType}\nSortie: ${outDir}\n`);

  const { styleName, styleMood } = await loadStyleContext(styleId, {});
  const furnitureDefaults = await loadRoomDefaults(roomType);
  const removeCategories = await loadRoomRemoveCategories(roomType);

  const lignes: Array<Record<string, unknown>> = [];

  for (const f of files) {
    const buf = await readFile(path.join(imagesDir, f));

    // Détection UNE fois par photo : les deux versions reçoivent EXACTEMENT le même
    // contexte. Seule la longueur du prompt varie.
    const profiles = await detectElementProfiles(projectId, buf, `bench:${f}`);
    const ctx = {
      styleName,
      styleMood,
      roomType,
      furnitureDefaults,
      visionJson: JSON.stringify(profiles, null, 2),
      fixedFeatures: await buildFixedFeaturesSummary(profiles),
      removeList: buildRemoveList(profiles, removeCategories),
      userInstructions: "None — use your judgment within the guidance.",
      designPlan: `None — restyle freely to fit the style.\n${await buildLightingPlanLine(profiles, styleName)}${buildRoomScaleLine("large")}${buildVariationLine(projectId + f)}`,
    };

    for (const v of VERSIONS) {
      const t0 = Date.now();
      const p = await resolvePrompt(v.slug, ctx, { strict: false });
      const res = await getImageProvider(p.prompt.provider).generateFromText(p.resolvedTemplate, buf);
      const nom = `${path.parse(f).name}__${v.cle}.png`;
      await writeFile(path.join(outDir, nom), res.imageBuffer);
      console.log(`[gen] ${nom} (${Math.round((Date.now() - t0) / 1000)}s · prompt ${p.resolvedTemplate.length} car.)`);

      // Contrôle qualité : la photo d'origine ET le rendu, comptage des fautes.
      let verdict: Verdict | null = null;
      try {
        const jugeRes = await getVisionProvider("gemini_vision").analyze(
          JUGE,
          [buf, res.imageBuffer],
          { model: "gemini-2.5-flash" },
        );
        verdict = jugeRes.parsed as Verdict | null;
      } catch (e) {
        console.warn(`  ⚠ juge illisible: ${e instanceof Error ? e.message : e}`);
      }

      if (verdict) {
        const appliquesEnTrop = Math.max(0, verdict.appliques_rendu - verdict.appliques_photo);
        const fautes =
          (appliquesEnTrop > 0 ? 1 : 0) +
          (verdict.peinture_partielle ? 1 : 0) +
          (verdict.cheminee_bloquee ? 1 : 0) +
          (verdict.meuble_devant_porte ? 1 : 0) +
          (verdict.cloison_ou_encastre_ajoute ? 1 : 0) +
          (verdict.assise_retapissee ? 1 : 0) +
          (verdict.objet_devant_miroir ? 1 : 0) +
          (verdict.electromenager_transforme ? 1 : 0);
        lignes.push({ photo: f, version: v.cle, fautes, appliquesEnTrop, ...verdict });
        console.log(`  → ${fautes} faute(s) · style ${verdict.engagement_style}/5 · beauté ${verdict.beaute}/5`);
      }
    }
  }

  await writeFile(path.join(outDir, "resultats.json"), JSON.stringify(lignes, null, 2));

  // ── Synthèse ────────────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(70)}\nSYNTHÈSE\n${"═".repeat(70)}`);
  const CHAMPS = [
    ["appliquesEnTrop", "appliques en trop"],
    ["peinture_partielle", "peinture partielle"],
    ["cheminee_bloquee", "cheminée bloquée"],
    ["meuble_devant_porte", "meuble devant une porte"],
    ["cloison_ou_encastre_ajoute", "cloison / encastré ajouté"],
    ["assise_retapissee", "assise retapissée"],
    ["objet_devant_miroir", "objet devant un miroir"],
    ["electromenager_transforme", "électroménager transformé"],
  ] as const;

  const compte = (cle: string, champ: string) =>
    lignes.filter((l) => l.version === cle)
      .reduce((n, l) => n + (typeof l[champ] === "number" ? (l[champ] as number > 0 ? 1 : 0) : l[champ] ? 1 : 0), 0);
  const moyenne = (cle: string, champ: string) => {
    const v = lignes.filter((l) => l.version === cle).map((l) => Number(l[champ]) || 0);
    return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : "—";
  };

  console.log(`\n${"".padEnd(28)} LONG (19,5k)   COMPACT (12k)`);
  for (const [champ, libelle] of CHAMPS) {
    console.log(`  ${libelle.padEnd(26)} ${String(compte("long", champ)).padStart(6)}${String(compte("compact", champ)).padStart(15)}`);
  }
  console.log(`  ${"─".repeat(26)} ${"─".repeat(6)}${"─".repeat(15)}`);
  console.log(`  ${"TOTAL FAUTES".padEnd(26)} ${String(lignes.filter(l => l.version === "long").reduce((n, l) => n + (l.fautes as number), 0)).padStart(6)}${String(lignes.filter(l => l.version === "compact").reduce((n, l) => n + (l.fautes as number), 0)).padStart(15)}`);
  console.log(`\n  ${"engagement style /5".padEnd(26)} ${moyenne("long", "engagement_style").padStart(6)}${moyenne("compact", "engagement_style").padStart(15)}`);
  console.log(`  ${"beauté /5".padEnd(26)} ${moyenne("long", "beaute").padStart(6)}${moyenne("compact", "beaute").padStart(15)}`);
  console.log(`\nRendus : ${outDir}`);
}

main().catch((e) => { console.error("erreur:", e); process.exit(1); });
