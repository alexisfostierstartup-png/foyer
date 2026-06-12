"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, ImagePlus, Frame, Sun, UserRoundX, Loader2 } from "lucide-react";
import { ProgressBar } from "@/components/create/ProgressBar";
import { ConstraintsAccordion } from "@/components/demo/ConstraintsAccordion";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  initialChoices,
  type UserChoices,
} from "@/components/demo/demo-types";
import type { RoomType } from "@/lib/types";

const STEPS = ["Photo", "Style", "Mobilier", "Rendu", "Projet"];

const ROOM_OPTIONS: { value: RoomType; label: string }[] = [
  { value: "salon", label: "Salon" },
  { value: "chambre", label: "Chambre" },
];

const TIPS = [
  { icon: Frame, text: "Cadrez large (un mur entier visible)" },
  { icon: Sun, text: "Éclairage naturel idéalement" },
  { icon: UserRoundX, text: "Sans être dans la pièce vous-même" },
];

type Props = {
  floorPresets: { slug: string; label: string }[];
  roomDefaults: Record<string, string[]>;
};

export function UploadForm({ floorPresets, roomDefaults }: Props) {
  const router = useRouter();
  const [roomType, setRoomType] = useState<RoomType | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [choices, setChoices] = useState<UserChoices>({
    ...initialChoices,
    roomType: null,
  });
  const [continuing, setContinuing] = useState(false);

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

      const res = await fetch("/api/upload", { method: "POST", body: formData });

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

      const { projectId: id } = (await res.json()) as { projectId: string };
      setProjectId(id);
      setUploading(false);
    } catch {
      toast.error("Erreur lors de l'envoi de la photo");
      setUploading(false);
      URL.revokeObjectURL(localPreview);
      setPreviewUrl(null);
    }
  }

  async function handleContinue() {
    if (!projectId) return;
    setContinuing(true);
    try {
      await fetch(`/api/projects/${projectId}/constraints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          furniture: choices.furniture,
          floor: choices.floor,
          walls: choices.walls,
          accessories: choices.accessories,
        }),
      });
    } catch {
      // non-blocking — constraints are optional
    }
    router.push(`/create/style?projectId=${projectId}`);
  }

  return (
    <div className="flex flex-1 flex-col pb-24">
      <ProgressBar currentStep={1} labels={STEPS} />

      <main className="mx-auto w-full max-w-[480px] flex-1 px-5 py-6">
        <h1 className="font-serif text-[30px] font-medium leading-tight tracking-[-0.02em] text-foyer-ink">
          Votre pièce, transformée. Réellement.
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-foyer-muted">
          Prenez une photo, on imagine le projet ET on vous dit où tout acheter.
        </p>

        {/* Room type */}
        <div className="mt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foyer-sage">
            Quelle pièce ?
          </p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {ROOM_OPTIONS.map((opt) => {
              const selected = roomType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRoomType(opt.value)}
                  className={cn(
                    "h-16 rounded-2xl bg-white font-medium text-foyer-ink transition-all",
                    selected
                      ? "border-2 border-foyer-ink"
                      : "border border-foyer-border",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Upload zone — revealed after room type selected */}
        {roomType && (
          <div className="mt-6 duration-300 animate-in fade-in">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foyer-sage">
              Votre pièce en photo
            </p>
            <div className="relative mt-2 rounded-3xl border border-foyer-border bg-white p-5 pt-7 shadow-sm">
              <span
                className="absolute left-1/2 top-3 h-[5px] w-10 -translate-x-1/2 rounded-full bg-foyer-border"
                aria-hidden
              />

              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Aperçu de votre photo"
                  className="aspect-[4/3] w-full rounded-xl object-cover"
                />
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl border border-foyer-border bg-[#F0EBE2]">
                  <span className="flex size-16 items-center justify-center rounded-full border-2 border-foyer-muted">
                    <span className="size-6 rounded-full border-2 border-foyer-muted" />
                  </span>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-3">
                {uploading ? (
                  <p className="flex items-center justify-center gap-2 py-3 text-sm text-foyer-muted">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    On téléverse votre photo…
                  </p>
                ) : !projectId ? (
                  <>
                    <label className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-foyer-sage font-medium text-white shadow-[0_2px_8px_rgba(107,142,111,0.35)] transition-all hover:-translate-y-0.5 hover:bg-foyer-sage/90 hover:shadow-[0_4px_14px_rgba(107,142,111,0.45)]">
                      <Camera className="size-5" aria-hidden />
                      Prendre une photo
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="sr-only"
                        onChange={(e) => {
                          handleFileSelect(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <label className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-foyer-border font-medium text-foyer-ink hover:bg-foyer-cream">
                      <ImagePlus className="size-5" aria-hidden />
                      Importer depuis la galerie
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          handleFileSelect(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </>
                ) : (
                  /* Photo uploaded — allow changing it */
                  <label className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-foyer-border font-medium text-foyer-ink hover:bg-foyer-cream">
                    <Camera className="size-4" aria-hidden />
                    Changer la photo
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        setProjectId(null);
                        handleFileSelect(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>

              {!projectId && (
                <ul className="mt-4 space-y-2">
                  {TIPS.map(({ icon: Icon, text }) => (
                    <li
                      key={text}
                      className="flex items-center gap-2 text-[13px] text-foyer-muted"
                    >
                      <Icon
                        className="size-4 shrink-0 text-foyer-sage"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                      {text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Constraints — revealed after photo uploaded */}
        {projectId && (
          <div className="mt-6 duration-300 animate-in fade-in">
            <ConstraintsAccordion
              choices={choices}
              setChoices={setChoices}
              floorPresets={floorPresets}
              furnitureItems={roomType ? (roomDefaults[roomType] ?? []) : []}
            />
          </div>
        )}
      </main>

      {/* Sticky continue button — only when photo is ready */}
      {projectId && (
        <div className="sticky bottom-0 -mx-0 border-t border-foyer-border bg-foyer-cream/95 px-5 py-3 backdrop-blur">
          <div className="mx-auto max-w-[480px]">
            <button
              type="button"
              onClick={handleContinue}
              disabled={continuing}
              className={cn(
                "flex h-[52px] w-full items-center justify-center gap-2 rounded-full font-medium transition-all",
                continuing
                  ? "cursor-not-allowed bg-foyer-border text-foyer-muted"
                  : "bg-foyer-sage text-white shadow-[0_2px_8px_rgba(107,142,111,0.35)] hover:-translate-y-0.5 hover:bg-foyer-sage/90 hover:shadow-[0_4px_14px_rgba(107,142,111,0.45)]",
              )}
            >
              {continuing ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Un instant…
                </>
              ) : (
                "Continuer"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
