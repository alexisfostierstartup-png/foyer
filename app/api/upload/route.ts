import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { nanoid } from "nanoid";
import { createProject, buildStorageFolder } from "@/lib/storage/projects";
import { saveSourceImage } from "@/lib/ai/saveRender";
import { MAX_UPLOAD_BYTES, UPLOAD_MAX_DIMENSION } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { RoomType } from "@/lib/types";

const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
]);

const ROOM_TYPES: RoomType[] = ["salon", "chambre"];

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const file = formData.get("file");
  const roomType = formData.get("roomType");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
  }
  if (typeof roomType !== "string" || !ROOM_TYPES.includes(roomType as RoomType)) {
    return NextResponse.json({ error: "Type de pièce invalide" }, { status: 400 });
  }
  if (!ACCEPTED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Format non supporté (JPG, PNG ou HEIC attendu)" },
      { status: 400 },
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Photo trop volumineuse (max 8 Mo)" }, { status: 413 });
  }

  try {
    const inputBuffer = Buffer.from(await file.arrayBuffer());

    const outputBuffer = await sharp(inputBuffer)
      .rotate()
      .resize({ width: UPLOAD_MAX_DIMENSION, withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();

    // Get authenticated user if any
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    // Get or create anon_id
    const existingAnonId = request.cookies.get("foyer_anon_id")?.value;
    const anonId = existingAnonId ?? nanoid();

    const projectId = nanoid();
    const storageFolder = buildStorageFolder(userId, projectId);
    const basePhotoUrl = await saveSourceImage(outputBuffer, storageFolder);
    const project = await createProject(
      roomType as RoomType,
      basePhotoUrl,
      storageFolder,
      userId,
      projectId,
      userId ? undefined : anonId,
    );

    const res = NextResponse.json({ projectId: project.id, basePhotoUrl });

    // Set anon cookie if not authenticated and not already set
    if (!userId && !existingAnonId) {
      res.cookies.set("foyer_anon_id", anonId, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      });
    }

    return res;
  } catch (err) {
    console.error("Upload failed", err);
    return NextResponse.json({ error: "Le traitement de la photo a échoué" }, { status: 500 });
  }
}
