#!/usr/bin/env npx tsx
/**
 * CANARY — le crop du PRODUIT change-t-il le classement ?
 *
 * Hypothèse (QA Alexis 2026-07-11) : côté rendu on embedde un crop SERRÉ de l'objet,
 * côté produit la photo ENTIÈRE. Le cosinus mesure donc aussi le cadrage du photographe :
 * un packshot (objet plein cadre, fond blanc) bat une scène de salon (le meuble noyé dans
 * un canapé + étagères + plantes), même quand la scène montre le BON meuble.
 *
 * On mesure, sur le cas réel (projet WzUohGBEDXyYwlsaJLM2P, table basse) :
 *   cos(crop_rendu, photo_produit_ENTIÈRE)  → l'existant
 *   cos(crop_rendu, produit_CROPPÉ)         → la correction
 *
 * Usage : npx tsx scripts/canary-product-crop.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const RENDER_URL =
  "https://vflgjfbbkzyqeydzaaoc.supabase.co/storage/v1/object/public/renders/2026-07-11_16-32_UN_WzUohGBEDXyYwlsaJLM2P/IN_1.png";
const RENDER_BBOX = { x: 0.363193157519601, y: 0.54, w: 0.1592017106200998, h: 0.17 };

const PRODUITS = [
  { rang: 1, nom: "Bout de canapé (APPOINT ✗)", url: "https://medias.maisonsdumonde.com/image/upload/w_1000/img/bout-de-canape-en-manguier-1000-11-24-248279_1.jpg" },
  { rang: 2, nom: "Table d'appoint ronde (APPOINT ✗)", url: "https://medias.maisonsdumonde.com/images/w_1000/mkp/M24159996_1/table-d-appoint-ronde-en-bois-de-manguier-sculptee.jpg" },
  { rang: 3, nom: "Table basse BAHIA (BONNE ✓)", url: "https://www.cdiscount.com/pdt2/9/6/9/1/700x700/leq1708691879969/rw/table-basse-bahia-d-80xh-42cm-chene-artisan.jpg" },
  { rang: 4, nom: "IDMARKET JULIETTE (BONNE ✓)", url: "https://www.cdiscount.com/pdt2/8/2/4/1/700x700/idm1756332276824/rw/idmarket-table-basse-ronde-70-cm-juliette-lattes-t.jpg" },
];

const cos = (a: number[], b: number[]) => {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  return d / (Math.sqrt(na) * Math.sqrt(nb));
};

async function main() {
  const { fetchImageBytes, detectProductBbox } = await import("../lib/ai/pipeline");
  const { extractCrop } = await import("../lib/shopping/crop");
  const { computeImageEmbedding, computeImageEmbeddingFromBytes } = await import("../lib/embeddings/jina");

  const renderBytes = await fetchImageBytes(RENDER_URL);
  const renderCrop = await extractCrop(renderBytes, RENDER_BBOX);
  if (!renderCrop) throw new Error("crop rendu impossible");
  const target = await computeImageEmbeddingFromBytes(renderCrop);

  const lignes: { rang: number; nom: string; avant: number; apres: number }[] = [];
  for (const p of PRODUITS) {
    const avant = cos(target, await computeImageEmbedding(p.url));

    const bytes = await fetchImageBytes(p.url);
    const box = await detectProductBbox(bytes);
    const cropped = box ? await extractCrop(bytes, box) : null;
    const apres = cropped ? cos(target, await computeImageEmbeddingFromBytes(cropped)) : avant;

    lignes.push({ rang: p.rang, nom: p.nom, avant, apres });
    console.log(`${box ? "crop ok " : "crop KO "} ${p.nom}`);
  }

  const rk = (key: "avant" | "apres") =>
    [...lignes].sort((a, b) => b[key] - a[key]).map((l) => l.rang);

  console.log("\n=== cos(crop du rendu, produit) ===");
  console.log("rang  produit                              photo ENTIÈRE   produit CROPPÉ");
  for (const l of lignes) {
    console.log(`  ${l.rang}   ${l.nom.padEnd(36)} ${l.avant.toFixed(4)}          ${l.apres.toFixed(4)}`);
  }
  console.log(`\nclassement image AVANT (photo entière) : ${rk("avant").join(" > ")}`);
  console.log(`classement image APRÈS (produit croppé) : ${rk("apres").join(" > ")}`);
  console.log("\n(3 et 4 = les BONNES tables basses ; 1 et 2 = tables d'appoint)");
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
