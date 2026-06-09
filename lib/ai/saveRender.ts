import { createSupabaseAdmin } from "@/lib/supabase/server";
import { nanoid } from "nanoid";

export async function saveRender(
  imageBuffer: Buffer,
  projectId: string,
  mimeType = "image/jpeg",
): Promise<string> {
  const ext = mimeType.split("/")[1]?.split("+")[0] ?? "jpg";
  const filename = `${projectId}/${nanoid()}.${ext}`;

  const supabase = createSupabaseAdmin();
  const { error } = await supabase.storage
    .from("renders")
    .upload(filename, imageBuffer, { contentType: mimeType, upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from("renders").getPublicUrl(filename);
  return data.publicUrl;
}

export async function saveSourceImage(
  imageBuffer: Buffer,
  projectId: string,
  mimeType = "image/jpeg",
): Promise<string> {
  const ext = mimeType.split("/")[1]?.split("+")[0] ?? "jpg";
  const filename = `${projectId}/${nanoid()}.${ext}`;

  const supabase = createSupabaseAdmin();
  const { error } = await supabase.storage
    .from("room-images")
    .upload(filename, imageBuffer, { contentType: mimeType, upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from("room-images").getPublicUrl(filename);
  return data.publicUrl;
}
