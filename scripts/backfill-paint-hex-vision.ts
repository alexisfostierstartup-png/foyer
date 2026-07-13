#!/usr/bin/env npx tsx
/**
 * COULEUR RÉELLE DES PEINTURES — localisée par vision, MESURÉE au pixel.
 *
 * Pourquoi ce script existe. `metadata.color_hex` des peintures venait de deux sources,
 * toutes deux fausses une fois sur six :
 *   - backfill-paint-colors.ts : Gemini DEVINAIT le hex à partir du NOM. D'où six produits
 *     aux noms différents (« vert kaki », « vert tropical », « vert treillis »…) portant le
 *     MÊME hex, et des teintes de fantaisie (« ocre nubie », « trench 6 ») inventées.
 *   - backfill-color-hex.ts : mesure la BANDE DU HAUT de l'image, en supposant un pot posé
 *     sur un fond teinté. Vrai chez Ripolin/Dulux, faux ailleurs → une peinture BLANCHE
 *     enregistrée à #1d1d1d, une NOIRE à #fdfdfd (audit 2026-07-13 : 15/92 incohérentes).
 *
 * La méthode qui tient : le modèle de vision LOCALISE l'aplat de peinture (fond teinté,
 * pastille de teinte sur l'étiquette, mur peint en second plan) — il est bon à ça — et on
 * MESURE les pixels nous-mêmes. On ne lui demande jamais de JUGER une couleur : sur les
 * murs, cette leçon avait déjà coûté un matching entier (cf. lib/shopping/paintMatch.ts).
 *
 * Médiane, pas moyenne : une pastille rognée de travers avale un bout de texte blanc ou de
 * bord de pot ; la moyenne s'en trouve délavée, la médiane l'ignore.
 *
 * Usage :
 *   npx tsx scripts/backfill-paint-hex-vision.ts --limit 12        # canary (aucune écriture sans --write)
 *   npx tsx scripts/backfill-paint-hex-vision.ts --limit 12 --write
 *   npx tsx scripts/backfill-paint-hex-vision.ts --write           # tout le catalogue peinture
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import sharp from "sharp";
import { getVisionProvider } from "../lib/ai/provider";
import { createSupabaseAdmin } from "../lib/supabase/server";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const PROMPT = `Cette image est la fiche produit d'un POT DE PEINTURE d'intérieur.

Trouve une zone montrant la COULEUR DE LA PEINTURE elle-même, en APLAT PUR. Par ordre de préférence :
1. le fond de l'image, quand il est teinté de la couleur du produit ;
2. la pastille / le carré de teinte imprimé sur l'étiquette ;
3. un mur ou un objet peint de cette couleur dans une mise en scène.

LE FOND EST PRESQUE TOUJOURS LA TEINTE. C'est la convention de ces fiches : le pot est posé sur un aplat de SA couleur. Cet aplat peut être très pâle, grisé, presque blanc — c'est quand même la teinte du produit, et c'est ce qu'on veut. Ne le rejette que s'il est un BLANC de studio parfaitement neutre (#ffffff), sans aucune dominante. Dans le doute, prends le fond : un coin haut, loin du pot et du texte.

INTERDIT : le corps du pot (plastique blanc ou gris), le couvercle, le texte, les logos, une ombre.
La zone doit être UNIFORME : que de la couleur, sur au moins 20x20 px.

Réponds en JSON STRICT :
{"trouve": true|false, "source": "fond"|"pastille"|"scene", "box": [ymin, xmin, ymax, xmax]}
box en entiers 0-1000 sur l'image entière. Si aucune zone d'aplat pur n'existe, {"trouve": false}.`;

function arg(nom: string): string | undefined {
  const i = process.argv.indexOf(`--${nom}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

/** Médiane par canal sur la zone → robuste à un bord de pot ou une lettre qui traîne. */
async function medianeHex(buf: Buffer, box: number[]): Promise<string | null> {
  const m = await sharp(buf).metadata();
  const W = m.width ?? 0;
  const H = m.height ?? 0;
  if (!W || !H) return null;
  const [ymin, xmin, ymax, xmax] = box;
  const left = Math.round((xmin / 1000) * W);
  const top = Math.round((ymin / 1000) * H);
  const width = Math.max(4, Math.round(((xmax - xmin) / 1000) * W));
  const height = Math.max(4, Math.round(((ymax - ymin) / 1000) * H));
  if (left < 0 || top < 0 || left + width > W || top + height > H) return null;

  const px = await sharp(buf)
    .extract({ left, top, width, height })
    .resize(16, 16, { fit: "fill" })
    .raw()
    .toBuffer();

  const canaux: number[][] = [[], [], []];
  for (let i = 0; i < px.length; i += 3) {
    canaux[0].push(px[i]);
    canaux[1].push(px[i + 1]);
    canaux[2].push(px[i + 2]);
  }
  const med = canaux.map((c) => {
    c.sort((a, b) => a - b);
    return c[Math.floor(c.length / 2)];
  });
  return "#" + med.map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function main() {
  const limite = Number(arg("limit") ?? 0);
  const ecrire = process.argv.includes("--write");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createSupabaseAdmin() as any;
  let q = sb
    .from("partner_products")
    .select("id,name,primary_image_url,metadata")
    .eq("category", "paint")
    .eq("availability_status", "available")
    .not("primary_image_url", "is", null)
    .order("id");
  if (limite) q = q.limit(limite);
  const { data, error } = await q;
  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  console.log(
    `${data.length} peintures · ${ecrire ? "ÉCRITURE EN BASE" : "SIMULATION (ajouter --write pour écrire)"}\n`,
  );
  let ok = 0;
  let sansAplat = 0;
  let echecs = 0;

  for (const p of data) {
    const nom = p.name.slice(0, 46);
    try {
      const res = await fetch(p.primary_image_url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`image HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());

      const v = await getVisionProvider("gemini_vision").analyze(PROMPT, [buf as never], {
        model: "gemini-2.5-flash",
      });
      const out = v.parsed as { trouve?: boolean; source?: string; box?: number[] } | null;
      if (!out?.trouve || !Array.isArray(out.box) || out.box.length !== 4) {
        sansAplat++;
        console.log(`  ∅  ${p.metadata?.color_hex ?? "??????"} → aucun aplat   ${nom}`);
        continue;
      }

      const hex = await medianeHex(buf, out.box);
      if (!hex) throw new Error("zone hors image");

      if (ecrire) {
        const md = { ...(p.metadata ?? {}), color_hex: hex, color_hex_source: `image_${out.source}` };
        const { error: e } = await sb.from("partner_products").update({ metadata: md }).eq("id", p.id);
        if (e) throw new Error(`update: ${e.message}`);
      }
      ok++;
      const avant = p.metadata?.color_hex ?? "??????";
      const change = avant.toLowerCase() !== hex.toLowerCase() ? "≠" : "=";
      console.log(`  ${change}  ${avant} → ${hex}  [${out.source}]  ${nom}`);
    } catch (e) {
      echecs++;
      console.log(`  ✗  ${nom} : ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`\nMesurées : ${ok} · sans aplat : ${sansAplat} · échecs : ${echecs}`);
  if (!ecrire) console.log("Simulation — rien n'a été écrit.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
