import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { nanoid } from "nanoid";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getClientIp, checkRateLimit, RATE_LIMITED_BODY } from "@/lib/security/rateLimit";

export const maxDuration = 30;

const ACCEPTED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"]);
const MAX_BYTES = 10 * 1024 * 1024;

// Fallback quand l'extraction par URL échoue : l'user importe directement un JPEG du
// produit. On le normalise (sharp) et on le stocke → imageUrl utilisable par le rendu.
export async function POST(request: NextRequest) {
  if (!(await checkRateLimit(getClientIp(request), "upload", 40))) {
    return NextResponse.json(RATE_LIMITED_BODY, { status: 429 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Aucun fichier reçu" }, { status: 400 });
  }
  if (!ACCEPTED.has(file.type)) {
    return NextResponse.json({ ok: false, error: "Format non supporté (JPG/PNG)" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Image trop volumineuse (max 10 Mo)" }, { status: 413 });
  }

  try {
    const input = Buffer.from(await file.arrayBuffer());
    const out = await sharp(input).rotate().resize({ width: 1000, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    const supabase = createSupabaseAdmin();
    const path = `custom-products/${nanoid()}.jpg`;
    const { error } = await supabase.storage
      .from("renders")
      .upload(path, out, { contentType: "image/jpeg", upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("renders").getPublicUrl(path);
    return NextResponse.json({ ok: true, imageUrl: data.publicUrl });
  } catch (err) {
    console.error("[products/upload-image] error:", err);
    return NextResponse.json({ ok: false, error: "Échec de l'import" }, { status: 500 });
  }
}
