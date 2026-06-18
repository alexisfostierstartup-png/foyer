"use client";

import { useState, useRef } from "react";
import { Plus, Trash2, ToggleLeft, ToggleRight, Check, X, HelpCircle } from "lucide-react";

type Row = {
  id: string;
  provider: string;
  model: string | null;
  per_1m_input_tokens: number | null;
  per_1m_output_tokens: number | null;
  per_image_in: number | null;
  per_image_out: number | null;
  per_request: number | null;
  per_1k_embeddings: number | null;
  notes: string | null;
  is_active: boolean;
};

// ── What each provider/model does in the pipeline ─────────────────────────────

const USAGE_MAP: Record<string, string> = {
  "gemini_vision/gemini-2.5-flash-lite":  "Détection + verdict des éléments (vision_detect_extended, verdict_elements)",
  "gemini_vision/gemini-2.5-flash":       "Confirmation visuelle des changements appliqués pour la liste de courses (confirm_changes)",
  "nano_banana/gemini-2.5-flash-image":   "Génération et édition de rendus déco (première génération + itérations)",
  "flux_kontext/flux-kontext-pro":        "Réparation ciblée de zones sur le rendu (repair pass — pas encore actif)",
  "jina/jina-embeddings-v3":             "Embeddings sémantiques pour le matching catalogue produits",
  "piloterr/scraper":                    "Scraping LBC / marketplaces secondhand pour sourcing produits",
};

function getUsage(provider: string, model: string | null): string {
  const key = model ? `${provider}/${model}` : provider;
  return USAGE_MAP[key] ?? "—";
}

// ── Pricing column definitions ─────────────────────────────────────────────────

const PRICE_FIELDS: { key: keyof Row; label: string; tooltip: string }[] = [
  {
    key: "per_1m_input_tokens",
    label: "$/1M in",
    tooltip: "Coût par million de tokens en entrée (prompt texte + images converties en tokens). Ex : Gemini Flash Lite = $0,10 / 1M tokens.",
  },
  {
    key: "per_1m_output_tokens",
    label: "$/1M out",
    tooltip: "Coût par million de tokens générés en sortie (texte ou JSON). Ex : Gemini Flash Lite = $0,40 / 1M tokens.",
  },
  {
    key: "per_image_in",
    label: "$/img in",
    tooltip: "Coût par image envoyée au modèle (image source, rendu…). Certains APIs facturent les images séparément des tokens.",
  },
  {
    key: "per_image_out",
    label: "$/img out",
    tooltip: "Coût par image générée. Principal levier de coût pour nano_banana (génération de rendus). Ex : Gemini Flash Image = $0,039 / image.",
  },
  {
    key: "per_request",
    label: "$/req",
    tooltip: "Coût fixe par requête API, indépendamment du volume. Utilisé pour le scraping (Piloterr). Ex : $0,001 / page scrapée.",
  },
  {
    key: "per_1k_embeddings",
    label: "$/1k emb",
    tooltip: "Coût par tranche de 1 000 vecteurs d'embeddings générés. Utilisé pour le matching sémantique catalogue (Jina). Ex : $0,00002 / 1k.",
  },
];

// ── Tooltip component ─────────────────────────────────────────────────────────

function Tooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex items-center ml-1 cursor-help">
      <HelpCircle size={11} className="text-foyer-muted/60 group-hover:text-foyer-muted transition-colors" />
      <span
        className="
          pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2
          w-64 rounded-lg border border-foyer-border bg-white px-3 py-2
          text-xs text-foyer-ink leading-relaxed shadow-lg
          opacity-0 group-hover:opacity-100
          transition-opacity duration-150 z-50
          whitespace-normal text-left
        "
      >
        {/* Arrow */}
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-foyer-border" />
        {text}
      </span>
    </span>
  );
}

// ── Numeric inline-edit cell ──────────────────────────────────────────────────

function fmt(v: number | null): string {
  if (v == null) return "—";
  if (v < 0.0001) return v.toExponential(2);
  return v.toPrecision(4);
}

function NumCell({
  rowId, field, value, onSave,
}: {
  rowId: string; field: string; value: number | null;
  onSave: (id: string, field: string, val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(value != null ? String(value) : "");
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }
  function commit() { setEditing(false); onSave(rowId, field, draft); }
  function cancel() { setEditing(false); }

  if (!editing) {
    return (
      <button
        onClick={startEdit}
        title="Cliquer pour éditer"
        className="w-full text-right font-mono text-xs text-foyer-ink hover:bg-amber-50 hover:text-amber-700 rounded px-1 py-0.5 transition-colors"
      >
        {fmt(value)}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-0.5">
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
        className="w-20 text-right font-mono text-xs border border-foyer-ink rounded px-1 py-0.5 focus:outline-none"
        placeholder="0.0"
      />
      <button onClick={commit} className="text-emerald-600 hover:text-emerald-700"><Check size={12} /></button>
      <button onClick={cancel} className="text-foyer-muted hover:text-foyer-terra"><X size={12} /></button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const EMPTY_NEW: Omit<Row, "id" | "is_active"> = {
  provider: "", model: "", notes: "",
  per_1m_input_tokens: null, per_1m_output_tokens: null,
  per_image_in: null, per_image_out: null,
  per_request: null, per_1k_embeddings: null,
};

export function AiPricingAdmin({ rows: initial }: { rows: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState<typeof EMPTY_NEW>({ ...EMPTY_NEW });

  async function saveCell(id: string, field: string, val: string) {
    const numeric = val === "" ? null : Number(val);
    const body: Record<string, unknown> = { [field]: isNaN(numeric as number) ? null : numeric };
    const res = await fetch(`/api/admin/ai-pricing/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json() as Row;
      setRows((prev) => prev.map((r) => r.id === id ? updated : r));
    }
  }

  async function toggleActive(row: Row) {
    const res = await fetch(`/api/admin/ai-pricing/${row.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !row.is_active }),
    });
    if (res.ok) {
      const updated = await res.json() as Row;
      setRows((prev) => prev.map((r) => r.id === row.id ? updated : r));
    }
  }

  async function deleteRow(id: string) {
    if (!confirm("Supprimer cette entrée de pricing ?")) return;
    const res = await fetch(`/api/admin/ai-pricing/${id}`, { method: "DELETE" });
    if (res.ok) setRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function createRow() {
    if (!newRow.provider) return;
    const body: Record<string, unknown> = { ...newRow, is_active: true };
    for (const { key } of PRICE_FIELDS) {
      const v = body[key];
      body[key] = v === "" || v == null ? null : Number(v);
    }
    const res = await fetch("/api/admin/ai-pricing", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const created = await res.json() as Row;
      setRows((prev) => [...prev, created]);
      setNewRow({ ...EMPTY_NEW });
      setAdding(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-foyer-ink">Pricing modèles IA</h1>
          <p className="text-sm text-foyer-muted mt-1">
            Prix en USD — rechargés depuis la DB toutes les 5 min.{" "}
            <span className="text-foyer-ink/60">Cliquer sur un prix pour l'éditer.</span>
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-foyer-ink text-foyer-cream text-sm rounded-lg hover:bg-foyer-ink/90 transition-colors"
        >
          <Plus size={15} />
          Ajouter
        </button>
      </div>

      <div className="rounded-xl border border-foyer-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-foyer-border/40 text-xs text-foyer-muted">
            <tr>
              {/* Usage column */}
              <th className="px-4 py-2.5 text-left font-medium w-64">Usage pipeline</th>
              <th className="px-4 py-2.5 text-left font-medium">Provider</th>
              <th className="px-4 py-2.5 text-left font-medium">Modèle</th>
              {PRICE_FIELDS.map((f) => (
                <th key={f.key} className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                  <span className="inline-flex items-center justify-end gap-0.5">
                    {f.label}
                    <Tooltip text={f.tooltip} />
                  </span>
                </th>
              ))}
              <th className="px-4 py-2.5 text-left font-medium">Notes</th>
              <th className="px-3 py-2.5 text-center font-medium">Actif</th>
              <th className="px-3 py-2.5 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-foyer-border/50">
            {rows.map((row) => (
              <tr
                key={row.id}
                className={`group transition-colors hover:bg-foyer-border/10 ${!row.is_active ? "opacity-40" : ""}`}
              >
                {/* Usage */}
                <td className="px-4 py-2 text-xs text-foyer-muted max-w-[260px]">
                  <span className="line-clamp-2 leading-snug" title={getUsage(row.provider, row.model)}>
                    {getUsage(row.provider, row.model)}
                  </span>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-foyer-ink whitespace-nowrap">{row.provider}</td>
                <td className="px-4 py-2 font-mono text-xs text-foyer-muted whitespace-nowrap">{row.model ?? "—"}</td>
                {PRICE_FIELDS.map((f) => (
                  <td key={f.key} className="px-3 py-1">
                    <NumCell
                      rowId={row.id}
                      field={f.key}
                      value={row[f.key] as number | null}
                      onSave={saveCell}
                    />
                  </td>
                ))}
                <td className="px-4 py-2 text-xs text-foyer-muted max-w-[160px] truncate">
                  {row.notes ?? ""}
                </td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => toggleActive(row)} className="text-foyer-muted hover:text-foyer-ink transition-colors">
                    {row.is_active
                      ? <ToggleRight size={18} className="text-emerald-600" />
                      : <ToggleLeft size={18} />}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => deleteRow(row.id)}
                    className="text-foyer-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}

            {adding && (
              <tr className="bg-foyer-border/20">
                {/* Usage — auto-filled, not editable */}
                <td className="px-4 py-2 text-xs text-foyer-muted italic">auto</td>
                <td className="px-4 py-2">
                  <input
                    value={newRow.provider}
                    onChange={(e) => setNewRow((p) => ({ ...p, provider: e.target.value }))}
                    placeholder="gemini_vision"
                    className="w-full font-mono text-xs border border-foyer-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-foyer-ink"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    value={newRow.model ?? ""}
                    onChange={(e) => setNewRow((p) => ({ ...p, model: e.target.value }))}
                    placeholder="gemini-2.5-flash-lite"
                    className="w-full font-mono text-xs border border-foyer-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-foyer-ink"
                  />
                </td>
                {PRICE_FIELDS.map((f) => (
                  <td key={f.key} className="px-3 py-2">
                    <input
                      type="number"
                      step="any"
                      placeholder="—"
                      className="w-20 text-right font-mono text-xs border border-foyer-border rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-foyer-ink"
                      onChange={(e) =>
                        setNewRow((p) => ({
                          ...p,
                          [f.key]: e.target.value === "" ? null : Number(e.target.value),
                        }))
                      }
                    />
                  </td>
                ))}
                <td className="px-4 py-2">
                  <input
                    value={newRow.notes ?? ""}
                    onChange={(e) => setNewRow((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Note…"
                    className="w-full text-xs border border-foyer-border rounded px-2 py-1 focus:outline-none"
                  />
                </td>
                <td />
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button onClick={createRow} className="text-emerald-600 hover:text-emerald-700">
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => { setAdding(false); setNewRow({ ...EMPTY_NEW }); }}
                      className="text-foyer-muted hover:text-foyer-terra"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-foyer-muted mt-3">
        Tous les prix sont en USD. Le cache serveur est invalidé à chaque modification (rechargement au prochain appel IA).
      </p>
    </div>
  );
}
