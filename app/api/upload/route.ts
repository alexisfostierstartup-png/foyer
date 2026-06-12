import { NextResponse } from "next/server";
import sharp from "sharp";
import { nanoid } from "nanoid";
import { createProject, buildStorageFolder, listProjects } from "@/lib/storage/projects";
import { saveSourceImage } from "@/lib/ai/saveRender";
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

    // Auto-orient via EXIF, downscale, normalize to JPEG.
    const outputBuffer = await sharp(inputBuffer)
      .rotate()
      .resize({ width: UPLOAD_MAX_DIMENSION, withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();

    // userId: undefined until auth is wired up
    const userId: string | undefined = undefined;

    const allProjects = await listProjects();
    const userProjectCount = userId
      ? allProjects.filter((p) => p.userId === userId).length
      : allProjects.filter((p) => !p.userId).length;

    const projectId = nanoid();
    const storageFolder = buildStorageFolder(userId, userProjectCount);
    const basePhotoUrl = await saveSourceImage(outputBuffer, storageFolder);
    const project = await createProject(roomType as RoomType, basePhotoUrl, storageFolder, userId, projectId);

    return NextResponse.json({ projectId: project.id, basePhotoUrl });
  } catch (err) {
    console.error("Upload failed", err);
    return NextResponse.json({ error: "Le traitement de la photo a échoué" }, { status: 500 });
  }
}
