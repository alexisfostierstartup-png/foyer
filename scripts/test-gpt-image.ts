#!/usr/bin/env npx tsx
/**
 * TEST RÉEL ChatGPT/OpenAI image — GPT Image 2 (cher) vs GPT Image 1 Mini (pas cher).
 * Mêmes conditions que l'A/B Nano Banana : notre VRAI prompt pipeline (canal dev),
 * photo source en édition, mêmes photos/styles → comparaison directe des 4 bras.
 *
 * Usage : OPENAI_API_KEY requis dans .env.local
 *   npx tsx scripts/test-gpt-image.ts [--images=bench/base-ab] [--styles=campagne-francaise,boheme]
 *                                     [--models=gpt-image-2,gpt-image-1-mini] [--out=bench/out-gpt-ab]
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

const OPENAI_KEY = process.env.GPT_API_KEY || process.env.OPENAI_API_KEY;

// Prompt SIMPLE (hypothèse Alexis 2026-07-15 : sur les modèles récents bien
// entraînés, la surcouche de règles serait contre-productive — « sur le web
// je n'ai jamais de soucis »). Formulation volontairement proche de la sienne.
function simplePrompt(styleName: string): string {
  return (
    `Crée une nouvelle version de cette pièce dans un style ${styleName}, en conservant les murs, ` +
    `les fenêtres, les portes, la cheminée et les radiateurs exactement à leur place, et en modifiant ` +
    `la disposition des meubles et la décoration. Photo réaliste, même angle de vue.`
  );
}

// Canary PROMPT MINIMAL (hypothèse Alexis : cœur + garde-fous data-driven vaut
// mieux que 12,6k chars de règles qui noient/bloquent les modèles récents).
function minimalPrompt(v: {
  roomType: string; styleName: string; styleMood: string;
  fixedFeatures: string; designPlan: string; visionJson: string; userInstructions: string;
}): string {
  return `You are an interior designer and photo stylist. The attached photo is a REAL ${v.roomType}. Its SHELL is GIVEN — you do NOT redesign it: same walls, same openings, same floor, same ceiling, same light points, same camera and framing. You FURNISH and DECORATE the inside, transforming it into a gorgeous photorealistic ${v.roomType} in the "${v.styleName}" style.
STYLE: ${v.styleMood}

KEEP THE SHELL — reproduce the architecture EXACTLY:
${v.fixedFeatures}
Add NO fireplace, mantel, beam, moulding, column, arch or built-in the photo does not already show (never a fireplace in a room that has none, whatever the style). Radiators, water heaters, staircases and appliances stay put, same wall. Rooms seen through openings stay as they are. Keep the exact viewpoint and vanishing lines.

THE PLAN — follow it literally:
${v.designPlan}
- REPLACE = a genuinely different piece in the same spot (never the original recoloured or re-covered).
- A seat is CHANGED only by swapping the whole piece for a different model — never recolour or reupholster it.
- Walls and floor change ONLY where the plan says so; when the plan repaints a wall, apply the EXACT named colour boldly and completely — every wall pan and every moulding, one uniform scheme, clearly different from the original colour.
- Anything NOT in the plan: keep it EXACTLY. You may add small style ACCESSORIES (rug, cushions, throws, plants, vases, books, wall art) to complete the room.

MAKE IT BEAUTIFUL — the client is paying for a real TRANSFORMATION, not a touch-up. Commit fully to the style at first glance: a large rug anchoring the seating, layered textiles, plants at several heights, dressed surfaces, warm lamps ON, magazine-quality light. A timid render that looks like the original with a few new cushions is a FAILURE. Kept furniture stays untouched — the boldness comes from paint, textiles, decor and staging around it.

RULES: light points are fixed — swap each fixture at its exact point, never add/duplicate/move one, keep the EXACT number of wall sconces. Mirrors reflect THIS room only, nothing in front of them. Nothing floats, clips, or blocks a door or passage. Any TV is a modern flat-screen.

CURRENT ROOM (reference — what exists and where): ${v.visionJson}
USER INSTRUCTIONS (override everything above): ${v.userInstructions}

Output ONE photorealistic photo, same viewpoint, lit to the style's mood. Check: every fixed feature present and unmoved; no invented opening or fireplace; walls fully and uniformly painted if repainted; every REPLACE genuinely different.`;
}

async function generateGemini(model: string, prompt: string, image: Buffer): Promise<Buffer> {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const client = new GoogleGenerativeAI(process.env.NANO_BANANA_API_KEY || process.env.GEMINI_API_KEY || "");
  const m = client.getGenerativeModel({ model, generationConfig: { temperature: Number(process.env.GEN_TEMPERATURE ?? "0.35") } });
  const result = await m.generateContent([prompt, { inlineData: { mimeType: "image/jpeg", data: image.toString("base64") } }]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const part = (result.response.candidates as any[])?.[0]?.content?.parts?.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));
  if (!part?.inlineData?.data) throw new Error("pas d'image Gemini");
  return Buffer.from(part.inlineData.data, "base64");
}

async function main() {
  if (!OPENAI_KEY) throw new Error("GPT_API_KEY manquant dans .env.local");
  process.env.PROMPTS_CHANNEL = process.env.PROMPTS_CHANNEL || "dev";

  const { detectElementProfiles, buildFixedFeaturesSummary, buildRemoveList, buildLightingPlanLine, buildRoomScaleLine } =
    await import("../lib/ai/pipeline");
  const { loadStyleContext, loadRoomDefaults, loadRoomRemoveCategories } = await import("../lib/prompts/helpers");
  const { resolvePrompt } = await import("../lib/prompts/engine");

  const imagesDir = path.resolve(arg("images", "bench/base-ab")!);
  const styles = arg("styles", "campagne-francaise,boheme")!.split(",");
  const models = arg("models", "gpt-image-2,gpt-image-1-mini")!.split(",");
  const promptMode = arg("prompt", "full")!; // full | simple
  const outDir = path.resolve(arg("out", "bench/out-gpt-ab")!);
  await mkdir(outDir, { recursive: true });
  const files = (await readdir(imagesDir)).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();

  const furnitureDefaults = await loadRoomDefaults("salon");
  const removeCategories = await loadRoomRemoveCategories("salon");

  for (const image of files) {
    const buf = await readFile(path.join(imagesDir, image));
    const label = path.parse(image).name;
    let profiles: Awaited<ReturnType<typeof detectElementProfiles>> = [];
    const out: { roomScale?: "small" | "medium" | "large" } = {};
    if (promptMode !== "simple") {
      profiles = await detectElementProfiles(`gpt-ab-${label}`, buf as never, `gpt:${image}`, undefined, out);
      console.log(`[${label}] ${profiles.length} profils, roomScale=${out.roomScale}`);
    }

    for (const style of styles) {
      const { styleName, styleMood } = await loadStyleContext(style, { colorwayIndex: 0, lockWalls: false });
      let prompt: string;
      if (promptMode === "simple") {
        prompt = simplePrompt(styleName);
      } else {
        const designPlan = `None — restyle freely to fit the style.\n${await buildLightingPlanLine(profiles, styleName)}${buildRoomScaleLine(out.roomScale)}`;
        const fixedFeatures = await buildFixedFeaturesSummary(profiles);
        const visionJson = JSON.stringify(profiles, null, 2);
        const userInstructions = "None — use your judgment within the guidance.";
        if (promptMode === "minimal") {
          prompt = minimalPrompt({ roomType: "salon", styleName, styleMood, fixedFeatures, designPlan, visionJson, userInstructions });
        } else {
          const genPrompt = await resolvePrompt("gen_wow_generic", {
            styleName, styleMood, roomType: "salon", furnitureDefaults,
            visionJson, fixedFeatures,
            removeList: buildRemoveList(profiles, removeCategories),
            userInstructions, designPlan,
          }, { strict: false });
          prompt = genPrompt.resolvedTemplate;
        }
      }

      for (const model of models) {
        const t0 = Date.now();
        const file = `${label}__${style}__${model}__${promptMode}.png`;
        try {
          let outBuf: Buffer;
          if (model.startsWith("gemini")) {
            outBuf = await generateGemini(model, prompt, buf);
          } else {
            const form = new FormData();
            form.append("model", model);
            form.append("prompt", prompt.slice(0, 32000));
            // input_fidelity : rejeté par gpt-image-2 (natif) et par mini — omis.
            form.append("size", "auto");
            form.append("image", new Blob([buf], { type: "image/jpeg" }), "room.jpg");
            const res = await fetch("https://api.openai.com/v1/images/edits", {
              method: "POST",
              headers: { Authorization: `Bearer ${OPENAI_KEY}` },
              body: form,
            });
            if (!res.ok) { console.error(`  ✗ ${model} ${style}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`); continue; }
            const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
            const b64 = json.data?.[0]?.b64_json;
            if (!b64) { console.error(`  ✗ ${model} ${style}: pas d'image`); continue; }
            outBuf = Buffer.from(b64, "base64");
          }
          await writeFile(path.join(outDir, file), outBuf);
          console.log(`  ✓ ${model} × ${style} [${promptMode}]: ${file} (${Math.round((Date.now() - t0) / 1000)}s)`);
        } catch (e) {
          console.error(`  ✗ ${model} ${style}:`, e instanceof Error ? e.message : e);
        }
      }
    }
  }
  console.log(`\nRésultats → ${outDir}`);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
