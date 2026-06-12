"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const AMBIANCES = [
  { slug: "scandinave", label: "Scandinave", color: "#e8e0d4" },
  { slug: "japandi", label: "Japandi", color: "#c9c3b8" },
  { slug: "industriel", label: "Industriel", color: "#7a7068" },
  { slug: "boheme", label: "Bohème", color: "#c4a882" },
  { slug: "contemporain", label: "Contemporain", color: "#b0bec5" },
  { slug: "classique", label: "Classique", color: "#d4c5a9" },
  { slug: "minimaliste", label: "Minimaliste", color: "#e0dcd6" },
  { slug: "tropical", label: "Tropical", color: "#a5c4a5" },
];

const MODES = [
  { value: "fast", label: "Rapide", description: "1 image par rendu · ~30s" },
  { value: "quality", label: "Qualité", description: "2 images par rendu · ~90s" },
  { value: "portfolio", label: "Portfolio", description: "3 images + mise en page · ~3min" },
];

type Room = { id: string; name: string; room_type: string; primary_photo_url?: string | null };
type Property = { id: string; address: string; property_type: string };

function ProCreateInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPropertyId = searchParams.get("propertyId");

  const [step, setStep] = useState(1);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(preselectedPropertyId ?? "");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
  const [selectedAmbiances, setSelectedAmbiances] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState("fast");
  const [constraints, setConstraints] = useState("");
  const [launching, setLaunching] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Load properties
  useEffect(() => {
    fetch("/api/pro/properties/list").then((r) => r.json()).then((data: Property[]) => {
      setProperties(data ?? []);
      if (preselectedPropertyId) setSelectedPropertyId(preselectedPropertyId);
    }).catch(() => {});
  }, [preselectedPropertyId]);

  // Load rooms when property changes
  useEffect(() => {
    if (!selectedPropertyId) return;
    setLoadingRooms(true);
    fetch(`/api/pro/properties/${selectedPropertyId}/rooms`)
      .then((r) => r.json())
      .then((data: Room[]) => {
        setRooms(data ?? []);
        setSelectedRoomIds(new Set((data ?? []).map((r: Room) => r.id)));
      })
      .finally(() => setLoadingRooms(false));
  }, [selectedPropertyId]);

  function toggleRoom(id: string) {
    setSelectedRoomIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAmbiance(slug: string) {
    setSelectedAmbiances((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  }

  const totalRenders = selectedRoomIds.size * selectedAmbiances.size;

  async function handleLaunch() {
    if (!selectedPropertyId) { toast.error("Sélectionnez un bien."); return; }
    if (selectedRoomIds.size === 0) { toast.error("Sélectionnez au moins une pièce."); return; }
    if (selectedAmbiances.size === 0) { toast.error("Sélectionnez au moins une ambiance."); return; }

    setLaunching(true);
    try {
      const res = await fetch("/api/pro/jobs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: selectedPropertyId,
          roomIds: Array.from(selectedRoomIds),
          ambianceSlugs: Array.from(selectedAmbiances),
          mode,
          globalConstraints: constraints || undefined,
        }),
      });
      if (!res.ok) throw new Error("Launch failed");
      const { jobId } = (await res.json()) as { jobId: string };
      toast.success("Génération lancée !");
      router.push(`/pro/dashboard/jobs/${jobId}`);
    } catch {
      toast.error("Erreur au lancement. Réessayez.");
      setLaunching(false);
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
        <h1 className="font-serif text-[24px] font-medium text-foyer-ink">Nouvelle génération</h1>
        <span className="ml-auto text-[12px] text-foyer-muted">Étape {step}/4</span>
      </div>

      <div className="mx-auto max-w-2xl space-y-6">

        {/* Step 1 — Property selection */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-[14px] text-foyer-muted">Quel bien voulez-vous générer ?</p>
            {properties.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-foyer-border bg-foyer-cream py-12 text-center">
                <p className="text-[14px] text-foyer-muted">Aucun bien — créez-en un d'abord.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {properties.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPropertyId(p.id)}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-left transition-colors",
                      selectedPropertyId === p.id
                        ? "border-foyer-sage bg-foyer-sage/10"
                        : "border-foyer-border bg-foyer-cream hover:border-foyer-ink/30",
                    )}
                  >
                    <p className="text-[13px] font-medium text-foyer-ink">{p.address}</p>
                    <p className="text-[11px] capitalize text-foyer-muted">{p.property_type}</p>
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              disabled={!selectedPropertyId}
              onClick={() => setStep(2)}
              className={cn(
                "w-full rounded-full py-3 text-[14px] font-semibold text-white",
                selectedPropertyId ? "bg-foyer-sage shadow-[0_2px_8px_rgba(107,142,111,0.3)]" : "bg-foyer-muted/40",
              )}
            >
              Continuer →
            </button>
          </div>
        )}

        {/* Step 2 — Room selection */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[14px] text-foyer-muted">Sélectionnez les pièces à générer</p>
              <button
                type="button"
                onClick={() => setSelectedRoomIds(selectedRoomIds.size === rooms.length ? new Set() : new Set(rooms.map((r) => r.id)))}
                className="text-[12px] text-foyer-sage"
              >
                {selectedRoomIds.size === rooms.length ? "Tout décocher" : "Tout cocher"}
              </button>
            </div>

            {loadingRooms ? (
              <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-foyer-muted" /></div>
            ) : rooms.length === 0 ? (
              <p className="text-center text-[13px] text-foyer-muted">Ce bien n'a aucune pièce.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {rooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => toggleRoom(room.id)}
                    className={cn(
                      "relative overflow-hidden rounded-2xl border transition-all",
                      selectedRoomIds.has(room.id)
                        ? "border-foyer-sage ring-2 ring-foyer-sage/30"
                        : "border-foyer-border hover:border-foyer-ink/30",
                    )}
                  >
                    {room.primary_photo_url ? (
                      <img src={room.primary_photo_url} alt={room.name} className="aspect-[4/3] w-full object-cover" />
                    ) : (
                      <div className="aspect-[4/3] w-full bg-foyer-border/30" />
                    )}
                    <div className="px-3 py-2 text-left">
                      <p className="text-[12px] font-medium text-foyer-ink">{room.name}</p>
                    </div>
                    {selectedRoomIds.has(room.id) && (
                      <div className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-foyer-sage">
                        <Check className="size-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              disabled={selectedRoomIds.size === 0}
              onClick={() => setStep(3)}
              className={cn(
                "w-full rounded-full py-3 text-[14px] font-semibold text-white",
                selectedRoomIds.size > 0 ? "bg-foyer-sage shadow-[0_2px_8px_rgba(107,142,111,0.3)]" : "bg-foyer-muted/40",
              )}
            >
              Continuer ({selectedRoomIds.size} pièce{selectedRoomIds.size !== 1 ? "s" : ""}) →
            </button>
          </div>
        )}

        {/* Step 3 — Ambiance selection */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-[14px] text-foyer-muted">Sélectionnez les ambiances à générer</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {AMBIANCES.map((a) => (
                <button
                  key={a.slug}
                  type="button"
                  onClick={() => toggleAmbiance(a.slug)}
                  className={cn(
                    "relative rounded-2xl border p-3 transition-all",
                    selectedAmbiances.has(a.slug)
                      ? "border-foyer-sage ring-2 ring-foyer-sage/30"
                      : "border-foyer-border hover:border-foyer-ink/30",
                  )}
                >
                  <div
                    className="mx-auto mb-2 size-10 rounded-xl"
                    style={{ backgroundColor: a.color }}
                  />
                  <p className="text-[12px] font-medium text-foyer-ink">{a.label}</p>
                  {selectedAmbiances.has(a.slug) && (
                    <div className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-foyer-sage">
                      <Check className="size-2.5 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={selectedAmbiances.size === 0}
              onClick={() => setStep(4)}
              className={cn(
                "w-full rounded-full py-3 text-[14px] font-semibold text-white",
                selectedAmbiances.size > 0 ? "bg-foyer-sage shadow-[0_2px_8px_rgba(107,142,111,0.3)]" : "bg-foyer-muted/40",
              )}
            >
              Continuer ({selectedAmbiances.size} ambiance{selectedAmbiances.size !== 1 ? "s" : ""}) →
            </button>
          </div>
        )}

        {/* Step 4 — Mode + launch */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-[14px] text-foyer-muted">Mode de génération</p>
            <div className="space-y-2">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-2xl border px-4 py-3 transition-colors",
                    mode === m.value
                      ? "border-foyer-sage bg-foyer-sage/10"
                      : "border-foyer-border bg-foyer-cream hover:border-foyer-ink/30",
                  )}
                >
                  <div className="text-left">
                    <p className="text-[13px] font-medium text-foyer-ink">{m.label}</p>
                    <p className="text-[11px] text-foyer-muted">{m.description}</p>
                  </div>
                  {mode === m.value && <Check className="size-4 text-foyer-sage" />}
                </button>
              ))}
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-foyer-muted">
                Contraintes globales (optionnel)
              </label>
              <textarea
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                placeholder="Ex : conserver les fenêtres d'origine, parquet bois clair…"
                rows={3}
                className="w-full resize-none rounded-xl border border-foyer-border bg-foyer-cream px-4 py-2.5 text-[13px] text-foyer-ink outline-none focus:border-foyer-sage"
              />
            </div>

            {/* Summary */}
            <div className="rounded-2xl border border-foyer-border bg-foyer-cream p-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-foyer-muted">Récap</p>
              <p className="text-[13px] text-foyer-ink">
                <span className="font-semibold">{totalRenders}</span> rendus ·{" "}
                {selectedRoomIds.size} pièce{selectedRoomIds.size !== 1 ? "s" : ""} ×{" "}
                {selectedAmbiances.size} ambiance{selectedAmbiances.size !== 1 ? "s" : ""}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLaunch}
              disabled={launching}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-full py-3 text-[14px] font-semibold text-white",
                launching ? "bg-foyer-muted" : "bg-foyer-sage shadow-[0_2px_8px_rgba(107,142,111,0.3)]",
              )}
            >
              {launching ? <><Loader2 className="size-4 animate-spin" /> Lancement…</> : `Lancer ${totalRenders} rendus →`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProCreatePage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-foyer-muted" /></div>}>
      <ProCreateInner />
    </Suspense>
  );
}
