import { createSupabaseAdmin } from "@/lib/supabase/server";

function stepToCode(step: string): string {
  if (step === "first-render") return "IN_1";
  if (step === "final") return "FN_1";
  if (step.startsWith("iterate_")) return `IT_${step.split("_")[1]}`;
  return step;
}

export async function saveRender(
  imageBuffer: Buffer,
  storageFolder: string,
  mimeType = "image/jpeg",
  step = "first-render",
): Promise<string> {
  const ext = mimeType.split("/")[1]?.split("+")[0] ?? "jpg";
  const filename = `${storageFolder}/${stepToCode(step)}.${ext}`;

  const supabase = createSupabaseAdmin();
  const { error } = await supabase.storage
    .from("renders")
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
