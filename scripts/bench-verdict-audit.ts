#!/usr/bin/env npx tsx
/**
 * VALIDATION verdict_elements dev v6 (audit #17 #6 #3) — verdict SEUL, pas de génération.
 *
 * Rejoue le verdict sur les profils d'un projet réel, pour N styles, et vérifie :
 *   #17 — action_label_en présent sur chaque décision "surface" (avec hex si peinture)
 *   #6  — mur : teinte profonde ASSUMÉE par le style (bohème → terracotta/olive OK)
 *         mais registre clair pour un style à murs clairs (scandinave → pas de bleu nuit)
 *   #3  — assises (sofa/armchair/chair/bench) : jamais "surface"
 * Le filtre candidates (code, renderable only) est actif : reupholster absent.
 *
 * Usage : npx tsx scripts/bench-verdict-audit.ts --ctxFrom=<projetId> [--styles=boheme,scandinave]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

function arg(name: string, def?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}

const SIEGES = new Set(["sofa", "armchair", "chair", "dining_chair", "bench"]);

async function main() {
  const { getCandidateActions } = await import("../lib/diy/rules");
  const { loadStyleContext } = await import("../lib/prompts/helpers");
  const { resolvePrompt } = await import("../lib/prompts/engine");
  const { getVisionProvider } = await import("../lib/ai/provider");
  const { createSupabaseAdmin } = await import("../lib/supabase/server");
  type Profile = { element_id: string; element: string; category: string; description: string;
    material_family: string; surface_features: string[]; condition: string };

  const ctxFrom = arg("ctxFrom", "Q8zUH0p79EXI0NSooiu16")!;
  const styles = (arg("styles", "boheme,scandinave")!).split(",");

  const { data: prow, error } = await createSupabaseAdmin()
    .from("foyer_projects").select("data").eq("id", ctxFrom).single();
  if (error || !prow) throw new Error(`projet ${ctxFrom}: ${error?.message}`);
  const data = prow.data as { visionOutput?: Profile[]; basePhotoUrl?: string };
  const profiles = data.visionOutput ?? [];
  if (!profiles.length || !data.basePhotoUrl) throw new Error("visionOutput/basePhotoUrl manquants");
  const photo = Buffer.from(await (await fetch(data.basePhotoUrl)).arrayBuffer());
  console.log(`projet ${ctxFrom} : ${profiles.length} éléments\n`);

  const elementsJson = JSON.stringify(profiles.map((p) => ({
    element_id: p.element_id, element: p.element, category: p.category, description: p.description,
    material_family: p.material_family, surface_features: p.surface_features, condition: p.condition,
  })), null, 2);

  for (const styleId of styles) {
    const { styleName, styleMood } = await loadStyleContext(styleId, {});
    const candidatesByElement = new Map<string, { slug: string; label: string }[]>();
    for (const p of profiles) {
      const c = await getCandidateActions(p as never, styleId);
      candidatesByElement.set(p.element_id, c.map((a) => ({ slug: a.slug, label: a.label })));
    }
    const candidateActionsJson = JSON.stringify(profiles.map((p) => ({
      element_id: p.element_id, candidates: candidatesByElement.get(p.element_id) ?? [],
    })), null, 2);

    const vp = await resolvePrompt("verdict_elements", { styleName, styleMood, elementsJson, candidateActionsJson }, { strict: false });
    console.log(`── style ${styleId} (template v${vp.prompt.version}, ${vp.resolvedTemplate.length} car.) ──`);
    const res = await getVisionProvider(vp.prompt.provider).analyze(vp.resolvedTemplate, [photo as never], {});
    const decisions = (res.parsed as { decisions?: Array<Record<string, unknown>> } | null)?.decisions ?? [];
    if (!decisions.length) { console.log("  ⚠ verdict illisible"); continue; }

    let fautes = 0;
    for (const d of decisions) {
      const p = profiles.find((x) => x.element_id === d.element_id);
      const cat = p?.category ?? "?";
      const mm = d.mismatch_type as string;
      const enOk = mm !== "surface" || Boolean(d.action_label_en);
      const siegeOk = !SIEGES.has(cat) || mm !== "surface";
      if (!enOk || !siegeOk) fautes++;
      const flag = !siegeOk ? " ❌ SIÈGE EN SURFACE (#3)" : !enOk ? " ❌ action_label_en MANQUANT (#17)" : "";
      if (mm !== "none" || flag) {
        console.log(`  ${cat.padEnd(14)} ${mm.padEnd(10)} ${String(d.action_label ?? "").slice(0, 60)}${flag}`);
        if (d.action_label_en) console.log(`  ${"".padEnd(14)} EN: ${String(d.action_label_en).slice(0, 70)}`);
      }
    }
    const mur = decisions.find((d) => (profiles.find((x) => x.element_id === d.element_id)?.category === "wall") && d.mismatch_type === "surface");
    console.log(`  → mur : ${mur ? `${mur.action_label}` : "(aucun repaint)"}  ·  fautes #17/#3 : ${fautes}\n`);
  }
}

main().catch((e) => { console.error("erreur:", e); process.exit(1); });
