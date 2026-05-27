import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { nanoid } from "nanoid";
import { createProject } from "@/lib/storage/projects";
import { ensureUploadsDir, UPLOADS_DIR } from "@/lib/storage/fs";
import { MAX_UPLOAD_BYTES, UPLOAD_MAX_DIMENSION } from "@/lib/constants";
import type { RoomType } from "@/lib/types";

const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
]);

const ROOM_TYPES: RoomType[] = ["salon", "chambre"];

export async function POST(request: Request) {
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
    return NextResponse.json(
      { error: "Type de pièce invalide" },
      { status: 400 },
    );
  }
  if (!ACCEPTED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Format non supporté (JPG, PNG ou HEIC attendu)" },
      { status: 400 },
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Photo trop volumineuse (max 8 Mo)" },
      { status: 413 },
    );
  }

  try {
    const inputBuffer = Buffer.from(await file.arrayBuffer());

    // Auto-orient via EXIF, downscale, and normalize to JPEG. sharp decodes HEIC
    // only when built with libheif; otherwise this throws and we return 500.
    const outputBuffer = await sharp(inputBuffer)
      .rotate()
      .resize({ width: UPLOAD_MAX_DIMENSION, withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();

    await ensureUploadsDir();
    const fileName = `${nanoid()}.jpg`;
    await fs.writeFile(path.join(UPLOADS_DIR, fileName), outputBuffer);

    const basePhotoUrl = `/uploads/${fileName}`;
    const project = await createProject(roomType as RoomType, basePhotoUrl);

    return NextResponse.json({ projectId: project.id, basePhotoUrl });
  } catch (err) {
    console.error("Upload failed", err);
    return NextResponse.json(
      { error: "Le traitement de la photo a échoué" },
      { status: 500 },
    );
  }
}
