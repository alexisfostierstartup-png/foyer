"use client";

/**
 * REPASSE MANUELLE des attributs structurés (fiche produit admin).
 * Clic sur un attribut → liste fermée du vocabulaire de sa catégorie (schéma V3) →
 * PATCH immédiat. La valeur est re-validée côté serveur : impossible d'écrire hors
 * enum (une valeur inventée casserait le scoring structuré du matching).
 * Les clés DÉRIVÉES (color_family/color_families, recalculées depuis `color`) sont
 * affichées en lecture seule — les corriger à la main les désynchroniserait.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Pencil } from "lucide-react";
import { getSchemaV3, schemaForCategory, type AttrV3 } from "@/lib/shopping/attributeSchemaV3";

const DERIVED = new Set(["color_family", "color_families"]);
const HEX = /^#[0-9a-fA-F]{6}$/;

export function ProductAttrsEditor({
  productId,
  category,
  initialAttrs,
  attrsModel,
  initialManual,
}: {
  productId: string;
  category: string;
  initialAttrs: Record<string, unknown>;
  attrsModel?: string | null;
  initialManual?: string[];
}) {
  const [attrs, setAttrs] = useState<Record<string, unknown>>(initialAttrs);
  const [manual, setManual] = useState<Set<string>>(new Set(initialManual ?? []));
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const schema = getSchemaV3(schemaForCategory(category));

  async function save(key: string, value: string) {
    setSaving(key);
    try {
      const res = await fetch(`/api/admin/catalog/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attr: { key, value } }),
      });
      const data = (await res.json()) as { attrs?: Record<string, unknown>; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Échec de l'enregistrement");
        return;
      }
      if (data.attrs) setAttrs(data.attrs); // inclut les familles de couleur recalculées
      setManual((prev) => new Set(prev).add(key));
      setOpenKey(null);
      toast.success(`${key} → ${value}`);
    } catch {
      toast.error("Échec de l'enregistrement");
    } finally {
      setSaving(null);
    }
  }

  // Clés présentes en base mais hors schéma (dérivées, ou vocab retiré depuis) :
  // affichées en fin de liste, non éditables.
  const schemaKeys = new Set(schema.map((a) => a.key));
  const extraKeys = Object.keys(attrs).filter((k) => k !== "_error" && !schemaKeys.has(k));

  const isHex = (v: unknown): v is string => typeof v === "string" && HEX.test(v);

  function Chip({ attr }: { attr: AttrV3 }) {
    const value = attrs[attr.key];
    const shown = value === undefined || value === null ? "—" : String(value);
    const open = openKey === attr.key;
    const busy = saving === attr.key;
    const edited = manual.has(attr.key);

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenKey(open ? null : attr.key)}
          title={attr.hint ?? `Modifier ${attr.key}`}
          className={`group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
            edited
              ? "border-foyer-sage bg-foyer-sage/10 hover:border-foyer-sage"
              : "border-foyer-border bg-white/70 hover:border-foyer-ink"
          }`}
        >
          <span className="text-foyer-muted">{attr.key}</span>
          {isHex(value) && (
            <span className="size-3.5 rounded-sm border border-foyer-border" style={{ backgroundColor: value }} aria-hidden />
          )}
          <span className={`font-medium ${isHex(value) ? "font-mono" : ""} text-foyer-ink`}>{shown}</span>
          {busy ? (
            <Loader2 className="size-3 animate-spin text-foyer-muted" aria-hidden />
          ) : (
            <Pencil className="size-3 text-foyer-muted/40 group-hover:text-foyer-ink" aria-hidden />
          )}
        </button>

        {open && attr.type === "enum" && (
          <div className="absolute left-0 z-30 mt-1 max-h-64 w-52 overflow-auto rounded-md border border-foyer-border bg-white p-1 shadow-lg">
            {[...(attr.vocab ?? []), "unknown", "n/a"].map((v) => (
              <button
                key={v}
                type="button"
                disabled={busy}
                onClick={() => save(attr.key, v)}
                className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-foyer-cream/60 disabled:opacity-50 ${
                  String(value) === v ? "font-medium text-foyer-ink" : "text-foyer-muted"
                }`}
              >
                {v}
                {String(value) === v && <Check className="size-3 text-foyer-sage" aria-hidden />}
              </button>
            ))}
          </div>
        )}

        {open && attr.type === "hex" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = String(new FormData(e.currentTarget).get("hex") ?? "").trim();
              if (!HEX.test(v)) {
                toast.error("Format attendu : #rrggbb");
                return;
              }
              void save(attr.key, v);
            }}
            className="absolute left-0 z-30 mt-1 flex w-56 items-center gap-1.5 rounded-md border border-foyer-border bg-white p-2 shadow-lg"
          >
            <input
              name="hex"
              defaultValue={isHex(value) ? value : "#"}
              placeholder="#rrggbb"
              className="w-28 rounded border border-foyer-border px-2 py-1 font-mono text-xs text-foyer-ink outline-none focus:border-foyer-ink"
            />
            <button type="submit" disabled={busy} className="rounded bg-foyer-ink px-2 py-1 text-xs text-foyer-cream disabled:opacity-50">
              OK
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <section className="mt-5 rounded-xl border border-foyer-border bg-foyer-cream/40 p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-foyer-muted">
        Attributs structurés
        {attrsModel && <span className="ml-2 font-normal normal-case text-foyer-muted/70">· {attrsModel}</span>}
        <span className="ml-2 font-normal normal-case text-foyer-muted/70">· cliquez pour corriger</span>
      </h2>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {schema.map((a) => (
          <Chip key={a.key} attr={a} />
        ))}
      </div>

      {extraKeys.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-foyer-border/60 pt-2">
          <span className="text-[10px] uppercase tracking-wide text-foyer-muted/70">Dérivés</span>
          {extraKeys.map((k) => (
            <span
              key={k}
              title={DERIVED.has(k) ? "Recalculé automatiquement depuis la couleur" : "Hors schéma courant"}
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-foyer-border bg-white/50 px-2.5 py-1 text-xs text-foyer-muted"
            >
              <span>{k}</span>
              <span className="font-medium text-foyer-ink/70">
                {Array.isArray(attrs[k]) ? (attrs[k] as unknown[]).join(", ") : String(attrs[k])}
              </span>
            </span>
          ))}
        </div>
      )}

      {manual.size > 0 && (
        <p className="mt-2 text-[11px] text-foyer-muted">
          Corrigé à la main : {[...manual].join(", ")}
        </p>
      )}
    </section>
  );
}
