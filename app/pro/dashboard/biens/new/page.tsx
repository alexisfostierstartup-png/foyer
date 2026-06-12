"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Upload, Loader2, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PROPERTY_TYPES = [
  { value: "studio", label: "Studio" },
  { value: "t2", label: "T2" },
  { value: "t3", label: "T3" },
  { value: "t4", label: "T4" },
  { value: "t5plus", label: "T5+" },
  { value: "maison", label: "Maison" },
  { value: "commercial", label: "Commercial" },
  { value: "other", label: "Autre" },
];

const ROOM_TYPES = ["salon", "chambre", "cuisine", "salle_de_bain", "bureau", "entree", "autre"];

type RoomDraft = {
  name: string;
  roomType: string;
  photoFile?: File;
  photoPreview?: string;
  uploading?: boolean;
  uploadedUrl?: string;
};

export default function NewBienPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 fields
  const [address, setAddress] = useState("");
  const [propertyType, setPropertyType] = useState("t3");
  const [surface, setSurface] = useState("");

  // Step 2 fields
  const [rooms, setRooms] = useState<RoomDraft[]>([
    { name: "Salon", roomType: "salon" },
  ]);

  const inputClass =
    "w-full rounded-xl border border-foyer-border bg-foyer-cream px-4 py-2.5 text-[13px] text-foyer-ink outline-none focus:border-foyer-sage transition-colors";

  function addRoom() {
    setRooms((prev) => [...prev, { name: "", roomType: "autre" }]);
  }

  function removeRoom(i: number) {
    setRooms((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handlePhotoChange(i: number, file: File) {
    const preview = URL.createObjectURL(file);
    setRooms((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, photoFile: file, photoPreview: preview, uploading: true } : r)),
    );

    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/pro/rooms/upload", { method: "POST", body: formData });
    if (!res.ok) {
      toast.error("Erreur lors de l'upload de la photo.");
      setRooms((prev) => prev.map((r, idx) => (idx === i ? { ...r, uploading: false } : r)));
      return;
    }
    const { url } = (await res.json()) as { url: string };
    setRooms((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, uploading: false, uploadedUrl: url } : r)),
    );
  }

  async function handleSubmit() {
    if (!address) { toast.error("L'adresse est requise."); return; }
    if (rooms.length === 0) { toast.error("Ajoutez au moins une pièce."); return; }
    if (rooms.some((r) => !r.name)) { toast.error("Nommez toutes les pièces."); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/pro/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          propertyType,
          surfaceM2: surface ? parseFloat(surface) : undefined,
          rooms: rooms.map((r, i) => ({
            name: r.name,
            roomType: r.roomType,
            primaryPhotoUrl: r.uploadedUrl,
            sortOrder: i,
          })),
        }),
      });
      if (!res.ok) throw new Error("Creation failed");
      const { propertyId } = (await res.json()) as { propertyId: string };
      toast.success("Bien créé !");
      router.push(`/pro/dashboard/biens/${propertyId}`);
    } catch {
      toast.error("Erreur lors de la création. Réessayez.");
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => (step > 1 ? setStep(step - 1) : router.back())}
          className="rounded-full p-2 text-foyer-muted transition-colors hover:bg-foyer-border hover:text-foyer-ink"
        >
          <ChevronLeft className="size-4" />
        </button>
        <h1 className="font-serif text-[24px] font-medium text-foyer-ink">Nouveau bien</h1>
        <span className="ml-auto text-[12px] text-foyer-muted">Étape {step}/3</span>
      </div>

      <div className="mx-auto max-w-lg">
        {/* Step 1 — Property details */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-foyer-muted">
                Adresse *
              </label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="12 rue de la Paix, 75001 Paris"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-foyer-muted">
                Type de bien *
              </label>
              <div className="flex flex-wrap gap-2">
                {PROPERTY_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setPropertyType(t.value)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-[13px] font-medium transition-colors",
                      propertyType === t.value
                        ? "border-foyer-sage bg-foyer-sage/15 text-foyer-sage"
                        : "border-foyer-border bg-foyer-cream text-foyer-muted hover:border-foyer-ink/30",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-foyer-muted">
                Surface (m²) — optionnel
              </label>
              <input
                value={surface}
                onChange={(e) => setSurface(e.target.value)}
                type="number"
                placeholder="65"
                className={inputClass}
              />
            </div>

            <button
              type="button"
              onClick={() => { if (!address) { toast.error("L'adresse est requise."); return; } setStep(2); }}
              className="w-full rounded-full bg-foyer-sage py-3 text-[14px] font-semibold text-white shadow-[0_2px_8px_rgba(107,142,111,0.3)]"
            >
              Continuer →
            </button>
          </div>
        )}

        {/* Step 2 — Rooms */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-[13px] text-foyer-muted">
              Ajoutez les pièces et leurs photos. 1 photo par pièce en V1.
            </p>

            {rooms.map((room, i) => (
              <div key={i} className="rounded-2xl border border-foyer-border bg-foyer-cream p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-foyer-muted">Pièce {i + 1}</span>
                  {rooms.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRoom(i)}
                      className="text-foyer-muted hover:text-red-500"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 space-y-2">
                    <input
                      value={room.name}
                      onChange={(e) =>
                        setRooms((prev) =>
                          prev.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)),
                        )
                      }
                      placeholder="Salon principal"
                      className={inputClass}
                    />
                    <select
                      value={room.roomType}
                      onChange={(e) =>
                        setRooms((prev) =>
                          prev.map((r, idx) => (idx === i ? { ...r, roomType: e.target.value } : r)),
                        )
                      }
                      className={inputClass}
                    >
                      {ROOM_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  {/* Photo upload */}
                  <label className={cn(
                    "flex size-20 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors",
                    room.uploadedUrl ? "border-foyer-sage bg-foyer-sage/8" : "border-foyer-border bg-white hover:border-foyer-sage/50",
                  )}>
                    {room.uploading ? (
                      <Loader2 className="size-5 animate-spin text-foyer-muted" />
                    ) : room.photoPreview ? (
                      <img src={room.photoPreview} alt="" className="size-full rounded-xl object-cover" />
                    ) : (
                      <>
                        <Upload className="size-4 text-foyer-muted" />
                        <span className="mt-1 text-[10px] text-foyer-muted">Photo</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handlePhotoChange(i, f);
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addRoom}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-foyer-border py-2.5 text-[13px] font-medium text-foyer-muted transition-colors hover:text-foyer-ink"
            >
              <Plus className="size-4" />
              Ajouter une pièce
            </button>

            <button
              type="button"
              onClick={() => setStep(3)}
              className="w-full rounded-full bg-foyer-sage py-3 text-[14px] font-semibold text-white shadow-[0_2px_8px_rgba(107,142,111,0.3)]"
            >
              Continuer →
            </button>
          </div>
        )}

        {/* Step 3 — Confirm */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-foyer-border bg-foyer-cream p-5">
              <h2 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.08em] text-foyer-muted">
                Récapitulatif
              </h2>
              <div className="space-y-2 text-[14px]">
                <p><span className="text-foyer-muted">Adresse :</span> <span className="font-medium text-foyer-ink">{address}</span></p>
                <p><span className="text-foyer-muted">Type :</span> <span className="capitalize text-foyer-ink">{propertyType}</span></p>
                {surface && <p><span className="text-foyer-muted">Surface :</span> <span className="text-foyer-ink">{surface} m²</span></p>}
                <p><span className="text-foyer-muted">Pièces :</span> <span className="text-foyer-ink">{rooms.length} pièce(s)</span></p>
              </div>
              <ul className="mt-3 space-y-1">
                {rooms.map((r, i) => (
                  <li key={i} className="flex items-center gap-2 text-[12px] text-foyer-muted">
                    <span className={cn("size-1.5 rounded-full", r.uploadedUrl ? "bg-foyer-sage" : "bg-foyer-muted/40")} />
                    {r.name} ({r.roomType}) {!r.uploadedUrl && "— sans photo"}
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-full py-3 text-[14px] font-semibold text-white",
                submitting ? "bg-foyer-muted" : "bg-foyer-sage shadow-[0_2px_8px_rgba(107,142,111,0.3)]",
              )}
            >
              {submitting ? <><Loader2 className="size-4 animate-spin" /> Création…</> : "Créer le bien →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
