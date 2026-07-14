/**
 * VERROU POSITIONNEL DES OUVERTURES — contrôle après génération.
 *
 * Le prompt dit déjà où sont les ouvertures et quels murs sont pleins (cf.
 * buildFixedFeaturesSummary). Ça a fait tomber les défauts de 2 sur 3 à 1 sur 3 —
 * pas à zéro : sur une disposition qui vide le mur d'en face, le modèle continue
 * parfois d'y percer une porte-fenêtre à balcon. Le levier prompt est saturé (bench
 * de compaction 2026-07-12 : le plancher est ~0,75 défaut/rendu quoi qu'on écrive).
 *
 * On CONTRÔLE donc le résultat. Le critère est POSITIONNEL, jamais un comptage : le
 * défaut observé n'était pas un ajout mais un DÉPLACEMENT (porte-fenêtre passée du mur
 * gauche au mur droit — compte inchangé, un garde-fou par comptage y est aveugle).
 *
 * Coût : ~0,0003 $ par rendu pour l'audit (prompt minuscule, ~50 tokens en sortie), contre
 * 0,041 $ pour l'image elle-même. La réparation (une édition ciblée) ne part QUE sur
 * violation avérée.
 */
import { getImageProvider, getVisionProvider } from "./provider";
import { saveRender } from "./saveRender";
import { logPipelineEvent } from "./logger";
import { withTracking } from "./track";
import type { ImageInput } from "./types";
import type { ElementProfile } from "@/lib/diy/types";

// Fetch local plutôt qu'import depuis pipeline.ts : pipeline importe déjà ce module, et
// une dépendance circulaire ESM se paie tôt ou tard en `undefined` à l'exécution.
async function octetsImage(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`photo d'origine inaccessible (HTTP ${r.status})`);
  return Buffer.from(await r.arrayBuffer());
}

export type Mur = "LEFT" | "BACK" | "RIGHT";

// Autofix actif par défaut (autorisation explicite d'Alexis, 2026-07-13 : « construis le
// contrôle positionnel sur les dispositions et à vrai dire partout », « en prod oui on
// contrôle »). Il ne se déclenche JAMAIS à vide : sans violation, aucune image n'est
// regénérée. OPENING_AUTOFIX=0 le coupe.
const OPENING_AUTOFIX = process.env.OPENING_AUTOFIX !== "0";

// L'image FAUTIVE est conservée pour debug — en local seulement (elle ne sert qu'à
// comprendre, et on ne veut pas alourdir le stockage de prod).
const GARDER_LA_FAUTIVE = process.env.NODE_ENV !== "production";

const CATEGORIES_OUVERTURE: Record<string, string> = {
  window: "window",
  french_door: "french door",
  door: "door",
  wall_opening: "open passage",
};

/** Mur porteur d'une boîte, déduit de son centre horizontal (boîte normalisée 0-1). */
export function murDepuisBbox(bbox?: { x: number; w: number }): Mur | null {
  if (!bbox) return null;
  const cx = bbox.x + bbox.w / 2;
  return cx < 0.34 ? "LEFT" : cx > 0.66 ? "RIGHT" : "BACK";
}

/** Murs de la photo d'origine qui PORTENT une ouverture. Les autres sont pleins. */
export function mursOuvertsSource(profiles: ElementProfile[]): Set<Mur> {
  const murs = new Set<Mur>();
  for (const p of profiles) {
    if (!CATEGORIES_OUVERTURE[p.category]) continue;
    const mur = murDepuisBbox(p.bbox);
    if (mur) murs.add(mur);
  }
  return murs;
}

const PROMPT_AUDIT = `Décris l'ARCHITECTURE de cette photo d'intérieur — pas sa décoration.
1) Les OUVERTURES et le mur de chacune. Une ouverture = fenêtre, porte-fenêtre, porte, ou passage ouvert vers une autre pièce. Un miroir, un cadre, un tableau, une niche ou une étagère ne sont PAS des ouvertures.
2) La pièce a-t-elle une CHEMINÉE (foyer, manteau de cheminée, insert) ?
Le mur GAUCHE est celui qui part du bord gauche de l'image ; le mur DROITE part du bord droit ; le mur FOND est celui qu'on regarde en face.
JSON STRICT : {"ouvertures":[{"type":"fenetre|porte_fenetre|porte|passage","mur":"gauche|fond|droite"}],"cheminee":true|false}`;

const VERS_MUR: Record<string, Mur> = { gauche: "LEFT", fond: "BACK", droite: "RIGHT" };

type Architecture = { murs: Set<Mur>; cheminee: boolean };

/** Architecture vue dans une image générée : murs percés + cheminée. */
async function architectureRendu(image: Buffer): Promise<Architecture | null> {
  const res = await getVisionProvider("gemini_vision").analyze(
    PROMPT_AUDIT,
    [image as unknown as ImageInput],
    { model: "gemini-2.5-flash", mediaResolution: "medium" },
  );
  const brut = res.parsed as {
    ouvertures?: Array<{ mur?: string }>;
    cheminee?: boolean;
  } | null;
  if (!brut || !Array.isArray(brut.ouvertures)) return null; // inexploitable → on ne juge pas
  const murs = new Set<Mur>();
  for (const o of brut.ouvertures) {
    const m = VERS_MUR[String(o?.mur ?? "").toLowerCase()];
    if (m) murs.add(m);
  }
  return { murs, cheminee: brut.cheminee === true };
}

const LIBELLE_FR: Record<Mur, string> = { LEFT: "gauche", BACK: "du fond", RIGHT: "de droite" };
const LIBELLE_EN: Record<Mur, string> = { LEFT: "LEFT", BACK: "BACK (the wall you face)", RIGHT: "RIGHT" };

/**
 * Vérifie qu'aucun mur PLEIN de la photo n'a été percé dans le rendu, et le répare sinon.
 *
 * On ne sanctionne QUE le sens « mur plein → percé » : c'est le défaut observé, et c'est le
 * seul qu'une retouche sait corriger proprement (reboucher un trou). Le cas inverse (une
 * ouverture murée) est laissé au prompt : la rouvrir de mémoire produirait pire.
 */
export async function enforceOpeningWalls(
  projectId: string,
  gen: { imageBuffer: Buffer; mimeType: string },
  profilesSource: ElementProfile[],
  providerName: string,
  step: string,
  storageFolder: string,
  /** Photo d'origine — la VÉRITÉ sur l'architecture, montrée au modèle pour réparer. */
  basePhotoUrl: string,
): Promise<{ imageBuffer: Buffer; mimeType: string }> {
  if (!OPENING_AUTOFIX) return gen;
  try {
    const t0 = Date.now();
    const attendus = mursOuvertsSource(profilesSource);
    // La photo a des ouvertures mais AUCUNE boîte exploitable (vieille analyse, détection
    // muette) → on ignore quels murs sont pleins. On ne juge alors pas les murs, plutôt que
    // de reboucher une vraie fenêtre. La cheminée, elle, reste vérifiable.
    const ouverturesConnues =
      attendus.size > 0 || !profilesSource.some((p) => CATEGORIES_OUVERTURE[p.category]);

    const rendu = await architectureRendu(gen.imageBuffer);
    if (!rendu) return gen;

    const perces = ouverturesConnues
      ? [...rendu.murs].filter((m) => !attendus.has(m))
      : [];
    // CHEMINÉE INVENTÉE — même réflexe, autre objet. Une fois la porte-fenêtre interdite,
    // le modèle a meublé le mur du fond libéré avec un manteau de cheminée en marbre
    // (dispo 3 de ZIwoYCyd, 2026-07-14). Le prompt l'interdit pourtant explicitement
    // (« THE FIREPLACE IS SACRED. Never ADD one to a room that has none »). Ce n'est donc
    // pas une ouverture, mais c'est la même faute : inventer de l'architecture sur un mur
    // que la disposition vide. On l'audite dans le MÊME appel — coût inchangé.
    //
    // La cheminée a désormais SA catégorie dans la taxonomie (`fireplace`, ajoutée le
    // 2026-07-14) : c'est elle qui fait foi. Le repli par mots-clés reste, pour les projets
    // analysés AVANT — leur détection ne connaissait pas la catégorie et a rangé la
    // cheminée dans `other`. Sans ce repli, on « réparerait » la cheminée bien réelle des
    // pièces qui en ont une.
    const chemineeSource = profilesSource.some(
      (p) =>
        p.category === "fireplace" ||
        /chemin[ée]e|fireplace|manteau de chemin|insert|po[êe]le/i.test(
          `${p.element ?? ""} ${p.description ?? ""}`,
        ),
    );
    const chemineeInventee = rendu.cheminee && !chemineeSource;
    if (perces.length === 0 && !chemineeInventee) return gen;

    // DEBUG LOCAL : on garde l'image telle que le modèle l'a produite, avant réparation.
    let urlFautive: string | null = null;
    if (GARDER_LA_FAUTIVE) {
      try {
        urlFautive = await saveRender(gen.imageBuffer, storageFolder, gen.mimeType, `${step}_fautif`);
      } catch {
        /* le debug ne doit jamais casser la génération */
      }
      const fautes = [
        perces.length ? `MUR PERCÉ : ${perces.map((m) => LIBELLE_FR[m]).join(", ")}` : null,
        chemineeInventee ? "CHEMINÉE INVENTÉE (absente de la photo)" : null,
      ].filter(Boolean);
      console.warn(
        `\n[architecture] ${projectId} · ${step} — ${fautes.join(" + ")}` +
          ` (murs ouverts dans la photo : ${[...attendus].map((m) => LIBELLE_FR[m]).join(", ") || "aucun"}).` +
          `\n[architecture] image AVANT réparation : ${urlFautive ?? "(non sauvegardée)"}\n`,
      );
    }

    // RÉPARER EN MONTRANT, PAS EN INTERDISANT.
    //
    // Une simple édition (« enlève cette fenêtre, rebouche le mur ») ne marche PAS : le
    // modèle renvoie l'image quasi inchangée, fenêtre comprise (mesuré le 2026-07-13 sur
    // la dispo 3 de 8awlhaUK — audit avant : porte-fenêtre@fond ; après : porte-fenêtre@fond).
    // Un ordre NÉGATIF sur une image ne suffit pas. En revanche, si on lui donne la PHOTO
    // D'ORIGINE en seconde image — « voici la vérité, ce mur est plein, reconstruis-le
    // comme ça » — il le rebouche proprement, niches et corniche comprises, sans toucher
    // au mobilier. On ne lui demande plus d'imaginer un mur : on lui montre le vrai.
    const photo = await octetsImage(basePhotoUrl);
    const fautesEn = [
      perces.length
        ? `it shows an opening (window, french door, balcony or passage) on the ${perces
            .map((m) => LIBELLE_EN[m])
            .join(" and ")} wall, where IMAGE 2 shows a SOLID wall`
        : null,
      chemineeInventee
        ? "it shows a FIREPLACE (mantel and hearth), and this room has none at all in IMAGE 2"
        : null,
    ].filter(Boolean);

    const editPrompt =
      `IMAGE 1 is a redecorated render of a room. IMAGE 2 is the ORIGINAL PHOTOGRAPH of that same room, same camera angle — ` +
      `IMAGE 2 is the TRUTH about the architecture.\n` +
      `IMAGE 1 is WRONG: ${fautesEn.join("; and ")}.\n` +
      `Fix IMAGE 1: rebuild that part of the room exactly as IMAGE 2 shows it — plain wall, same alcoves, niches, shelving, skirting board ` +
      `and cornice, no opening, no daylight, no balcony railing, no curtain or curtain rod, no fireplace, no mantel, no hearth.\n` +
      `Keep EVERYTHING ELSE of IMAGE 1 strictly identical: furniture, layout, rug, decor, wall colour and finish, floor, ceiling, ` +
      `the REAL openings on the other walls, lighting mood and camera framing. Photorealistic.`;

    const repare = await withTracking(
      {
        step: "generation",
        projectId,
        provider: providerName,
        requestPayload: { promptName: "opening_autofix", step, prompt: editPrompt },
      },
      () =>
        getImageProvider(providerName).generateFromText(
          editPrompt,
          gen.imageBuffer as unknown as ImageInput,
          [photo as unknown as ImageInput],
        ),
    );

    await logPipelineEvent({
      project_id: projectId,
      event: "generate",
      step: "architecture-autofix",
      provider: providerName,
      duration_ms: Date.now() - t0,
      metadata: {
        step,
        murs_perces: perces,
        cheminee_inventee: chemineeInventee,
        murs_ouverts_photo: [...attendus],
        image_avant_reparation: urlFautive,
      },
    });

    return { imageBuffer: repare.imageBuffer, mimeType: repare.mimeType };
  } catch (e) {
    // Un contrôle qui échoue ne doit jamais faire échouer le rendu.
    console.warn(`[ouvertures] ${projectId}: contrôle échoué (non bloquant) :`, e instanceof Error ? e.message : e);
    return gen;
  }
}
