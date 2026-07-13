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
import { CustomRefInput } from "@/components/create/CustomRefInput";
import type { RoomType, CustomProduct } from "@/lib/types";

const STEPS = ["Photo", "Style", "Mobilier", "Rendu", "Projet"];

// Gros meubles proposés pour « indiquer votre référence » à l'upload (flux expert).
const UPLOAD_FURNITURE: { slug: string; label: string }[] = [
  { slug: "sofa", label: "Canapé" },
  { slug: "armchair", label: "Fauteuil" },
  { slug: "coffee_table", label: "Table basse" },
  { slug: "dining_table", label: "Table à manger" },
  { slug: "chair", label: "Chaise" },
  { slug: "rug", label: "Tapis" },
  { slug: "tv_stand", label: "Meuble TV" },
  { slug: "sideboard", label: "Buffet" },
  { slug: "bookshelf", label: "Bibliothèque" },
  { slug: "bed", label: "Lit" },
  { slug: "nightstand", label: "Table de nuit" },
  { slug: "dresser", label: "Commode" },
];

const TIPS = [
  { icon: Frame, text: "Cadrez large (un mur entier visible)" },
  { icon: Sun, text: "Éclairage naturel idéalement" },
  { icon: UserRoundX, text: "Sans être dans la pièce vous-même" },
];

type Props = {
  floorPresets: { slug: string; label: string }[];
  roomTypes: { slug: string; label: string; furniture: string[] }[];
  // Flux expert (/expert-create) : même UI, mais le projet est créé en mode
  // "expert" → le terminal ajoute le rendu avec les vrais meubles.
  expert?: boolean;
  // Flux DIY beta (/create?diy=beta) : flag persisté sur le projet à l'upload.
  diyBeta?: boolean;
};

export function UploadForm({ floorPresets, roomTypes, expert = false, diyBeta = false }: Props) {
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
  // Flux expert — « j'ai déjà un meuble précis en tête » : produit fourni par URL/JPEG,
  // par catégorie, pré-injecté dès l'upload (utilisé au rendu à la place du matching).
  const [customProducts, setCustomProducts] = useState<Record<string, CustomProduct>>({});
  const [selCat, setSelCat] = useState<string>("sofa");
  // Glisser-déposer : on ne peut pas se contenter de onDrop. Le navigateur OUVRE le
  // fichier dans l'onglet dès qu'on le lâche sur la page — il faut donc annuler le
  // comportement par défaut sur dragOver ET sur drop.
  const [surZone, setSurZone] = useState(false);

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
      if (expert) formData.append("mode", "expert");
      if (diyBeta) formData.append("diy", "beta");

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
          ...(Object.keys(customProducts).length ? { customProducts } : {}),
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

      <main className="mx-auto w-full max-w-[480px] lg:max-w-[960px] flex-1 px-5 py-6">
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
            {roomTypes.map((opt) => {
              const selected = roomType === opt.slug;
              return (
                <button
                  key={opt.slug}
                  type="button"
                  onClick={() => setRoomType(opt.slug)}
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

              <div
                onDragOver={(e) => { e.preventDefault(); if (!projectId) setSurZone(true); }}
                onDragLeave={() => setSurZone(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setSurZone(false);
                  if (projectId) return;
                  handleFileSelect(e.dataTransfer.files?.[0]);
                }}
              >
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Aperçu de votre photo"
                    className="aspect-[4/3] w-full rounded-xl object-cover"
                  />
                ) : (
                  <label
                    className={cn(
                      "flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-[#F0EBE2] px-4 text-center transition-colors",
                      surZone
                        ? "border-foyer-sage bg-foyer-sage/10"
                        : "border-foyer-border hover:border-foyer-sage/60",
                    )}
                  >
                    <ImagePlus className="size-8 text-foyer-muted" aria-hidden />
                    <span className="text-sm font-medium text-foyer-ink">
                      Glissez votre photo ici
                    </span>
                    <span className="text-[13px] text-foyer-muted">ou cliquez pour la choisir</span>
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
                )}
              </div>

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
              furnitureItems={roomType ? (roomTypes.find((r) => r.slug === roomType)?.furniture ?? []) : []}
            />

            {/* Flux expert : indiquer un meuble précis dès l'upload (URL ou JPEG). */}
            {expert && (
              <div className="mt-5 rounded-2xl border border-foyer-border bg-white p-4">
                <p className="text-[14px] font-medium text-foyer-ink">Vous avez déjà un meuble en tête ?</p>
                <p className="mt-0.5 text-[13px] text-foyer-muted">
                  Collez le lien du produit (ou importez sa photo) et on l&apos;intègre à votre rendu.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <select
                    value={selCat}
                    onChange={(e) => setSelCat(e.target.value)}
                    className="rounded-lg border border-foyer-border bg-white px-2.5 py-2 text-[13px] text-foyer-ink outline-none focus:border-foyer-sage"
                  >
                    {UPLOAD_FURNITURE.map((f) => (
                      <option key={f.slug} value={f.slug}>{f.label}</option>
                    ))}
                  </select>
                  <span className="text-[13px] text-foyer-muted">→ votre référence :</span>
                </div>
                <div className="mt-2">
                  <CustomRefInput onPicked={(cp) => setCustomProducts((p) => ({ ...p, [selCat]: cp }))} />
                </div>
                {Object.keys(customProducts).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(customProducts).map(([cat, cp]) => (
                      <span key={cat} className="flex items-center gap-1.5 rounded-full border border-foyer-border bg-foyer-cream/60 py-1 pl-1 pr-2 text-[12px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={cp.imageUrl} alt="" className="size-6 rounded-full object-cover" />
                        {UPLOAD_FURNITURE.find((f) => f.slug === cat)?.label ?? cat}
                        <button type="button" onClick={() => setCustomProducts((p) => { const n = { ...p }; delete n[cat]; return n; })} className="text-foyer-muted hover:text-foyer-ink" aria-label="Retirer">✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
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
