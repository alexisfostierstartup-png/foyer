/**
 * Matching PEINTURE par COULEUR (pas par image — le cosine visuel est inutile pour
 * de la peinture). On lit la couleur dominante des murs dans le rendu (Gemini), et on
 * la compare en ΔE (CIELAB) à la couleur de chaque produit peinture (metadata.color_hex,
 * pré-calculée depuis features.Couleur). Le plus proche en teinte gagne.
 */
import sharp from "sharp";
import { getVisionProvider } from "@/lib/ai/provider";
import type { ImageInput } from "@/lib/ai/types";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { hexToLab, hexToRgb, deltaE } from "@/lib/color";
import type { ProductMatch } from "@/lib/types";

// Le modèle ne JUGE plus la couleur — il LOCALISE seulement les murs, dans les deux
// panneaux. La teinte est ensuite MESURÉE dans les pixels (sampleHex). Motif : sur un
// mur passé de gris à beige chaud (visible à l'œil, #a7a090 → #b0a084 en pixels réels),
// Gemini rapportait « #EBEAE6 → #F4F1EA », soit ΔE 3 — il échantillonne les zones lavées
// par la lumière et sous-estime. Aucun seuil ne rattrape ça (le bruit d'ombre d'un mur
// INCHANGÉ fait déjà ΔE 1,5-4,5) : il fallait cesser de lui demander un jugement de
// couleur (projet -2XwsDxGA 2026-07-11).
const WALL_COLORS_PROMPT = `Cette image contient DEUX photos CÔTE À CÔTE : moitié GAUCHE = AVANT (pièce d'origine), moitié DROITE = APRÈS (rendu). C'est la MÊME pièce sous le même angle.

Liste CHAQUE mur peint visible (même s'il te semble inchangé — c'est un calcul en aval qui décidera). Pour CHAQUE mur, donne :
- "label" : un court repère (ex. "mur de gauche", "mur du fond", "mur derrière le canapé")
- "box_avant" : [ymin, xmin, ymax, xmax] (entiers 0-1000 sur l'image ENTIÈRE) — une zone de PEINTURE PURE de ce mur dans la moitié GAUCHE (AVANT)
- "box_apres" : idem pour LE MÊME mur dans la moitié DROITE (APRÈS)
- "paint_group" : un ENTIER (1, 2, 3…) identifiant LE POT DE PEINTURE utilisé sur ce mur dans l'APRÈS.
- "paint_hex" : la couleur du POT de peinture de ce mur dans l'APRÈS, en hex "#rrggbb" — telle qu'elle serait NOMMÉE sur un nuancier, c'est-à-dire CORRIGÉE de l'éclairage : un mur terre cuite ensoleillé paraît délavé à l'écran et brun sombre à l'ombre, mais son POT reste terre cuite (rouge-orangé). Regarde TOUS les pans de ce pot, compense la lumière, et donne la teinte du PIGMENT — pas la moyenne des pixels.

RÈGLE DU paint_group — c'est la question la plus importante :
Deux pans peints avec LA MÊME peinture portent le MÊME paint_group, même s'ils n'ont pas l'air d'avoir la même couleur à l'écran. Un pan à l'ombre, un pan éclairé en plein par une fenêtre, un mur de biais, un retour d'angle : la lumière change énormément la teinte APPARENTE (un beige au soleil vire à l'orangé, à l'ombre au brun), mais c'est LE MÊME POT. Tu vois la lumière, toi — sers-t'en. Ne donne des paint_group DIFFÉRENTS que si le peintre a vraiment ouvert deux pots de couleurs différentes (ex. un mur d'accent terracotta contre trois murs blancs, ou un soubassement foncé sous un haut clair).
En cas de doute, donne le MÊME paint_group : un mur repeint en une seule couleur ne doit pas se retrouver facturé en trois pots.

Les deux boîtes doivent cadrer une surface de mur NUE et bien éclairée : PAS de meuble, cadre, rideau, fenêtre, plinthe, plafond, ni zone d'ombre marquée ou de reflet. Plutôt petites et franchement au centre du pan de mur. box_avant doit être dans la moitié GAUCHE, box_apres dans la moitié DROITE.

Réponds en JSON STRICT, rien d'autre : {"walls":[{"label":"...","paint_group":1,"paint_hex":"#rrggbb","box_avant":[ymin,xmin,ymax,xmax],"box_apres":[ymin,xmin,ymax,xmax]}]}`;

const norm = (h: string) => `#${h.trim().replace(/^#/, "").toLowerCase()}`;
const validHex = (h?: string) => !!h && /^#?[0-9a-fA-F]{6}$/.test(h.trim());

// Seuil anti-bruit sur des couleurs MESURÉES (plus des estimations du modèle) : on peut
// donc descendre à 5. Un mur non repeint ne varie que par la lumière/l'exposition entre les
// deux images ; un vrai repeint, même subtil (gris → beige chaud), le dépasse largement.
const WALL_UNCHANGED_DELTAE = 5;

// bbox du mur repeint, normalisée 0-1 sur le COMPOSITE entier (l'appelant la
// reprojette sur le panneau APRÈS via mapCompositeBoxToRender) → pin peinture.
// `bboxes` : un mur "fusionné" (même peinture sur plusieurs pans) garde UN pin
// par pan tout en ne comptant qu'UNE ligne d'achat.
export type Bbox2 = { x: number; y: number; w: number; h: number };
// `group` : le pot de peinture, tel que le MODÈLE VISION l'a identifié (paint_group).
// C'est lui qui fait foi pour le regroupement — cf. mergeWallColors.
export type WallColor = { hex: string; label: string; group?: number; bbox?: Bbox2; bboxes?: Bbox2[] };

// ── Rationalisation : plusieurs pans du MÊME mur repeint = UNE peinture ──────
// L'ombre et l'exposition décalent la LUMINANCE (L*) mais pas la TEINTE : sur un
// cas réel (projet QAWf50S1), 3 pans du même beige donnaient Δab 0,1-1,7 alors que
// deux vraies couleurs sont à Δab ≥ 9 (sauge clair/foncé) et 18-41 pour le piège
// beige↔jaune. On fusionne donc sur la distance CHROMA/TEINTE (a*,b*), avec un
// garde-fou ΔE global pour ne pas fondre un bicolore volontaire de même teinte
// (ex. soubassement foncé + haut clair : Δab faible mais ΔE ~22).
const SAME_PAINT_AB = 6; // Δ(a*,b*) — au-delà, teintes différentes → 2 lignes
// Garde-fou ΔE desserré 14 → 20 (2026-07-11) : depuis que la couleur est MESURÉE sur
// les pixels, un pan à l'ombre lit bien plus sombre. Mesuré sur cas réels : un mur et
// sa colonne d'angle (MÊME peinture) donnent ΔE 15,2 / Δab 2,1, tandis que deux murs
// VRAIMENT différents (beige vs sauge) donnent ΔE 15,8 / Δab 7,4 — le ΔE ne discrimine
// PAS (15,2 vs 15,8), seul le Δab le fait. À 14, la colonne à l'ombre devenait une 2e
// ligne de peinture. À 20, elle fusionne, et un vrai bicolore de même teinte (ΔE ~22)
// reste séparé.
const SAME_PAINT_DE = 20;

function isSamePaint(h1: string, h2: string): boolean {
  const a = hexToLab(h1), b = hexToLab(h2);
  if (!a || !b) return false;
  const dAB = Math.sqrt((a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
  return dAB < SAME_PAINT_AB && deltaE(a, b) < SAME_PAINT_DE;
}

// Moyenne RGB des pans fusionnés → hex représentatif (mi-ton du mur réel).
function averageHex(hexes: string[]): string {
  const rgbs = hexes.map(hexToRgb).filter(Boolean) as [number, number, number][];
  if (rgbs.length === 0) return hexes[0];
  const avg = [0, 1, 2].map((i) => Math.round(rgbs.reduce((s, c) => s + c[i], 0) / rgbs.length));
  return `#${avg.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Un pot de peinture = UNE ligne d'achat (avec un pin par pan).
 *
 * Le regroupement suit le `paint_group` du MODÈLE VISION, pas la distance entre
 * pixels. Raison (projet 51NekyJs0Qt, 2026-07-11) : trois pans d'UNE MÊME peinture
 * mesuraient Δab 16,1 / ΔE 16,1, alors que deux murs de couleurs VRAIMENT
 * différentes (beige vs sauge, cf. plus haut) mesuraient Δab 7,4 / ΔE 15,8. La
 * paire « identique » était donc PLUS ÉLOIGNÉE que la paire « différente » : aucun
 * seuil, sur aucune des deux métriques, ne peut séparer ces deux cas. La lumière
 * (baie vitrée, retour d'angle à l'ombre) décale la teinte mesurée bien plus fort
 * qu'un changement de peinture. C'est la MESURE qui est corrompue, pas le seuil qui
 * est mal réglé — d'où les allers-retours 14 → 20 sur SAME_PAINT_DE.
 *
 * Le modèle, lui, VOIT l'ombre et sait la compenser. On lui demande donc le
 * regroupement, et on ne garde la distance pixel qu'en repli s'il ne le fournit pas.
 * Le hex mesuré reste la source de vérité pour MATCHER le produit peinture.
 */
export function mergeWallColors(walls: WallColor[]): WallColor[] {
  const groups: { key: number | null; members: WallColor[] }[] = [];
  for (const w of walls) {
    const g =
      w.group != null
        ? groups.find((grp) => grp.key === w.group)
        : groups.find((grp) => isSamePaint(grp.members[0].hex, w.hex)); // repli
    if (g) g.members.push(w);
    else groups.push({ key: w.group ?? null, members: [w] });
  }
  return groups.map(({ members }) => {
    const bboxes = members.map((m) => m.bbox).filter(Boolean) as Bbox2[];
    return {
      hex: members.length > 1 ? averageHex(members.map((m) => m.hex)) : members[0].hex,
      // Plusieurs pans d'une même peinture : libellé générique plutôt qu'une
      // énumération (« mur de gauche · mur du fond · … ») illisible en liste.
      label: members.length > 1 ? "murs" : members[0].label,
      bbox: bboxes[0],
      bboxes,
    };
  });
}

// box_2d Gemini = [ymin, xmin, ymax, xmax] en 0-1000 (convention OBLIGATOIRE,
// cf. leçon bbox 2026-07-10) → {x,y,w,h} normalisé 0-1.
function parseBox2d(raw: unknown): Bbox2 | undefined {
  if (!Array.isArray(raw) || raw.length !== 4) return undefined;
  const [ymin, xmin, ymax, xmax] = raw.map(Number);
  if ([ymin, xmin, ymax, xmax].some((v) => !Number.isFinite(v))) return undefined;
  const b = { x: xmin / 1000, y: ymin / 1000, w: (xmax - xmin) / 1000, h: (ymax - ymin) / 1000 };
  return b.w > 0 && b.h > 0 ? b : undefined;
}

/**
 * Couleur MESURÉE dans les pixels d'une zone (moyenne 8×8 après resize) — remplace le
 * jugement de couleur du modèle, qui sous-estimait systématiquement (cf. WALL_COLORS_PROMPT).
 */
async function sampleHex(image: Buffer, box: Bbox2): Promise<string | null> {
  try {
    const meta = await sharp(image).metadata();
    const W = meta.width ?? 0;
    const H = meta.height ?? 0;
    if (!W || !H) return null;
    const left = Math.max(0, Math.min(W - 1, Math.round(box.x * W)));
    const top = Math.max(0, Math.min(H - 1, Math.round(box.y * H)));
    const width = Math.max(1, Math.min(W - left, Math.round(box.w * W)));
    const height = Math.max(1, Math.min(H - top, Math.round(box.h * H)));
    if (width < 4 || height < 4) return null;
    const { data } = await sharp(image)
      .extract({ left, top, width, height })
      .resize(16, 16, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    // La MOYENNE de toute la boîte incluait ombres et recoins : sur un mur en partie
    // ombré, le hex mesuré sortait bien plus sombre que la peinture réelle → pots
    // matchés trop foncés (QA Alexis 2026-07-16, ND5qBys). On ne moyenne que la
    // tranche ÉCLAIRÉE des pixels (quantiles 55-90 % de luminance) : les ombres
    // tombent en dessous, les reflets brûlés au-dessus — reste la peinture telle
    // qu'elle se lit en lumière du jour. Les deux panneaux (avant/après) passent
    // par le même échantillonneur, le ΔE compare donc des mesures homogènes.
    const px: Array<{ r: number; g: number; b: number; l: number }> = [];
    for (let i = 0; i + 2 < data.length; i += 3) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      px.push({ r, g, b, l: 0.2126 * r + 0.7152 * g + 0.0722 * b });
    }
    px.sort((a, b) => a.l - b.l);
    const tranche = px.slice(Math.floor(px.length * 0.55), Math.ceil(px.length * 0.9));
    if (tranche.length === 0) return null;
    const moy = (f: (p: (typeof px)[number]) => number) =>
      tranche.reduce((s, p) => s + f(p), 0) / tranche.length;
    const hx = (v: number) => Math.round(v).toString(16).padStart(2, "0");
    return `#${hx(moy((p) => p.r))}${hx(moy((p) => p.g))}${hx(moy((p) => p.b))}`;
  } catch {
    return null;
  }
}

/**
 * Murs RÉELLEMENT repeints. Le modèle LOCALISE les murs dans les deux panneaux ; la
 * couleur est MESURÉE dans les pixels, puis comparée en ΔE. Le seuil peut donc être
 * bas (5) : on ne compare plus deux estimations bruitées, mais deux mesures.
 */
export async function getChangedWallColors(composite: ImageInput): Promise<WallColor[]> {
  try {
    const res = await getVisionProvider("gemini_vision").analyze(WALL_COLORS_PROMPT, [composite], {
      model: "gemini-2.5-flash",
    });
    const walls =
      (res.parsed as {
        walls?: Array<{ label?: string; paint_group?: unknown; paint_hex?: string; box_avant?: unknown; box_apres?: unknown }>;
      } | null)?.walls ?? [];

    // La mesure exige les octets ; sans eux (cas théorique), on ne devine pas.
    if (!Buffer.isBuffer(composite)) {
      console.warn("[paintMatch] composite non-Buffer → mesure pixel impossible");
      return [];
    }

    const out: WallColor[] = [];
    for (const w of walls) {
      const boxAvant = parseBox2d(w.box_avant);
      const boxApres = parseBox2d(w.box_apres);
      if (!boxAvant || !boxApres) continue;

      const hexAvant = await sampleHex(composite, boxAvant);
      const hexApres = await sampleHex(composite, boxApres);
      if (!hexAvant || !hexApres) continue;

      const la = hexToLab(hexAvant);
      const lb = hexToLab(hexApres);
      if (!la || !lb) continue;
      const dE = deltaE(la, lb);
      if (dE < WALL_UNCHANGED_DELTAE) continue; // même peinture, seule la lumière varie

      const group = Number(w.paint_group);
      // TEINTE DU POT : l'estimation SÉMANTIQUE du modèle (paint_hex, corrigée de
      // l'éclairage) prime sur la mesure pixel pour NOMMER la couleur à acheter.
      // La mesure pixel est structurellement battue ici : un mur terre cuite lit
      // gris-beige au soleil et brun-taupe à l'ombre — aucun quantile ne retrouve
      // le pigment (mesuré sur ND5qBys : pot juste #c58160, pixels #9a7d6a).
      // Le pixel GARDE le test « a changé » (ΔE avant/après ci-dessus) : deux
      // mesures homogènes y restent plus fiables que deux estimations.
      const potHex = validHex(w.paint_hex) ? norm(w.paint_hex!) : hexApres;
      out.push({
        hex: potHex,
        label: (w.label ?? "mur").trim() || "mur",
        group: Number.isFinite(group) ? group : undefined,
        bbox: boxApres,
      });
    }
    // Pans d'un même pot de peinture → UNE seule ligne d'achat (un pin par pan).
    return mergeWallColors(out);
  } catch (e) {
    console.warn("[paintMatch] couleurs murs:", e instanceof Error ? e.message : e);
    return [];
  }
}

/** Lab → teinte (angle, en degrés) et chroma (saturation perceptuelle). */
function teinteEtChroma(lab: number[]): { teinte: number; chroma: number } {
  const [, a, b] = lab;
  let teinte = (Math.atan2(b, a) * 180) / Math.PI;
  if (teinte < 0) teinte += 360;
  return { teinte, chroma: Math.hypot(a, b) };
}

function ecartDeTeinte(t1: number, t2: number): number {
  const d = Math.abs(t1 - t2);
  return d > 180 ? 360 - d : d;
}

// En dessous de ce chroma, la couleur est un vrai neutre (blanc cassé, gris) : son angle
// de teinte n'est plus qu'un artefact numérique, on ne filtre donc pas dessus.
const CHROMA_NEUTRE = 5;

export async function matchPaintByColor(targetHex: string, topN = 4): Promise<ProductMatch[]> {
  const targetLab = hexToLab(targetHex);
  if (!targetLab) return [];
  const cible = teinteEtChroma(targetLab);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAdmin() as any;
  const { data, error } = await supabase
    .from("partner_products")
    .select("id,name,category,merchant,source_type,price,primary_image_url,product_url,metadata")
    .eq("category", "paint")
    .eq("availability_status", "available")
    .not("metadata->>color_hex", "is", null);
  if (error) {
    console.warn("[paintMatch] requête:", error.message);
    return [];
  }

  // Seuil de distance couleur : au-delà, ce n'est plus la même famille (ex. mur jaune
  // vs peinture marron) → "À sourcer" plutôt qu'un faux match. ΔE 24 (CIE76) tolère une
  // teinte proche mais moins saturée/claire (ex. mur or/miel #d9b15c → peinture or #E0B22C,
  // ΔE 20.6) tout en rejetant les vraies autres couleurs (ΔE ~30+).
  const MAX_DELTA_E = 24;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidats = (data ?? [])
    .map((r: any) => {
      const lab = hexToLab(r.metadata?.color_hex);
      if (!lab) return { r, dE: Infinity, ecart: 999, chroma: 0 };
      const { teinte, chroma } = teinteEtChroma(lab);
      return { r, dE: deltaE(targetLab, lab), ecart: ecartDeTeinte(cible.teinte, teinte), chroma };
    })
    .filter((x: { dE: number }) => x.dE <= MAX_DELTA_E);

  // LA TEINTE PRIME — sur un mur, c'est elle qu'on voit.
  //
  // Le ΔE (CIE76 comme CIEDE2000) met clarté, chroma et teinte sur le MÊME plan. Pour un
  // mur vert-olive (#7d7e6c : teinte 111°, chroma 10), il élisait donc une peinture TAUPE
  // (#8B8272, teinte 87° — jaune-chaud) à ΔE 5,0, simplement parce qu'elle tombait à la
  // même clarté : « le mur est vert, la peinture proposée est grise » (QA Alexis
  // 2026-07-13, projet zvU9qetu). Les vraies peintures vertes du catalogue, elles,
  // étaient reléguées à ΔE 10 pour être un peu plus foncées. ΔE2000 ne corrige rien
  // (taupe 6,2 contre kaki 8,9 — vérifié).
  //
  // On filtre donc AVANT de classer : même famille de teinte, et pas de peinture délavée
  // là où le mur est coloré (un gris pour un mur vert reste un gris). Le ΔE ne sert plus
  // qu'à départager les candidats DÉJÀ dans la bonne teinte.
  const filtreTeinte = (max: number, planch: number) =>
    candidats.filter(
      (x: { ecart: number; chroma: number }) =>
        x.ecart <= max && x.chroma >= cible.chroma * planch,
    );

  let retenus = candidats;
  if (cible.chroma >= CHROMA_NEUTRE) {
    // Strict, puis desserré : mieux vaut un vert imparfait qu'un taupe parfait.
    retenus = filtreTeinte(20, 0.6);
    if (retenus.length === 0) retenus = filtreTeinte(35, 0.45);
    if (retenus.length === 0) retenus = candidats; // catalogue muet sur cette teinte
  } else {
    // Mur NEUTRE (blanc cassé, gris) : la symétrie compte — ne pas lui proposer une
    // peinture franchement colorée sous prétexte qu'elle est à la bonne clarté.
    const sobres = candidats.filter((x: { chroma: number }) => x.chroma <= cible.chroma + 8);
    if (sobres.length > 0) retenus = sobres;
  }

  const scored = retenus
    .sort((a: { dE: number }, b: { dE: number }) => a.dE - b.dE)
    .slice(0, topN);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return scored.map(({ r, dE }: { r: any; dE: number }) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    merchant: r.merchant,
    source_type: r.source_type,
    price: r.price != null ? Number(r.price) : null,
    primary_image_url: r.primary_image_url ?? null,
    product_url: r.product_url ?? null,
    // ΔE → score perceptuel. Repères CIE76 : ΔE~2.3 = différence à peine perceptible
    // (JND), ~5 proche, ~15 visible. Courbe choisie pour qu'un BON match (ΔE≤4) lise
    // ~93-96%, un match correct (ΔE~12) ~78%, et descende ensuite.
    similarity: Math.round(Math.max(0, 1 - dE / 55) * 1000) / 1000,
  }));
}
