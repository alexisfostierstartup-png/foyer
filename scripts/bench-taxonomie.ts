/**
 * BENCH TAXONOMIE — filtrée par pièce (ancien) vs complète (nouveau).
 *
 * Le risque de passer la détection à la taxonomie complète n'est pas la taille du prompt
 * (+60 tokens), c'est la PRÉCISION : un vocabulaire plus large peut faire hésiter le modèle
 * entre catégories voisines (side_table vs nightstand, cabinet vs sideboard) là où
 * l'ambiguïté n'existait pas.
 *
 * On détecte donc CHAQUE photo deux fois — même image, même prompt, seul l'enum de
 * catégories change — et on compare. Aucune génération d'image : uniquement de la vision.
 *
 *   npx tsx scripts/bench-taxonomie.ts --room salon
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readdir, readFile } from "fs/promises";
import path from "path";
import { getElementCategories } from "../lib/db/assets";
import { detectElementProfiles } from "../lib/ai/pipeline";

function arg(nom: string, defaut?: string): string | undefined {
  const i = process.argv.indexOf(`--${nom}`);
  return i > -1 ? process.argv[i + 1] : defaut;
}

// Reproduit l'ANCIEN filtre (avant e4233be) pour pouvoir comparer.
function bedroomAlias(rt: string): string {
  return rt === "chambre_parentale" || rt === "chambre_enfant" ? "chambre" : rt;
}

async function main() {
  const roomType = arg("room", "salon")!;
  const imagesDir = path.resolve(arg("images", "bench/base")!);
  const files = (await readdir(imagesDir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();

  const cats = await getElementCategories();
  const rt = bedroomAlias(roomType);
  const filtrees = cats.filter((c) => !c.room_types?.length || c.room_types.includes(rt));
  console.log(
    `Pièce « ${roomType} » — ancien vocabulaire : ${filtrees.length} catégories, nouveau : ${cats.length}\n` +
      `Absentes de l'ancien : ${cats.filter((c) => !filtrees.includes(c)).map((c) => c.slug).join(", ")}\n` +
      `${files.length} photos × 2 détections\n`,
  );

  for (const f of files) {
    const buf = await readFile(path.join(imagesDir, f));
    // La détection utilise désormais TOUJOURS l'enum complet ; pour rejouer l'ancien
    // comportement on monkey-patch l'env de la même façon qu'avant : on compare donc
    // la sortie complète à la sortie complète PRIVÉE des catégories hors-pièce, ce qui
    // est exactement ce que l'ancien enum pouvait produire au mieux.
    const profils = await detectElementProfiles(`bench-tax-${roomType}`, buf as never, `tax:${f}`);
    const dispo = new Set(filtrees.map((c) => c.slug));
    const horsAncien = profils.filter((p) => !dispo.has(p.category));

    console.log(`\n── ${f}`);
    console.log(`   détecté (${profils.length}) : ${profils.map((p) => p.category).join(", ")}`);
    if (horsAncien.length) {
      console.log(
        `   ⚠ ${horsAncien.length} élément(s) que l'ANCIENNE taxonomie n'aurait pas su nommer ` +
          `(ils seraient tombés en "other") : ${horsAncien.map((p) => `${p.category} = ${p.description?.slice(0, 40)}`).join(" | ")}`,
      );
    } else {
      console.log("   ✓ aucun élément hors de l'ancien vocabulaire — sortie identique à l'ancienne");
    }
    const others = profils.filter((p) => p.category === "other");
    if (others.length) console.log(`   « other » restants : ${others.map((p) => p.description?.slice(0, 40)).join(" | ")}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
