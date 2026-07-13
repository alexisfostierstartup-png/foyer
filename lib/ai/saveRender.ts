import { createSupabaseAdmin } from "@/lib/supabase/server";

function stepToCode(step: string): string {
  if (step === "first-render") return "IN_1";
  if (step === "final") return "FN_1";
  if (step.startsWith("iterate_")) return `IT_${step.split("_")[1]}`;
  return step;
}

/**
 * RENDUS VERSIONNÉS — un chemin NEUF à chaque génération, jamais d'écrasement.
 *
 * Avant, le nom était déterministe (`IN_1.png`, `disposition_2.png`…) et l'upload se
 * faisait en `upsert` : toute régénération DÉTRUISAIT le rendu précédent, sans
 * historique et sans retour possible. Un double-run accidentel a ainsi effacé les 3
 * dispositions que l'utilisateur regardait (2026-07-13), et un rendu aimé avait déjà été
 * perdu de la même façon. Le projet ne garde que l'URL du dernier rendu ; les
 * précédents restent en stockage, récupérables.
 *
 * Le suffixe horodaté rend aussi le cache-buster `?v=` inutile : l'URL est neuve par
 * construction.
 */
export async function saveRender(
  imageBuffer: Buffer,
  storageFolder: string,
  mimeType = "image/jpeg",
  step = "first-render",
): Promise<string> {
  const ext = mimeType.split("/")[1]?.split("+")[0] ?? "jpg";
  const filename = `${storageFolder}/${stepToCode(step)}_${Date.now()}.${ext}`;

  const supabase = createSupabaseAdmin();
  const { error } = await supabase.storage
    .from("renders")
    // upsert reste à true par sécurité (collision de timestamp au sein d'une même
    // milliseconde), mais le chemin est unique : rien n'est écrasé en pratique.
    .upload(filename, imageBuffer, { contentType: mimeType, upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from("renders").getPublicUrl(filename);
  return data.publicUrl;
}

export async function saveSourceImage(
  imageBuffer: Buffer,
  storageFolder: string,
  mimeType = "image/jpeg",
): Promise<string> {
  const ext = mimeType.split("/")[1]?.split("+")[0] ?? "jpg";
  const filename = `${storageFolder}/original.${ext}`;

  const supabase = createSupabaseAdmin();
  const { error } = await supabase.storage
    .from("room-images")
    .upload(filename, imageBuffer, { contentType: mimeType, upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from("room-images").getPublicUrl(filename);
  return data.publicUrl;
}
