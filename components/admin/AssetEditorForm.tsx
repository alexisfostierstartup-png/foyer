"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ColorSwatch } from "./ColorSwatch";
import type { AssetInput } from "@/lib/admin/actions";
import { createAsset, updateAsset, toggleAssetActive } from "@/lib/admin/actions";

// ─── Per-category data fields ───────────────────────────────────────────────

function AmbianceFields({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
}) {
  function update(key: string, value: unknown) {
    onChange({ ...data, [key]: value });
  }

  const palette = (data.palette as string[] | undefined) ?? [];
  const materials = (data.materials as string[] | undefined) ?? [];

  return (
    <>
      <Field label="Nom">
        <input value={String(data.name ?? "")} onChange={(e) => update("name", e.target.value)} className={inputCls} />
      </Field>
      <Field label="Description">
        <textarea value={String(data.description ?? "")} onChange={(e) => update("description", e.target.value)} rows={3} className={inputCls} />
      </Field>
      <Field label="Mood">
        <input value={String(data.mood ?? "")} onChange={(e) => update("mood", e.target.value)} className={inputCls} />
      </Field>
      <Field label="Palette (une couleur par ligne)">
        <textarea
          value={palette.join("\n")}
          onChange={(e) => update("palette", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
          rows={4}
          className={inputCls + " font-mono text-xs"}
          placeholder="warm white\ntaupe\nnatural oak"
        />
      </Field>
      <Field label="Matériaux (un par ligne)">
        <textarea
          value={materials.join("\n")}
          onChange={(e) => update("materials", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
          rows={4}
          className={inputCls + " font-mono text-xs"}
          placeholder="linen\nwood\nceramic"
        />
      </Field>
    </>
  );
}

function RoomDefaultsFields({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
}) {
  return (
    <Field label="Meubles attendus (en anglais, virgule-séparés)">
      <textarea
        value={String(data.englishFurniture ?? "")}
        onChange={(e) => onChange({ ...data, englishFurniture: e.target.value })}
        rows={5}
        className={inputCls + " font-mono text-xs"}
        placeholder="sofa, coffee table, armchair, TV unit, rug"
      />
    </Field>
  );
}

function FloorPresetFields({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
}) {
  function update(key: string, value: unknown) {
    onChange({ ...data, [key]: value });
  }

  return (
    <>
      <Field label="Label">
        <input value={String(data.label ?? "")} onChange={(e) => update("label", e.target.value)} className={inputCls} />
      </Field>
      <Field label="Description (pour le prompt)">
        <textarea value={String(data.description ?? "")} onChange={(e) => update("description", e.target.value)} rows={3} className={inputCls} />
      </Field>
    </>
  );
}

function WallPaletteFields({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
}) {
  function update(key: string, value: unknown) {
    onChange({ ...data, [key]: value });
  }

  const hex = String(data.hex ?? "#ffffff");

  return (
    <>
      <Field label="Label">
        <input value={String(data.label ?? "")} onChange={(e) => update("label", e.target.value)} className={inputCls} />
      </Field>
      <Field label="Code hex">
        <div className="flex items-center gap-3">
          <input
            value={hex}
            onChange={(e) => update("hex", e.target.value)}
            placeholder="#c8b99a"
            className={inputCls + " font-mono"}
          />
          {/^#[0-9a-fA-F]{3,6}$/.test(hex) && <ColorSwatch hex={hex} size={28} />}
        </div>
      </Field>
      <Field label="Description (pour le prompt)">
        <textarea value={String(data.description ?? "")} onChange={(e) => update("description", e.target.value)} rows={2} className={inputCls} />
      </Field>
    </>
  );
}

function ElementCategoryFields({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
}) {
  function update(key: string, value: unknown) {
    onChange({ ...data, [key]: value });
  }
  const rooms = (data.room_types as string[] | undefined) ?? [];
  function toggleRoom(r: string) {
    update("room_types", rooms.includes(r) ? rooms.filter((x) => x !== r) : [...rooms, r]);
  }
  const Check = ({ k, label }: { k: string; label: string }) => (
    <label className="flex items-center gap-2 text-sm text-foyer-ink cursor-pointer">
      <input type="checkbox" checked={Boolean(data[k])} onChange={(e) => update(k, e.target.checked)} />
      {label}
    </label>
  );

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Label (FR)">
          <input value={String(data.label_fr ?? "")} onChange={(e) => update("label_fr", e.target.value)} className={inputCls} placeholder="Table basse" />
        </Field>
        <Field label="Label (EN)">
          <input value={String(data.label_en ?? "")} onChange={(e) => update("label_en", e.target.value)} className={inputCls} placeholder="coffee table" />
        </Field>
        <Field label="Famille">
          <input value={String(data.family ?? "")} onChange={(e) => update("family", e.target.value)} className={inputCls} placeholder="table" />
        </Field>
        <Field label="Catégorie catalogue (mapping shopping, vide = non matché)">
          <input value={String(data.catalog_category ?? "")} onChange={(e) => update("catalog_category", e.target.value || null)} className={inputCls + " font-mono"} placeholder="coffee_table" />
        </Field>
      </div>
      <Field label="Types de pièce">
        <div className="flex gap-4">
          {["salon", "chambre"].map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm text-foyer-ink cursor-pointer">
              <input type="checkbox" checked={rooms.includes(r)} onChange={() => toggleRoom(r)} />
              {r}
            </label>
          ))}
        </div>
      </Field>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Check k="movable" label="Déplaçable" />
        <Check k="diy_eligible" label="Éligible DIY (personnalisable)" />
        <Check k="fixed_lightpoint" label="Point lumineux fixe (remplacer en place)" />
        <Check k="preserve_behind" label="Préserver l'arrière (fenêtre/porte)" />
      </div>
    </>
  );
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-foyer-border bg-white px-3.5 py-2.5 text-sm text-foyer-ink outline-none focus:border-foyer-ink";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-foyer-muted uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

type Props = {
  assetId?: string;
  category: string;
  categoryLabel: string;
  defaultValues?: Partial<AssetInput>;
};

const DEFAULT_DATA: Record<string, Record<string, unknown>> = {
  ambiance: { name: "", description: "", palette: [], materials: [], mood: "" },
  room_defaults: { englishFurniture: "" },
  floor_preset: { label: "", description: "" },
  wall_palette: { label: "", hex: "", description: "" },
  element_category: {
    label_fr: "", label_en: "", family: "", room_types: ["salon", "chambre"],
    movable: true, diy_eligible: false, catalog_category: null,
  },
};

export function AssetEditorForm({
  assetId,
  category,
  categoryLabel,
  defaultValues,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [slug, setSlug] = useState(defaultValues?.slug ?? "");
  const [notes, setNotes] = useState(defaultValues?.notes ?? "");
  const [sortOrder, setSortOrder] = useState(defaultValues?.sort_order ?? 0);
  const [isActive, setIsActive] = useState(defaultValues?.is_active ?? true);
  const [data, setData] = useState<Record<string, unknown>>(
    (defaultValues?.data as Record<string, unknown>) ??
      DEFAULT_DATA[category] ??
      {},
  );
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    const input: AssetInput = {
      slug,
      category,
      notes,
      sort_order: Number(sortOrder),
      is_active: isActive,
      data,
    };

    startTransition(async () => {
      try {
        if (assetId) {
          await updateAsset(assetId, input);
          router.refresh();
        } else {
          const created = await createAsset(input);
          router.push(`/admin/assets/${category}/${created.id}`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur lors de la sauvegarde.");
      }
    });
  }

  async function handleToggleActive() {
    if (!assetId) return;
    startTransition(async () => {
      await toggleAssetActive(assetId, category, !isActive);
      setIsActive((v) => !v);
    });
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-serif text-2xl text-foyer-ink">
          {assetId ? slug || "…" : `Nouvel asset — ${categoryLabel}`}
        </h1>

        <div className="flex items-center gap-2">
          {assetId && (
            <button
              type="button"
              onClick={handleToggleActive}
              disabled={isPending}
              className={`rounded-lg px-3.5 py-2 text-sm transition-colors disabled:opacity-40 ${
                isActive
                  ? "border border-foyer-terra/40 text-foyer-terra hover:bg-foyer-terra/5"
                  : "border border-foyer-sage/40 text-foyer-sage hover:bg-foyer-sage/5"
              }`}
            >
              {isActive ? "Désactiver" : "Activer"}
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !slug}
            className="rounded-lg bg-foyer-ink text-foyer-cream px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-40"
          >
            {isPending ? "Sauvegarde…" : "Sauvegarder"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-foyer-terra/10 border border-foyer-terra/30 px-4 py-3 text-sm text-foyer-terra">
          {error}
        </div>
      )}

      {/* Meta fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-foyer-muted uppercase tracking-wide">
            Slug
          </label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="doux"
            className={inputCls + " font-mono"}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-foyer-muted uppercase tracking-wide">
            Ordre d'affichage
          </label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className={inputCls}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-foyer-muted uppercase tracking-wide">
            Notes
          </label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Description interne…"
            className={inputCls}
          />
        </div>
      </div>

      {/* Data fields per category */}
      <div className="rounded-lg border border-foyer-border p-5 space-y-5">
        <p className="text-xs font-medium text-foyer-muted uppercase tracking-wide">
          Données — {categoryLabel}
        </p>

        {category === "ambiance" && (
          <AmbianceFields data={data} onChange={setData} />
        )}
        {category === "room_defaults" && (
          <RoomDefaultsFields data={data} onChange={setData} />
        )}
        {category === "floor_preset" && (
          <FloorPresetFields data={data} onChange={setData} />
        )}
        {category === "wall_palette" && (
          <WallPaletteFields data={data} onChange={setData} />
        )}
        {category === "element_category" && (
          <ElementCategoryFields data={data} onChange={setData} />
        )}
      </div>

      {/* is_active toggle */}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <div
          onClick={() => setIsActive((v) => !v)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            isActive ? "bg-foyer-sage" : "bg-foyer-border"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
              isActive ? "translate-x-4" : "translate-x-1"
            }`}
          />
        </div>
        <span className="text-sm text-foyer-ink">Actif</span>
      </label>
    </div>
  );
}
