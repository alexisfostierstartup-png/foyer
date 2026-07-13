#!/usr/bin/env npx tsx
/**
 * CANARY SEAT-BLUR — validation A/B du masquage des sièges dans l'image d'entrée.
 * Pour chaque photo : (A) génération normale, (B) génération avec sièges pixelisés
 * dans la source (UNE seule génération dans les deux cas). Juge : le siège du rendu
 * est-il le même modèle re-skinné que l'original ?
 *
 * Usage : npx tsx scripts/canary-seat-blur.ts [--images=bench/base] [--only=test1.,test2.,test5.]
 *         [--style=seventies] [--out=bench/out-canary-blur]
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
  const { detectElementProfiles, buildFixedFeaturesSummary, buildRemoveList, constraintsToChoices, buildLightingPlanLine } =
    await import("../lib/ai/pipeline");
  const { blurSeatsInSource } = await import("../lib/ai/seatBlurCanary");
  const { loadStyleContext, loadRoomDefaults, loadRoomRemoveCategories, formatUserInstructions } =
    await import("../lib/prompts/helpers");
  const { resolvePrompt } = await import("../lib/prompts/engine");
  const { getImageProvider, getVisionProvider } = await import("../lib/ai/provider");

  const imagesDir = path.resolve(arg("images", "bench/base")!);
  const only = arg("only", "test1.,test2.,test5.")!.split(",");
  const style = arg("style", "seventies")!;
  const outDir = path.resolve(arg("out", "bench/out-canary-blur")!);
  await mkdir(outDir, { recursive: true });
  const files = (await readdir(imagesDir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .filter((f) => only.some((o) => f.startsWith(o))).sort();

  const { styleName, styleMood } = await loadStyleContext(style, { colorwayIndex: 0, lockWalls: false });
  const furnitureDefaults = await loadRoomDefaults("salon");
  const removeCategories = await loadRoomRemoveCategories("salon");
  const userInstructions = await formatUserInstructions(constraintsToChoices({
    floor: { note: "", change: false, preset: null },
    walls: { frames: false, repaint: false, moldings: false, moldingStyle: "classique" },
    furniture: {}, accessories: "cosy",
  } as never));

  type Res = { image: string; variant: "A_normal" | "B_blur"; blurred?: number; same_model?: string[]; file: string };
  const results: Res[] = [];

  for (const image of files) {
    const buf = await readFile(path.join(imagesDir, image));
    const label = path.parse(image).name;
    const profiles = await detectElementProfiles(`canary-blur-${label}`, buf as never, `canary:${image}`);
    // KEEP table basse (simule une action DIY « conserver ») : valide que le
    // masque de pixelisation ne mange pas un meuble à garder qui chevauche la
    // bbox du canapé, et que le rendu la préserve vraiment.
    const basePlan =
      `- KEEP the coffee table exactly as it is: same model, same material, same colour, same position. It must remain clearly recognizable in the result.\n` +
      `- Everything else: restyle freely to fit the style.\n${await buildLightingPlanLine(profiles, styleName)}`;
    const baseCtx = {
      styleName, styleMood, roomType: "salon", furnitureDefaults,
      visionJson: JSON.stringify(profiles, null, 2),
      fixedFeatures: await buildFixedFeaturesSummary(profiles),
      removeList: buildRemoveList(profiles, removeCategories),
      userInstructions,
    };

    for (const variant of ["A_normal", "B_blur"] as const) {
      let source: Buffer = buf;
      let plan = basePlan;
      let blurredCount = 0;
      if (variant === "B_blur") {
        const blurred = await blurSeatsInSource(buf, `canary-blur-${label}`);
        source = blurred.buffer;
        plan = basePlan + blurred.planNote;
        blurredCount = blurred.blurredCount;
        await writeFile(path.join(outDir, `${label}_input_blur.jpg`), source);
      }
      const genPrompt = await resolvePrompt("gen_wow_generic", { ...baseCtx, designPlan: plan }, { strict: false });
      const gen = await getImageProvider(genPrompt.prompt.provider).generateFromText(genPrompt.resolvedTemplate, source as never);
      const file = `${label}_${variant}.png`;
      await writeFile(path.join(outDir, file), gen.imageBuffer);

      // Juge : sièges = même modèle re-skinné ?
      const seats = profiles.filter((p) => ["sofa", "armchair", "chair", "dining_chair", "bench"].includes(p.category));
      const jr = await getVisionProvider("gemini_vision").analyze(
        `IMAGE 1 = pièce d'origine. IMAGE 2 = redesign. Sièges d'origine : ${seats.map((s) => `${s.element_id} (${(s.description ?? "").slice(0, 50)})`).join(" | ")}.
Pour chaque siège : IMAGE 2 montre-t-elle le MÊME modèle (silhouette identique, juste retissé/recoloré/hybridé) ou un modèle réellement différent ?
JSON strict: {"same_model": [<element_ids restés le même modèle>]}`,
        [buf as never, gen.imageBuffer as never],
        { model: "gemini-2.5-flash" },
      );
      const parsed = jr.parsed as { same_model?: string[] } | null;
      results.push({ image, variant, blurred: blurredCount, same_model: parsed?.same_model ?? [], file });
      console.log(`[${label} ${variant}] ${variant === "B_blur" ? `${blurredCount} zones pixelisées, ` : ""}sièges re-skinnés: ${(parsed?.same_model ?? []).join(", ") || "aucun ✅"}`);
    }
    await writeFile(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
  }

  const score = (v: string) => results.filter((r) => r.variant === v).reduce((a, r) => a + (r.same_model?.length ?? 0), 0);
  console.log(`\nBILAN — sièges re-skinnés (moins = mieux) : A_normal=${score("A_normal")} | B_blur=${score("B_blur")}`);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
