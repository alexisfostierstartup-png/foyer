"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, ImagePlus, Frame, Sun, UserRoundX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/create/ProgressBar";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { RoomType } from "@/lib/types";

const STEPS = ["Photo", "Style", "Mobilier", "Rendu", "Projet"];

const ROOM_OPTIONS: { value: RoomType; label: string }[] = [
  { value: "salon", label: "Salon" },
  { value: "chambre", label: "Chambre" },
];

const TIPS = [
  { icon: Frame, text: "Cadrez large, un mur entier visible" },
  { icon: Sun, text: "Éclairage naturel idéalement" },
  { icon: UserRoundX, text: "Sans être dans la pièce vous-même" },
];

export function UploadForm() {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [roomType, setRoomType] = useState<RoomType | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function handleFileSelect(file: File | undefined) {
    if (!file) return;
    if (!roomType) {
      toast.warning("Choisissez d'abord le type de pièce");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("Photo trop volumineuse (max 8 Mo)");
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("roomType", roomType);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        toast.error(data?.error ?? "Erreur lors de l'envoi de la photo");
        setUploading(false);
        URL.revokeObjectURL(localPreview);
        setPreviewUrl(null);
        return;
      }

      const { projectId } = (await res.json()) as { projectId: string };
      router.push(`/create/style?projectId=${projectId}`);
    } catch {
      toast.error("Erreur lors de l'envoi de la photo");
      setUploading(false);
      URL.revokeObjectURL(localPreview);
      setPreviewUrl(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <ProgressBar currentStep={1} labels={STEPS} />

      <main className="mx-auto w-full max-w-md flex-1 px-6 py-8">
        <h1 className="font-serif text-3xl leading-tight text-foyer-ink">
          Commencez par une photo
        </h1>
        <p className="mt-3 text-foyer-muted">
          Une photo de votre pièce suffit. Cadrage large, lumière naturelle de
          préférence.
        </p>

        <fieldset className="mt-8" disabled={uploading}>
          <legend className="mb-2 text-sm font-medium text-foyer-ink">
            Quelle pièce souhaitez-vous transformer&nbsp;?
          </legend>
          <div
            role="radiogroup"
            className="flex gap-1 rounded-xl border border-foyer-border bg-white/40 p-1"
          >
            {ROOM_OPTIONS.map((option) => {
              const selected = roomType === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setRoomType(option.value)}
                  className={cn(
                    "flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                    selected
                      ? "bg-foyer-terra text-white shadow-sm"
                      : "text-foyer-muted hover:text-foyer-ink",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="mt-6">
          <div
            className={cn(
              "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-foyer-border px-6 py-10 text-center transition-opacity",
              !roomType && "opacity-60",
            )}
          >
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Aperçu de votre photo"
                className="mb-4 max-h-56 w-full rounded-lg object-cover"
              />
            ) : (
              <Camera
                className="mb-4 size-10 text-foyer-muted"
                strokeWidth={1.5}
                aria-hidden
              />
            )}

            {uploading ? (
              <p className="flex items-center gap-2 text-sm text-foyer-muted">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                On téléverse votre photo…
              </p>
            ) : (
              <div className="flex w-full flex-col gap-3">
                <Button
                  type="button"
                  size="lg"
                  onClick={() => cameraInputRef.current?.click()}
                  className="h-12 w-full bg-foyer-terra text-white hover:bg-foyer-terra/90"
                >
                  <Camera className="size-5" aria-hidden />
                  Prendre une photo
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={() => galleryInputRef.current?.click()}
                  className="h-12 w-full text-foyer-ink"
                >
                  <ImagePlus className="size-5" aria-hidden />
                  Importer depuis la galerie
                </Button>
              </div>
            )}
          </div>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              handleFileSelect(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              handleFileSelect(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        <ul className="mt-8 space-y-3">
          {TIPS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-foyer-muted">
              <Icon className="size-4 shrink-0 text-foyer-sage" strokeWidth={1.5} aria-hidden />
              {text}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
