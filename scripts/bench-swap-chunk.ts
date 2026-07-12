#!/usr/bin/env npx tsx
/**
 * BENCH — combien de produits NB2 sait-il poser en UNE passe ?
 *
 * Le swap découpe en paquets de 3 (SWAP_CHUNK_SIZE). Ce chiffre était une valeur de
 * DÉPART des tests, jamais mesurée. Il coûte cher : 8 meubles = 3 passes = 3 × 0,08 $
 * ET 3 générations empilées (donc 3× la dégradation). Si NB2 tient les 8 en une passe,
 * on divise le coût du swap par 3 et la dégradation par 3.
 *
 * Protocole : même base (le rendu fictif), mêmes produits, on fait varier UNIQUEMENT
 * la taille des paquets. Un juge vision compte ensuite, produit par produit, s'il est
 * bien présent et fidèle à sa photo de référence.
 *
 * Usage : npx tsx scripts/bench-swap-chunk.ts <projectId> [tailles...]
 *   ex.  npx tsx scripts/bench-swap-chunk.ts 51NekyJs0Qt-ZEhcB6JOa 3 8
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { writeFileSync, mkdirSync } from "node:fs";

const OUT = "scripts/_bench/swap-chunk";

async function main() {
  const [projectId, ...tailles] = process.argv.slice(2);
  const sizes = (tailles.length ? tailles : ["3", "8"]).map(Number);
  if (!projectId) {
    console.error("Usage: npx tsx scripts/bench-swap-chunk.ts <projectId> [tailles...]");
    process.exit(1);
  }

  const { getProject } = await import("@/lib/storage/projects");
  const { swapOnFake } = await import("@/lib/ai/expert");
  const { getVisionProvider } = await import("@/lib/ai/provider");

  const p = await getProject(projectId);
  if (!p?.generatedRenderUrl) throw new Error("projet sans rendu fictif");

  // On rejoue EXACTEMENT les produits déjà intégrés : le résultat de référence existe.
  const pieces = (p.expertIntegratedPieces ?? [])
    .filter((x) => x.imageUrl)
    .map((x) => ({
      category: x.category,
      noun: x.category.replace(/_/g, " "),
      imageUrl: x.imageUrl,
      name: x.name,
      elementId: x.elementId ?? null,
      match: x.match ?? null,
      sourceDesc: null,
    }));

  console.log(`base    : rendu fictif`);
  console.log(`produits: ${pieces.length} — ${pieces.map((x) => x.category).join(", ")}\n`);

  mkdirSync(OUT, { recursive: true });
  const resultats: { taille: number; passes: number; cout: string; fichier: string }[] = [];

  for (const taille of sizes) {
    const passes = Math.ceil(pieces.length / taille);
    console.log(`── paquets de ${taille} → ${passes} passe(s), ${(passes * 0.08).toFixed(2)} $ ──`);
    const t = Date.now();
    const r = await swapOnFake(p.generatedRenderUrl, pieces, p.roomType, taille);
    if (!r) { console.log("   ❌ échec\n"); continue; }
    const f = `${OUT}/chunk-${taille}.png`;
    writeFileSync(f, r.buffer);
    console.log(`   ✓ ${((Date.now() - t) / 1000).toFixed(0)} s → ${f}\n`);
    resultats.push({ taille, passes, cout: (passes * 0.08).toFixed(2), fichier: f });
  }

  // ── Juge vision : chaque produit est-il présent et fidèle ? ──────────────────
  console.log("\n══ JUGE VISION ══\n");
  const liste = pieces.map((x, i) => `${i + 1}. ${x.category} — « ${x.name} »`).join("\n");
  for (const r of resultats) {
    const img = (await import("node:fs")).readFileSync(r.fichier);
    const prompt =
      `Voici le rendu d'un salon. On a demandé au modèle d'y intégrer ${pieces.length} produits précis :\n${liste}\n\n` +
      `Pour CHACUN, dis s'il est VISIBLEMENT PRÉSENT dans l'image (peu importe qu'il soit parfaitement fidèle : ` +
      `présent ou absent). Réponds en JSON STRICT : {"presents": [{"n": 1, "categorie": "...", "present": true|false}]}`;
    const res = await getVisionProvider("gemini_vision").analyze(prompt, [img as never], { model: "gemini-2.5-flash" });
    const parsed = res.parsed as { presents?: { n: number; categorie: string; present: boolean }[] } | null;
    const ok = (parsed?.presents ?? []).filter((x) => x.present).length;
    const absents = (parsed?.presents ?? []).filter((x) => !x.present).map((x) => x.categorie);
    console.log(
      `paquets de ${r.taille}  →  ${ok}/${pieces.length} produits présents   ` +
        `(${r.passes} passe(s), ${r.cout} $)` +
        (absents.length ? `\n              manquants : ${absents.join(", ")}` : ""),
    );
  }
  console.log(`\nImages à comparer à l'œil dans ${OUT}/`);
}
main().catch((e) => { console.error("erreur:", e); process.exit(1); });
