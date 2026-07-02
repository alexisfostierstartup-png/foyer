"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CodeTextarea } from "./CodeTextarea";
import type { DiyAction } from "@/lib/diy/types";
import stylesData from "@/data/styles.json";

type Props = {
  action?: DiyAction;
};

// Slugs canoniques (data/styles.json). Les clés legacy éventuelles présentes
// sur une action existante restent éditables via le JSON brut.
const STYLE_IDS = (stylesData as { slug: string }[]).map((s) => s.slug);

const EMPTY_AFFINITY = Object.fromEntries(STYLE_IDS.map((s) => [s, 0.5]));

export function DiyActionEditorForm({ action }: Props) {
  const router = useRouter();
  const isNew = !action;

  const [slug, setSlug] = useState(action?.slug ?? "");
  const [label, setLabel] = useState(action?.label ?? "");
  const [labelEn, setLabelEn] = useState(action?.label_en ?? "");
  const [categories, setCategories] = useState(
    (action?.applies_to_categories ?? []).join(", "),
  );
  const [requires, setRequires] = useState(
    JSON.stringify(action?.requires ?? {}, null, 2),
  );
  const [excludes, setExcludes] = useState(
    JSON.stringify(action?.excludes ?? {}, null, 2),
  );
  const [qtyFormula, setQtyFormula] = useState(action?.qty_formula ?? "");
  const [qtyUnit, setQtyUnit] = useState(action?.qty_unit ?? "");
  const [affinity, setAffinity] = useState(
    JSON.stringify(action?.style_affinity ?? EMPTY_AFFINITY, null, 2),
  );
  const [supplies, setSupplies] = useState(
    JSON.stringify(action?.supplies_template ?? [], null, 2),
  );
  const [isActive, setIsActive] = useState(action?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    let parsedRequires, parsedExcludes, parsedAffinity, parsedSupplies;
    try {
      parsedRequires = JSON.parse(requires);
      parsedExcludes = JSON.parse(excludes);
      parsedAffinity = JSON.parse(affinity);
      parsedSupplies = JSON.parse(supplies);
    } catch {
      toast.error("JSON invalide — vérifiez les champs requires, excludes, affinity et supplies");
      return;
    }

    setSaving(true);
    const body = {
      slug,
      label,
      label_en: labelEn || null,
      applies_to_categories: categories.split(",").map((c) => c.trim()).filter(Boolean),
      requires: parsedRequires,
      excludes: parsedExcludes,
      qty_formula: qtyFormula || null,
      qty_unit: qtyUnit || null,
      style_affinity: parsedAffinity,
      supplies_template: parsedSupplies,
      is_active: isActive,
    };

    const url = isNew ? "/api/admin/diy-actions" : `/api/admin/diy-actions/${action!.id}`;
    const method = isNew ? "POST" : "PATCH";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);
    if (res.ok) {
      toast.success(isNew ? "Action créée" : "Action mise à jour");
      router.push("/admin/diy-actions");
      router.refresh();
    } else {
      const err = await res.json().catch(() => ({})) as { error?: string };
      toast.error(err.error ?? "Erreur lors de la sauvegarde");
    }
  }

  const inputCls =
    "w-full px-3 py-2 text-sm border border-foyer-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-foyer-ink";
  const labelCls = "block text-xs font-medium text-foyer-muted mb-1";

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Slug *</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={inputCls}
            placeholder="repaint"
          />
        </div>
        <div>
          <label className={labelCls}>Libellé FR *</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className={inputCls}
            placeholder="Repeindre"
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Libellé EN</label>
        <input
          value={labelEn}
          onChange={(e) => setLabelEn(e.target.value)}
          className={inputCls}
          placeholder="Repaint"
        />
      </div>

      <div>
        <label className={labelCls}>Catégories (virgule-séparées)</label>
        <input
          value={categories}
          onChange={(e) => setCategories(e.target.value)}
          className={inputCls}
          placeholder="wall, furniture, door"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Formule quantité</label>
          <input
            value={qtyFormula}
            onChange={(e) => setQtyFormula(e.target.value)}
            className={inputCls}
            placeholder="area_m2 * 0.1"
          />
        </div>
        <div>
          <label className={labelCls}>Unité</label>
          <input
            value={qtyUnit}
            onChange={(e) => setQtyUnit(e.target.value)}
            className={inputCls}
            placeholder="L"
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Requires (JSON)</label>
        <CodeTextarea value={requires} onChange={setRequires} rows={4} />
      </div>

      <div>
        <label className={labelCls}>Excludes (JSON)</label>
        <CodeTextarea value={excludes} onChange={setExcludes} rows={4} />
      </div>

      <div>
        <label className={labelCls}>Style affinity (JSON)</label>
        <CodeTextarea value={affinity} onChange={setAffinity} rows={6} />
      </div>

      <div>
        <label className={labelCls}>Fournitures template (JSON array)</label>
        <CodeTextarea value={supplies} onChange={setSupplies} rows={8} />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_active"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="is_active" className="text-sm text-foyer-ink">
          Active
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving || !slug || !label}
          className="px-6 py-2.5 bg-foyer-ink text-foyer-cream text-sm rounded-lg disabled:opacity-50"
        >
          {saving ? "Enregistrement…" : isNew ? "Créer" : "Enregistrer"}
        </button>
        <button
          onClick={() => router.back()}
          className="px-6 py-2.5 border border-foyer-border text-foyer-muted text-sm rounded-lg"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
