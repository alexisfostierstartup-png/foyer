"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, LayoutTemplate, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const AMBIANCES = ["scandinave", "japandi", "industriel", "boheme", "contemporain", "classique", "minimaliste", "tropical"];

type Template = {
  id: string;
  name: string;
  description?: string | null;
  ambiance_slugs: string[];
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAmbiances, setSelectedAmbiances] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/pro/templates").then((r) => r.json()).then((d: Template[]) => { setTemplates(d ?? []); setLoading(false); });
  }, []);

  function toggleAmbiance(slug: string) {
    setSelectedAmbiances((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  }

  async function handleCreate() {
    if (!name) { toast.error("Le nom est requis."); return; }
    if (selectedAmbiances.size === 0) { toast.error("Sélectionnez au moins une ambiance."); return; }
    setSaving(true);
    const res = await fetch("/api/pro/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: description || undefined, ambianceSlugs: Array.from(selectedAmbiances) }),
    });
    if (!res.ok) { toast.error("Erreur."); setSaving(false); return; }
    const created = (await res.json()) as Template;
    setTemplates((p) => [created, ...p]);
    setName(""); setDescription(""); setSelectedAmbiances(new Set()); setShowForm(false);
    setSaving(false);
    toast.success("Template créé !");
  }

  async function handleDelete(id: string) {
    await fetch(`/api/pro/templates/${id}`, { method: "DELETE" });
    setTemplates((p) => p.filter((t) => t.id !== id));
    toast.success("Supprimé.");
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-[24px] font-medium text-foyer-ink">Templates</h1>
        <button
          type="button"
          onClick={() => setShowForm((p) => !p)}
          className="flex items-center gap-1.5 rounded-full bg-foyer-sage px-4 py-2 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(107,142,111,0.3)]"
        >
          <Plus className="size-3.5" />
          Nouveau template
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl border border-foyer-border bg-foyer-cream p-5 space-y-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du template *"
            className="w-full rounded-xl border border-foyer-border bg-white px-4 py-2.5 text-[13px] text-foyer-ink outline-none focus:border-foyer-sage"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optionnel)"
            className="w-full rounded-xl border border-foyer-border bg-white px-4 py-2.5 text-[13px] text-foyer-ink outline-none focus:border-foyer-sage"
          />
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-foyer-muted">Ambiances</p>
            <div className="flex flex-wrap gap-2">
              {AMBIANCES.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAmbiance(a)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors capitalize",
                    selectedAmbiances.has(a)
                      ? "border-foyer-sage bg-foyer-sage/15 text-foyer-sage"
                      : "border-foyer-border text-foyer-muted hover:border-foyer-ink/30",
                  )}
                >
                  {selectedAmbiances.has(a) && <Check className="size-3" />}
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-full bg-foyer-sage px-4 py-2 text-[13px] font-medium text-white"
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              Enregistrer
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-full px-4 py-2 text-[13px] text-foyer-muted">
              Annuler
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-foyer-muted" /></div>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-foyer-border bg-foyer-cream px-6 py-16 text-center">
          <LayoutTemplate className="mx-auto mb-3 size-8 text-foyer-muted/40" />
          <p className="text-[14px] text-foyer-muted">Aucun template — créez-en un pour réutiliser vos sélections d'ambiances.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className="rounded-2xl border border-foyer-border bg-foyer-cream p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[14px] font-medium text-foyer-ink">{t.name}</p>
                  {t.description && <p className="mt-0.5 text-[12px] text-foyer-muted">{t.description}</p>}
                </div>
                <button type="button" onClick={() => handleDelete(t.id)} className="mt-0.5 shrink-0 text-foyer-muted hover:text-red-500">
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {t.ambiance_slugs.map((a) => (
                  <span key={a} className="rounded-full bg-foyer-sage/15 px-2 py-0.5 text-[11px] capitalize text-foyer-sage">{a}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
