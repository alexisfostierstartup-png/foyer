import { nanoid } from "nanoid";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getProject, buildStorageFolder } from "@/lib/storage/projects";
import type { Project } from "@/lib/types";

/**
 * Duplique un projet en COPIE DE TRAVAIL, pour qu'on puisse le retoucher sans jamais
 * altérer l'original.
 *
 * Pourquoi une vraie copie, et pas juste une nouvelle ligne pointant sur les mêmes
 * images : `saveRender` écrit TOUJOURS au même chemin (`<storageFolder>/IN_1.png`,
 * `expert.png`…) en upsert. Deux projets qui partagent un `storageFolder` partagent donc
 * leurs fichiers : la première régénération de la copie ÉCRASERAIT le rendu de l'original,
 * définitivement (il n'existe aucun historique). La copie doit avoir son propre dossier.
 *
 * Les images sont copiées côté serveur (Supabase `storage.copy`), sans transiter par nous.
 */

// Les deux seaux qui portent le préfixe `storageFolder`.
const SEAUX = ["room-images", "renders"] as const;

export async function forkProject(masterId: string): Promise<string> {
  const master = await getProject(masterId);
  if (!master) throw new Error(`projet introuvable: ${masterId}`);

  const supabase = createSupabaseAdmin();
  const copieId = nanoid();
  const dossierMaster = master.storageFolder;
  const dossierCopie = buildStorageFolder(master.userId, copieId);

  for (const seau of SEAUX) {
    const { data: fichiers, error } = await supabase.storage.from(seau).list(dossierMaster);
    if (error) throw new Error(`copie ${seau}: ${error.message}`);

    for (const f of fichiers ?? []) {
      const { error: erreurCopie } = await supabase.storage
        .from(seau)
        .copy(`${dossierMaster}/${f.name}`, `${dossierCopie}/${f.name}`);
      // Une image manquante ne doit pas faire échouer la copie entière : la fille
      // s'ouvrira avec ce qui a pu être copié, et l'original reste intact quoi qu'il arrive.
      if (erreurCopie) console.warn(`[fork] ${seau}/${f.name}: ${erreurCopie.message}`);
    }
  }

  // Le dossier apparaît dans basePhotoUrl, visionDetectionPhotoUrl, les rendus, l'analyse
  // de rendu, les pièces intégrées… Un remplacement sur le JSON sérialisé les réécrit
  // TOUTES : énumérer les champs un par un en oublierait au premier ajout de champ, et la
  // copie continuerait de pointer sur les fichiers de l'original.
  const copie: Project = JSON.parse(
    JSON.stringify(master).split(dossierMaster).join(dossierCopie),
  );

  copie.id = copieId;
  copie.createdAt = new Date().toISOString();
  copie.storageFolder = dossierCopie;
  copie.parentProjectId = masterId;
  copie.is_saved = false;

  const { error } = await supabase.from("foyer_projects").insert({
    id: copieId,
    user_id: master.userId ?? null,
    anon_id: master.anon_id ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: copie as any,
  });
  if (error) throw new Error(`création de la copie: ${error.message}`);

  return copieId;
}
