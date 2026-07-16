#!/usr/bin/env npx tsx
/**
 * CANARY jumeau gardé (AGENTS.md règle 2) : swap d'UNE pièce d'une catégorie
 * protégée (ex. 2 tapis — un gardé, un remplacé) avec localisateur positionnel +
 * gel explicite du jumeau. AUCUNE écriture DB : lit le projet, génère N images
 * dans bench/, à juger à l'œil.
 * Usage : npx tsx scripts/canary-swap-twin.ts <projectId> <category> [rounds=2]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const [projectId, category, roundsArg] = process.argv.slice(2);
  if (!projectId || !category) throw new Error("usage: canary-swap-twin.ts <projectId> <category> [rounds]");
  const rounds = Number(roundsArg ?? "2") || 2;
  const { getProject } = await import("../lib/storage/projects");
  const { swapOnFake } = await import("../lib/ai/expert");

  const project = await getProject(projectId);
  if (!project) throw new Error("projet introuvable");
  const base = project.expertRenderUrl ?? project.generatedRenderUrl;
  if (!base) throw new Error("pas de rendu");

  type B = { x: number; y: number; w: number; h: number };
  const bboxById = (project.renderAnalysis?.bboxById ?? {}) as Record<string, B>;
  const zoneDe = (b: B) => {
    const cx = b.x + b.w / 2;
    const zone = cx < 0.34 ? "on the LEFT side" : cx > 0.66 ? "on the RIGHT side" : "in the CENTER";
    return `${zone}${b.y + b.h > 0.85 ? ", foreground" : ""}`;
  };

  const item = (project.shoppingList ?? []).find(
    (it) => it.category === category && it.source !== "diy" && it.elementId && (it.matches?.length ?? 0) > 0,
  );
  if (!item?.elementId) throw new Error(`pas de ligne ${category} avec matches`);
  const match = item.matches![0];
  const b = bboxById[item.elementId];
  const jumeaux = (project.element_decisions ?? [])
    .filter((d) => d.category === category && d.element_id !== item.elementId && (d.mismatch_type === "none" || d.mismatch_type === "surface"))
    .map((d) => {
      const jb = bboxById[d.element_id];
      return `the ${category} ${jb ? zoneDe(jb) : `(${(d.description ?? "").slice(0, 50)})`}`;
    });

  const piece = {
    category,
    noun: category.replace(/_/g, " "),
    imageUrl: match.primary_image_url,
    name: match.name,
    elementId: item.elementId,
    match,
    sourceDesc: `${b ? `${zoneDe(b)}: ` : ""}${item.name ?? category}`,
    freezeNote: jumeaux.length
      ? ` — CAREFUL, the room has ${jumeaux.length + 1} ${category.replace(/_/g, " ")}s and ONLY this one changes: ${jumeaux.join(" and ")} belongs to the owner and stays EXACTLY as it is`
      : null,
  };
  console.log(`pièce : ${piece.sourceDesc}\ngel   : ${piece.freezeNote ?? "(aucun jumeau)"}\nproduit : ${piece.name}`);

  const outDir = path.resolve(`bench/canary-twin-${category}`);
  await mkdir(outDir, { recursive: true });
  for (let r = 1; r <= rounds; r++) {
    const res = await swapOnFake(base, [piece], project.roomType, undefined);
    if (!res) { console.error("image produit invalide"); continue; }
    const f = path.join(outDir, `r${r}.png`);
    await writeFile(f, res.buffer);
    console.log(`→ ${f}`);
  }
}

main().catch((e) => { console.error("échec:", e instanceof Error ? e.message : e); process.exit(1); });
