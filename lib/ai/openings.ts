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

/**
 * COMBIEN d'ouvertures par mur, et non plus « ce mur en a-t-il ? ».
 *
 * Le critère était binaire : un mur ouvert restait ouvert, un mur plein devait le rester.
 * Il ne voyait donc PAS une ouverture AJOUTÉE sur un mur qui en portait déjà une — le
 * modèle a transformé une niche à étagères en PORTE, à côté de la fenêtre existante, et
 * l'audit a répondu « rien à signaler » (dispo 2 de IXbr_ElP, QA Alexis 2026-07-14).
 * On compte.
 */
export function ouverturesParMurSource(profiles: ElementProfile[]): Map<Mur, number> {
  const compte = new Map<Mur, number>();
  for (const p of profiles) {
    if (!CATEGORIES_OUVERTURE[p.category]) continue;
    const mur = murDepuisBbox(p.bbox);
    if (mur) compte.set(mur, (compte.get(mur) ?? 0) + 1);
  }
  return compte;
}

// L'audit tournait en résolution MOYENNE et décrivait « l'architecture » : sur la photo
// d'origine d'Alexis, il répondait « AUCUNE ouverture » alors qu'une porte-fenêtre est là,
// derrière un rideau. Un auditeur aveugle ne signale rien — d'où les 0 corrections sur un
// rendu qui avait pourtant percé un mur (2026-07-14). On lui demande maintenant UNE chose,
// en haute résolution, avec le critère qui tranche : une ouverture TRAVERSE le mur.
const PROMPT_AUDIT = `Inventaire des OUVERTURES de cette photo d'intérieur.

Une OUVERTURE TRAVERSE le mur : fenêtre, porte-fenêtre, porte, ou passage vers une autre pièce. Elle laisse voir autre chose que le mur — le dehors, la lumière du jour, un balcon, une autre pièce. Compte-la même si un rideau, un meuble ou une plante la cache en partie.
N'est PAS une ouverture : un RENFONCEMENT ou une niche creusée dans le mur (avec des étagères, des objets, une télé — le fond du renfoncement est un mur), un miroir, un cadre, un tableau, une bibliothèque.

Le mur GAUCHE part du bord gauche de l'image ; le mur DROITE part du bord droit ; le mur FOND est celui qu'on regarde en face.
Dis aussi si la pièce a une CHEMINÉE (foyer, manteau, insert).

JSON STRICT : {"ouvertures":[{"type":"fenetre|porte_fenetre|porte|passage","mur":"gauche|fond|droite"}],"cheminee":true|false}`;

const VERS_MUR: Record<string, Mur> = { gauche: "LEFT", fond: "BACK", droite: "RIGHT" };

export const MURS: Mur[] = ["LEFT", "BACK", "RIGHT"];

type Architecture = { parMur: Map<Mur, number>; murs: Set<Mur>; cheminee: boolean };

/** Architecture vue dans une image générée : ouvertures COMPTÉES par mur + cheminée. */
async function architectureRendu(image: Buffer): Promise<Architecture | null> {
  const res = await getVisionProvider("gemini_vision").analyze(
    PROMPT_AUDIT,
    [image as unknown as ImageInput],
    { model: "gemini-2.5-flash", mediaResolution: "high" },
  );
  const brut = res.parsed as {
    ouvertures?: Array<{ mur?: string }>;
    cheminee?: boolean;
  } | null;
  if (!brut || !Array.isArray(brut.ouvertures)) return null; // inexploitable → on ne juge pas
  const parMur = new Map<Mur, number>();
  for (const o of brut.ouvertures) {
    const m = VERS_MUR[String(o?.mur ?? "").toLowerCase()];
    if (m) parMur.set(m, (parMur.get(m) ?? 0) + 1);
  }
  return { parMur, murs: new Set(parMur.keys()), cheminee: brut.cheminee === true };
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
    const attenduParMur = ouverturesParMurSource(profilesSource);
    const attendus = new Set<Mur>(attenduParMur.keys());
    // La photo a des ouvertures mais AUCUNE boîte exploitable (vieille analyse, détection
    // muette) → on ignore quels murs sont pleins. On ne juge alors pas les murs, plutôt que
    // de reboucher une vraie fenêtre. La cheminée, elle, reste vérifiable.
    const ouverturesConnues =
      attendus.size > 0 || !profilesSource.some((p) => CATEGORIES_OUVERTURE[p.category]);

    const rendu = await architectureRendu(gen.imageBuffer);
    if (!rendu) return gen;

    // Violation = un mur porte PLUS d'ouvertures que dans la photo. Comparer des ensembles
    // de murs (« ce mur en a-t-il ? ») ratait une ouverture AJOUTÉE à côté d'une vraie :
    // une niche transformée en porte, juste à côté de la fenêtre, passait pour conforme.
    const perces = ouverturesConnues
      ? MURS.filter((m) => (rendu.parMur.get(m) ?? 0) > (attenduParMur.get(m) ?? 0))
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

    // NE JAMAIS SOUFFLER CE QU'ON NE VEUT PAS VOIR.
    //
    // La version précédente disait « rebuild that wall — plain wall, same alcoves, niches,
    // shelving… ». En listant « niches / alcôves » pour qu'il les préserve, je les lui ai
    // SOUFFLÉES : le modèle a rebouché la porte en creusant DEUX NICHES EN ARCHE dans le mur
    // (dispo 3 de IXbr_ElP — les arches vues par Alexis venaient de ma propre réparation).
    // Une consigne de retouche ne nomme QUE ce qu'on veut : ici, un mur plat, plein, nu.
    const editPrompt =
      `IMAGE 1 is a redecorated render of a room. IMAGE 2 is the ORIGINAL PHOTOGRAPH of that same room, same camera angle — ` +
      `IMAGE 2 is the TRUTH about the architecture.\n` +
      `IMAGE 1 is WRONG: ${fautesEn.join("; and ")}.\n` +
      `Fix IMAGE 1: make that wall exactly what IMAGE 2 shows there. If IMAGE 2 shows a bare wall, the result is a bare wall: FLAT, SOLID, ` +
      `smooth painted plaster, in the same colour and finish as the rest of that wall, with its skirting board and cornice running straight across. ` +
      `Carve NOTHING into it: no opening, no window, no door, no passage, no arch, no niche, no alcove, no recess, no built-in shelving. ` +
      `Remove any daylight, balcony railing, curtain or curtain rod that belonged to what you are removing.\n` +
      `Keep EVERYTHING ELSE of IMAGE 1 strictly identical: furniture, layout, rug, decor, wall colour and finish, floor, ceiling, ` +
      `the REAL openings and the REAL alcoves on the other walls, lighting mood and camera framing. Photorealistic.`;

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

    // ON VÉRIFIE QUE LA RÉPARATION A RÉPARÉ.
    //
    // Elle ne le faisait pas : on payait une génération, on livrait le résultat les yeux
    // fermés — et il pouvait être PIRE que l'original (porte rebouchée… par des arches).
    // Le re-audit coûte 0,0003 $, contre 0,041 $ la génération qu'il valide. Si la
    // réparation n'a rien arrangé, on garde l'image de DÉPART : au moins on ne dégrade pas,
    // et on ne relance pas une seconde retouche (jamais de boucle de génération).
    const apres = await architectureRendu(repare.imageBuffer);
    const percesApres = apres && ouverturesConnues
      ? MURS.filter((m) => (apres.parMur.get(m) ?? 0) > (attenduParMur.get(m) ?? 0))
      : [];
    const chemineeApres = apres ? apres.cheminee && !chemineeSource : false;
    const reussie = apres != null && percesApres.length === 0 && !chemineeApres;

    // DEBUG LOCAL : on garde AUSSI l'image réparée, pour pouvoir comparer avant/après dans
    // /admin/logs. Sans ça, le correctif travaillait dans le dos — c'est comme ça que ma
    // réparation a pu inventer des arches sans que personne ne le voie.
    let urlReparee: string | null = null;
    if (GARDER_LA_FAUTIVE) {
      try {
        urlReparee = await saveRender(repare.imageBuffer, storageFolder, repare.mimeType, `${step}_repare`);
      } catch {
        /* le debug ne doit jamais casser la génération */
      }
    }

    await logPipelineEvent({
      project_id: projectId,
      event: "generate",
      step: "architecture-autofix",
      provider: providerName,
      duration_ms: Date.now() - t0,
      render_url: urlReparee ?? undefined,
      metadata: {
        step,
        murs_perces: perces,
        cheminee_inventee: chemineeInventee,
        murs_ouverts_photo: [...attendus],
        image_avant_reparation: urlFautive,
        image_apres_reparation: urlReparee,
        reparation_reussie: reussie,
        murs_perces_apres: percesApres,
      },
    });

    if (!reussie) {
      console.warn(
        `[architecture] ${projectId} · ${step} — la RÉPARATION A ÉCHOUÉ` +
          `${percesApres.length ? ` (mur toujours percé : ${percesApres.map((m) => LIBELLE_FR[m]).join(", ")})` : ""}` +
          `${chemineeApres ? " (cheminée toujours là)" : ""} → on garde l'image d'origine.`,
      );
      return gen;
    }

    return { imageBuffer: repare.imageBuffer, mimeType: repare.mimeType };
  } catch (e) {
    // Un contrôle qui échoue ne doit jamais faire échouer le rendu.
    console.warn(`[ouvertures] ${projectId}: contrôle échoué (non bloquant) :`, e instanceof Error ? e.message : e);
    return gen;
  }
}
