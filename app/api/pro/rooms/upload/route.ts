import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { nanoid } from "nanoid";
import { createClient, createSupabaseAdmin } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/actions";

const MAX_BYTES = 12 * 1024 * 1024;
const MAX_DIM = 1024;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getProfile(user.id);
  if (profile?.plan !== "pro") return NextResponse.json({ error: "Pro plan required" }, { status: 403 });

  let formData: FormData;
  try { formData = await request.formData(); } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 12MB)" }, { status: 413 });

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  const outputBuffer = await sharp(inputBuffer)
    .rotate()
    .resize({ width: MAX_DIM, withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  const filename = `pro-rooms/${user.id}/${nanoid()}.jpg`;
  const admin = createSupabaseAdmin();
  const { error } = await admin.storage
    .from("room-images")
    .upload(filename, outputBuffer, { contentType: "image/jpeg", upsert: false });

  if (error) return NextResponse.json({ error: "Upload failed" }, { status: 500 });

  const { data } = admin.storage.from("room-images").getPublicUrl(filename);
  return NextResponse.json({ url: data.publicUrl });
}
