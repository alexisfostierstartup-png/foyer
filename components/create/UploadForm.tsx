"use client";

import { useRef, useState } from "react";
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
  // Ancre du bloc photo. Une fois la photo importée, l'aperçu et le bloc « contraintes »
  // se déploient VERS LE BAS : le sélecteur de pièce continue d'occuper le haut de l'écran
  // et on rate purement et simplement les contraintes (QA Alexis 2026-07-13). On remonte
  // donc le bloc photo en tête de vue — le choix de la pièce reste accessible, il suffit
  // de remonter.
  const blocPhoto = useRef<HTMLDivElement>(null);
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

    // Un HEIC (photo iPhone) ne s'affiche PAS hors Safari : l'aperçu local montrait alors
    // l'icône « image cassée » le temps de la conversion serveur. On ne pose donc pas
    // d'aperçu pour ces fichiers — la zone affiche un loader, et bascule sur la photo
    // convertie (JPEG) renvoyée par le serveur.
    const estHeic =
      /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
    const localPreview = estHeic ? null : URL.createObjectURL(file);
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
        if (localPreview) URL.revokeObjectURL(localPreview);
        setPreviewUrl(null);
        return;
      }

      const { projectId: id, basePhotoUrl } = (await res.json()) as {
        projectId: string;
        basePhotoUrl?: string;
      };
      setProjectId(id);
      // On remplace l'aperçu local par la photo NORMALISÉE par le serveur (toujours du
      // JPEG, redressée). Un HEIC d'iPhone ne s'affiche que sur Safari : ailleurs,
      // l'aperçu local restait une vignette cassée alors que l'upload avait réussi.
      if (basePhotoUrl) {
        setPreviewUrl(basePhotoUrl);
        if (localPreview) URL.revokeObjectURL(localPreview);
      }
      setUploading(false);
      // Après le rendu de l'aperçu (d'où le requestAnimationFrame : sans lui, on
      // mesurerait la position d'AVANT le déploiement du bloc).
      requestAnimationFrame(() => {
        blocPhoto.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch {
      toast.error("Erreur lors de l'envoi de la photo");
      setUploading(false);
      if (localPreview) URL.revokeObjectURL(localPreview);
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
          // Le type de pièce n'était posté QU'À l'upload. Changer la pièce APRÈS avoir
          // importé la photo ne mettait donc rien à jour : l'écran affichait « Salon »
          // pendant que le projet restait une « Chambre » — et la détection, indexée sur
          // les catégories de la pièce, ne cherchait ni canapé ni meuble TV.
          roomType,
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
        <h1 className="whitespace-nowrap font-serif text-[22px] font-medium leading-tight tracking-[-0.02em] text-foyer-ink sm:text-[28px]">
          Prêt à trouver la déco de vos rêves&nbsp;?
        </h1>

        {/* Room type */}
        <div className="mt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foyer-sage">
            Quelle pièce ?
          </p>
          {/* Pills compactes qui s'enroulent : les gros boutons h-16 en grille prenaient
              toute la largeur sur desktop pour un simple choix de pièce. */}
          <div className="mt-3 flex flex-wrap gap-2">
            {roomTypes.map((opt) => {
              const selected = roomType === opt.slug;
              return (
                <button
                  key={opt.slug}
                  type="button"
                  onClick={() => {
                    setRoomType(opt.slug);
                    // Le bloc photo n'existe pas encore au moment du clic (il n'apparaît
                    // qu'avec un roomType) : on attend qu'il soit MONTÉ pour l'amener en vue.
                    requestAnimationFrame(() => {
                      blocPhoto.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    });
                  }}
                  className={cn(
                    "rounded-full px-4 py-2 text-[14px] font-medium transition-all",
                    selected
                      ? "bg-foyer-ink text-white"
                      : "border border-foyer-border bg-white text-foyer-ink hover:border-foyer-sage/60",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Une fois la pièce choisie : sur desktop, le visuel à GAUCHE et les contraintes
            à DROITE (deux colonnes) — les contraintes deviennent visibles sans scroll. Sur
            mobile, ça reste empilé. Le cadre photo, borné à une colonne, cesse d'être trop
            large et de déborder après import. */}
        {roomType && (
          <div className="mt-8 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
          <div ref={blocPhoto} className="scroll-mt-4 duration-300 animate-in fade-in">
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
                {uploading && !previewUrl ? (
                  // Photo non affichable par le navigateur (HEIC d'iPhone) : on ne montre
                  // PAS l'icône « image cassée » le temps que le serveur la convertisse. Un
                  // loader occupe le cadre, et la photo convertie prendra sa place.
                  <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-xl border border-foyer-border bg-foyer-cream">
                    <Loader2 className="size-6 animate-spin text-foyer-sage" aria-hidden />
                    <p className="text-[13px] text-foyer-muted">Préparation de votre photo…</p>
                  </div>
                ) : previewUrl ? (
                  // Le cadre 4/3 n'apparaît QU'UNE FOIS la photo choisie. Vide, il occupait
                  // 640px de haut sur un écran large : un grand rectangle beige pour ne rien
                  // montrer.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Aperçu de votre photo"
                    className="aspect-[4/3] w-full rounded-xl object-cover"
                    // Filet : tout format que ce navigateur ne sait pas décoder retombe sur
                    // le loader plutôt que sur la vignette cassée.
                    onError={() => setPreviewUrl(null)}
                  />
                ) : (
                  // La zone de dépôt EST le bouton d'import : un clic ouvre directement le
                  // sélecteur de photos. Le bouton « Importer depuis la galerie » qui vivait
                  // en dessous faisait doublon — deux chemins pour le même geste.
                  <label
                    className={cn(
                      "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-colors",
                      surZone
                        ? "border-foyer-sage bg-foyer-sage/10"
                        : "border-foyer-border bg-[#F0EBE2] hover:border-foyer-sage/60 hover:bg-foyer-sage/5",
                    )}
                  >
                    <ImagePlus className="size-7 text-foyer-sage" aria-hidden />
                    <span className="text-[15px] font-medium text-foyer-ink">
                      Glissez votre photo ici
                    </span>
                    <span className="text-[13px] text-foyer-muted">
                      ou cliquez pour la choisir dans vos photos
                    </span>
                    <input
                      type="file"
                      accept="image/*,.heic,.heif"
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
                {/* Plus de « On téléverse votre photo… » sous le cadre : le loader vit
                    DANS l'encart, à la place de l'aperçu. Deux indicateurs pour la même
                    attente, l'un sous l'autre, ne disaient rien de plus. */}
                {uploading ? null : !projectId ? (
                  // « Importer depuis la galerie » est SUPPRIMÉ : la zone de dépôt fait déjà
                  // exactement ça, en un clic. Deux chemins pour le même geste, c'était la
                  // « boîte à options » qui obligeait à choisir avant de faire.
                  // Reste l'appareil photo, qui lui est un geste DIFFÉRENT (et n'a de sens
                  // qu'avec un capteur : masqué sur les écrans sans écran tactile).
                  <label className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-foyer-border font-medium text-foyer-ink hover:bg-foyer-cream lg:hidden">
                    <Camera className="size-5" aria-hidden />
                    Prendre une photo maintenant
                    <input
                      type="file"
                      accept="image/*,.heic,.heif"
                      capture="environment"
                      className="sr-only"
                      onChange={(e) => {
                        handleFileSelect(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                ) : (
                  /* Photo uploaded — allow changing it */
                  <label className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-foyer-border font-medium text-foyer-ink hover:bg-foyer-cream">
                    <Camera className="size-4" aria-hidden />
                    Changer la photo
                    <input
                      type="file"
                      accept="image/*,.heic,.heif"
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

          {/* Colonne DROITE — contraintes. Conditionnées au choix de la PIÈCE (et non plus
              à l'import photo) : elles ne dépendent que du roomType, on les montre donc dès
              qu'il est choisi, à côté du visuel, sans attendre l'upload ni scroller. */}
          <div className="mt-6 duration-300 animate-in fade-in lg:mt-0">
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
