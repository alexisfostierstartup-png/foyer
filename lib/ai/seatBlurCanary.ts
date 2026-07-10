/**
 * CANARY — MASQUAGE DES SIÈGES DANS L'IMAGE D'ENTRÉE (une seule génération).
 *
 * Constat (bancs 07-09/07-10 + test iterate d'Alexis) : le modèle image ancre la
 * silhouette des sièges sur la PHOTO SOURCE — toutes les couches de prompt ont
 * plafonné, mais une édition qui ne voit plus l'original remplace vraiment.
 * Idée : pixeliser la zone des sièges dans l'image d'entrée AVANT la génération —
 * le modèle voit toute l'architecture (verrou shell intact) mais ne peut plus
 * recopier la forme du canapé → il doit en inventer un. Coût : +1 appel vision
 * bbox (~0,005 $, ~3 s), AUCUNE seconde génération.
 *
 * CANARY démontable : tout vit ici + flag SEAT_BLUR_CANARY (défaut OFF) + un seul
 * point d'appel dans runGenerationPipeline. Suppression = ce fichier + 3 lignes.
 * Validation : scripts/canary-seat-blur.ts (A/B avec/sans masquage).
 */
import sharp from "sharp";
import { getVisionProvider } from "./provider";
import { withTracking } from "./track";
import type { ImageInput } from "./types";

// Feature flag : ACTIF par défaut (validé A/B 2026-07-10), kill-switch
// SEAT_BLUR_CANARY=0 pour désactiver sans redéployer de code.
export const SEAT_BLUR_CANARY = process.env.SEAT_BLUR_CANARY !== "0";

export const SEAT_CATS = ["sofa", "armchair", "chair", "dining_chair", "bench"];
// Luminaires fixes : même pathologie d'ancrage que les sièges — le modèle GARDE
// la suspension/applique d'origine et AJOUTE celle du style à côté (double
// point lumineux, récurrent). Pixeliser l'original supprime l'ancre et marque
// l'emplacement exact du remplaçant.
export const LIGHT_CATS = ["ceiling_light", "pendant_lamp", "wall_sconce", "wall_light"];
// Miroirs muraux : même ancrage (« miroir posé SUR le miroir existant » au lieu
// de le remplacer/retirer — projet réel 1KL1DfGJ, 2026-07-10).
export const MIRROR_CATS = ["mirror"];

type Box = { category: string; bbox: [number, number, number, number] };

// Coercition défensive d'une liste {category, box_2d} : nombres, strings
// numériques, ou "a, b, c, d". box_2d [ymin, xmin, ymax, xmax] en 0-1000 =
// convention NATIVE Gemini : demander un autre format produit des sorties
// incohérentes (échelles mélangées, bbox en string) selon le modèle servi.
function parseBoxes(list: Array<{ category?: string; box_2d?: unknown; bbox?: unknown }> | undefined): Box[] {
  return (list ?? [])
    .map((s) => {
      let raw = s.box_2d ?? s.bbox;
      if (typeof raw === "string") raw = raw.split(",");
      if (Array.isArray(raw) && raw.length === 1 && typeof raw[0] === "string") raw = raw[0].split(",");
      const nums = Array.isArray(raw) ? raw.map((v) => Number(v)) : [];
      if (nums.length !== 4 || nums.some((v) => !Number.isFinite(v) || v < 0)) return null;
      const [ymin, xmin, ymax, xmax] = nums.map((v) => (v > 1 ? v / 1000 : v));
      return { category: s.category ?? "", bbox: [xmin, ymin, xmax - xmin, ymax - ymin] as [number, number, number, number] };
    })
    .filter((s): s is Box => s !== null)
    .filter((s) => s.bbox[2] > 0.02 && s.bbox[3] > 0.02 && s.bbox[0] + s.bbox[2] <= 1.01 && s.bbox[1] + s.bbox[3] <= 1.01);
}

function boxesIntersect(a: Box, b: Box): boolean {
  return a.bbox[0] < b.bbox[0] + b.bbox[2] && b.bbox[0] < a.bbox[0] + a.bbox[2] &&
    a.bbox[1] < b.bbox[1] + b.bbox[3] && b.bbox[1] < a.bbox[1] + a.bbox[3];
}

/** Bbox des sièges + des meubles non-siège qui les chevauchent (appel vision
 *  dédié, léger). Les seconds sont RECOLLÉS nets par-dessus la pixelisation :
 *  une table basse devant le canapé ne doit pas être détruite avec lui.
 *  (Piste segmentation abandonnée : tous les modèles dispo hallucinent le
 *  masque — boucle infinie de base64 ou PNG 4×4.) */
export async function detectSeatBboxes(imageBytes: Buffer, projectId: string): Promise<{ seats: Box[]; protect: Box[]; lights: Box[]; fixedFeatures: Box[] }> {
  const res = await withTracking(
    { step: "vision_detection", projectId, provider: "gemini_vision", requestPayload: { promptName: "seat_bbox_canary" } },
    () => getVisionProvider("gemini_vision").analyze(
      `Detect in this interior photo:\n` +
      `1. "seats": every seat (sofa, armchair, chair, bench). Ignore poufs and loose cushions.\n` +
      `2. "overlapping_furniture": every NON-seat element that visually overlaps, sits directly in front of, or stands right behind one of those seats, light fixtures or mirrors — ` +
      `movable objects (coffee table, side table, dining table, pouf, floor lamp, plant...) AND fixed architectural features ` +
      `(fireplace, radiator, window, glass door, column, staircase, built-in shelving, wall recess/alcove/niche, wall corner or step).\n` +
      `3. "light_fixtures": every FIXED light fixture — ceiling pendant, flush mount, chandelier, wall sconce. Ignore floor and table lamps.\n` +
      `4. "mirrors": every wall mirror.\n` +
      `5. "fixed_features": EVERY fixed architectural feature anywhere in the room — fireplace, staircase, column, radiator, built-in shelving, wall recess/alcove/niche.\n` +
      `Strict JSON: {"seats": [{"category": "sofa|armchair|chair|bench", "box_2d": [ymin, xmin, ymax, xmax]}], ` +
      `"overlapping_furniture": [{"category": "...", "box_2d": [...]}], ` +
      `"light_fixtures": [{"category": "ceiling_light|wall_sconce", "box_2d": [...]}], ` +
      `"mirrors": [{"category": "mirror", "box_2d": [...]}], ` +
      `"fixed_features": [{"category": "...", "box_2d": [...]}]} — box_2d normalized to 0-1000, TIGHT around each object.`,
      [imageBytes as unknown as ImageInput],
      { model: "gemini-2.5-flash-lite", mediaResolution: "medium" },
    ),
  );
  const parsed = res.parsed as {
    seats?: Array<{ category?: string; box_2d?: unknown; bbox?: unknown }>;
    overlapping_furniture?: Array<{ category?: string; box_2d?: unknown; bbox?: unknown }>;
    light_fixtures?: Array<{ category?: string; box_2d?: unknown; bbox?: unknown }>;
    mirrors?: Array<{ category?: string; box_2d?: unknown; bbox?: unknown }>;
    fixed_features?: Array<{ category?: string; box_2d?: unknown; bbox?: unknown }>;
  } | null;
  const seats = parseBoxes(parsed?.seats).filter((s) => SEAT_CATS.includes(s.category) && s.bbox[2] > 0.03 && s.bbox[3] > 0.03);
  // Luminaires + miroirs : petits objets → seuil bas (0.015), jamais confondus
  // avec un siège. Miroirs réactivés (2026-07-10 soir) : le garde-fou s'appuie
  // désormais sur la liste DÉDIÉE fixed_features (inconditionnelle), plus sur
  // la détection protect au chevauchement (variable → 2 cheminées rasées).
  const lights = parseBoxes(parsed?.light_fixtures)
    .filter((l) => !SEAT_CATS.includes(l.category) && l.bbox[2] > 0.015 && l.bbox[3] > 0.015)
    .concat(
      parseBoxes(parsed?.mirrors)
        .map((m) => ({ ...m, category: "mirror" }))
        .filter((m) => m.bbox[2] > 0.015 && m.bbox[3] > 0.015),
    );
  const fixedFeatures = parseBoxes(parsed?.fixed_features).filter((f) => !SEAT_CATS.includes(f.category));
  // On ne restaure que ce qui chevauche vraiment un siège, et jamais un siège lui-même.
  const protect = parseBoxes(parsed?.overlapping_furniture)
    .filter((p) => !SEAT_CATS.includes(p.category))
    .filter((p) => seats.some((s) => boxesIntersect(p, s)));
  return { seats, protect, lights, fixedFeatures };
}

/**
 * Pixelise les zones sièges (blocs grossiers : la silhouette devient illisible,
 * la masse colorée générale reste → le modèle comprend « un meuble à réinventer ici »).
 * Renvoie l'image modifiée + la note à ajouter au plan (explique les zones floues).
 */
export async function blurSeatsInSource(
  imageBytes: Buffer,
  projectId: string,
  // Catégories de sièges à NE PAS pixeliser : sièges gardés/customisés (DIY
  // retapissage, housse… — le modèle doit voir leur forme pour la préserver).
  excludeCategories: string[] = [],
): Promise<{ buffer: Buffer; blurredCount: number; planNote: string }> {
  const excluded = new Set(excludeCategories.flatMap((c) => {
    if (c === "dining_chair") return ["dining_chair", "chair"];
    // Alias : la détection bbox rend "ceiling_light" pour pendant/lustre/plafonnier
    // et "wall_sconce" pour toute applique.
    if (c === "pendant_lamp") return ["pendant_lamp", "ceiling_light"];
    if (c === "wall_light") return ["wall_light", "wall_sconce"];
    return [c];
  }));
  const detected = await detectSeatBboxes(imageBytes, projectId);
  const seats = detected.seats.filter((s) => !excluded.has(s.category));
  const lights = detected.lights.filter((l) => !excluded.has(l.category));
  // Les sièges/luminaires gardés-customisés sont RESTAURÉS comme les meubles
  // protect : la fusion de zones peut déborder sur un fauteuil KEEP voisin d'un
  // canapé REPLACE (banc nuit 2026-07-10 : fauteuils conservés remplacés ×2).
  const keptSeats = detected.seats.filter((s) => excluded.has(s.category));
  const keptLights = detected.lights.filter((l) => excluded.has(l.category));
  // Les éléments fixes (liste dédiée) rejoignent les patchs de restauration ET
  // alimentent le garde-fou d'abandon de zone — indépendamment du chevauchement.
  const protect = [...detected.protect, ...detected.fixedFeatures, ...keptSeats, ...keptLights];
  if (seats.length === 0 && lights.length === 0) return { buffer: imageBytes, blurredCount: 0, planNote: "" };

  const img = sharp(imageBytes);
  const meta = await img.metadata();
  const W = meta.width ?? 0, H = meta.height ?? 0;
  if (!W || !H) return { buffer: imageBytes, blurredCount: 0, planNote: "" };

  const toPixels = (b: Box) => {
    const left = Math.max(0, Math.round(b.bbox[0] * W));
    const top = Math.max(0, Math.round(b.bbox[1] * H));
    const width = Math.min(W - left, Math.max(8, Math.round(b.bbox[2] * W)));
    const height = Math.min(H - top, Math.max(8, Math.round(b.bbox[3] * H)));
    return { left, top, width, height };
  };

  // Fusion des zones sièges qui se chevauchent ou se touchent (gap < 2% de
  // l'image) : moins de frontières mosaïque/photo = moins de risque que le
  // modèle traite un petit îlot pixelisé comme une texture à conserver
  // (fuite observée nuit 2026-07-10, run t12b, 7 zones fragmentées).
  type Rect = { left: number; top: number; width: number; height: number };
  const gap = Math.round(Math.min(W, H) * 0.02);
  // Sièges de premier plan TRONQUÉS par le bord bas du cadre : JAMAIS pixelisés.
  // Le modèle ne sait pas réinventer un siège coupé par l'image et recopie la
  // mosaïque telle quelle (2 fuites nuit 2026-07-10, les deux sur le canapé
  // géant bas-droite de test12). Re-skin possible = moindre mal que la fuite.
  const bottomCut = (s: Box) =>
    s.bbox[1] + s.bbox[3] > 0.97 && (s.bbox[3] > 0.35 || s.bbox[2] > 0.4);
  const rects: Rect[] = seats.filter((s) => !bottomCut(s)).map(toPixels).filter((r) => r.width >= 8 && r.height >= 8);
  // Sièges tronqués non pixelisés : nommés dans le plan — sans ancre détruite,
  // le REPLACE est systématiquement ignoré (banc : canapé 1er plan jamais changé).
  const skippedSeats = seats.filter(bottomCut);
  const skippedNote = skippedSeats.length
    ? ` The large ${skippedSeats.map((s) => s.category).join(" and ")} cut by the bottom edge of the photo is NOT pixelated but must STILL be treated per the plan: if the plan replaces it, render a clearly different model occupying the same truncated position — never keep the original.`
    : "";
  const touches = (a: Rect, b: Rect) =>
    a.left - gap < b.left + b.width && b.left - gap < a.left + a.width &&
    a.top - gap < b.top + b.height && b.top - gap < a.top + a.height;
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        if (touches(rects[i], rects[j])) {
          const left = Math.min(rects[i].left, rects[j].left);
          const top = Math.min(rects[i].top, rects[j].top);
          rects[i] = {
            left, top,
            width: Math.max(rects[i].left + rects[i].width, rects[j].left + rects[j].width) - left,
            height: Math.max(rects[i].top + rects[i].height, rects[j].top + rects[j].height) - top,
          };
          rects.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }

  // Garde-fou architecture : si un élément FIXE (cheminée, escalier, colonne,
  // rangement intégré) est couvert à >30% par une zone, on ABANDONNE la zone —
  // le modèle redessine tout le pan de mur mosaïqué et supprime l'élément
  // malgré patch + consigne (cheminée supprimée 2/6 runs test12, nuit 07-10).
  // Un siège re-skinné est un moindre mal qu'une cheminée rasée.
  const HARD_FEATURES = /fireplace|staircase|column|shelving|recess|alcove|niche/i;
  const featureRects = protect.filter((p) => HARD_FEATURES.test(p.category)).map(toPixels);
  const clearsFeatures = (z: Rect, maxOverlap: number) => {
    for (const f of featureRects) {
      const ix = Math.max(0, Math.min(z.left + z.width, f.left + f.width) - Math.max(z.left, f.left));
      const iy = Math.max(0, Math.min(z.top + z.height, f.top + f.height) - Math.max(z.top, f.top));
      if (f.width > 0 && f.height > 0 && (ix * iy) / (f.width * f.height) > maxOverlap) return false;
    }
    return true;
  };
  const safeRects = rects.filter((z) => clearsFeatures(z, 0.3));

  // Luminaires/miroirs : zones propres (pas de fusion avec les sièges — petits
  // objets, fusionner créerait des zones géantes plafond→sol), pas de skip
  // bord-bas. Le garde-fou éléments fixes s'applique AUSSI à eux (miroir de
  // trumeau pixelisé = cheminée redessinée sans son manteau, banc 2026-07-10).
  // Strict (5%) pour luminaires/miroirs : un trumeau fait CORPS avec sa cheminée
  // — le moindre contact avec un élément fixe = pas de pixelisation (banc
  // out-decor-remaster2 : cheminée rasée, remplacée par un canapé).
  const lightRects = lights.map(toPixels).filter((r) => r.width >= 8 && r.height >= 8).filter((z) => clearsFeatures(z, 0.05));

  const overlays: sharp.OverlayOptions[] = [];
  let blurredCount = 0;
  for (const { left, top, width, height } of [...safeRects, ...lightRects]) {
    // Pixelisation forte : réduction à ~8 blocs de large puis agrandissement
    // nearest. IMPORTANT : deux .resize() chaînés ne s'empilent pas dans sharp
    // (le second écrase le premier) → deux pipelines séparés via toBuffer.
    const small = await sharp(imageBytes).extract({ left, top, width, height })
      .resize(Math.max(4, Math.round(width / Math.max(24, width / 8))), null, { kernel: "nearest" })
      .toBuffer();
    const region = await sharp(small).resize(width, height, { kernel: "nearest" }).toBuffer();
    overlays.push({ input: region, left, top });
    blurredCount++;
  }
  if (blurredCount === 0) return { buffer: imageBytes, blurredCount: 0, planNote: "" };
  // Les meubles non-siège qui chevauchent un siège sont recollés NETS par-dessus
  // la pixelisation (pixels d'origine) : la table basse devant le canapé reste
  // parfaitement lisible — indispensable quand elle est conservée (DIY/expert).
  for (const p of protect) {
    let { left, top, width, height } = toPixels(p);
    // Marge de contexte (~2% de l'image) : un patch recollé bord à bord au
    // milieu d'une grande zone mosaïque devient un îlot que le modèle efface
    // (cheminée supprimée, run t12c) ; un peu de photo nette autour l'ancre.
    const m = Math.round(Math.min(W, H) * 0.02);
    left = Math.max(0, left - m); top = Math.max(0, top - m);
    width = Math.min(W - left, width + 2 * m); height = Math.min(H - top, height + 2 * m);
    if (width < 4 || height < 4) continue;
    const original = await sharp(imageBytes).extract({ left, top, width, height }).toBuffer();
    overlays.push({ input: original, left, top });
  }

  const buffer = await img.composite(overlays).jpeg({ quality: 88 }).toBuffer();
  // Éléments fixes détectés autour des sièges : nommés explicitement dans le
  // plan — l'îlot recollé ne suffit pas toujours (cheminée supprimée ×2 nuit
  // 2026-07-10), le modèle doit savoir que la pièce EN A un.
  const FIXED_FEATURES = /fireplace|radiator|staircase|column|window|door|shelving|recess|alcove|niche|corner|step/i;
  const fixedNames = [...new Set(protect.filter((p) => FIXED_FEATURES.test(p.category)).map((p) => p.category))];
  const fixedNote = fixedNames.length
    ? ` This room HAS: ${fixedNames.join(", ")} — these fixed features are clearly visible in the photo and MUST remain present, unchanged and at the same place in your output.`
    : "";
  const lightNote = lightRects.length
    ? ` A pixelated zone ON THE CEILING or high on a wall is a LIGHT FIXTURE to replace: put the new style-matching fixture at that EXACT electrical point — never keep an old fixture elsewhere and never add a second one next to it.`
    : "";
  const planNote =
    `\n- PIXELATED ZONES: the mosaic/pixelated areas in the photo are furniture to fully redesign — ` +
    `invent a brand-new ${""}style-matching piece in each zone (coherent real-world model, realistic size, same location).` +
    lightNote +
    ` Every single mosaic block MUST disappear from your output, including at the image borders — any remaining pixelated ` +
    `texture anywhere (floor, foreground, edges) makes the image WRONG; render realistic floor/wall/furniture there instead. ` +
    `Floor and walls inside a pixelated zone are the SAME floor and walls as the rest of the room — same material, same ` +
    `colour, same laying pattern, continuing seamlessly (never a different pattern inside the zone). ` +
    `NEVER reproduce the pixelation, and do not try to reconstruct the original seat hidden underneath. ` +
    `Sharp furniture visible inside or in front of a pixelated zone (e.g. a coffee table) is NOT part of the seat — treat it normally. ` +
    `The room's architecture (walls, floor, fireplace, windows, radiators, mouldings) continues SEAMLESSLY behind the pixelated zones — ` +
    `never remove or invent an architectural feature because of a pixelated area.` + fixedNote + skippedNote;
  return { buffer, blurredCount, planNote };
}
