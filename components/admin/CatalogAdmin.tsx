"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { getSchemaV3, schemaForCategory } from "@/lib/shopping/attributeSchemaV3";
import { COLOR_FAMILIES } from "@/lib/color";

type PartnerProduct = {
  id: string;
  name: string;
  category: string;
  merchant: string;
  price: number | null;
  partner_tier: string;
  source_type: string;
  availability_status: string;
  primary_image_url: string;
  last_synced_at: string | null;
  created_at: string;
  metadata?: { attrs?: Record<string, unknown>; style_compatible?: string[] } | null;
  // Tags de style CORE (le produit incarne le style) — backfill-style-tags.
  style_affinity?: string[] | null;
};

type SyncRun = {
  id: string;
  merchant: string;
  source: string;
  status: string;
  items_added: number;
  items_updated: number;
  items_marked_unavailable: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
};

type Props = {
  initialProducts: PartnerProduct[];
  totalCount: number;
  syncRuns: SyncRun[];
  merchants: string[];
  categories: string[];
};

const TIER_COLORS: Record<string, string> = {
  strategic: "bg-amber-100 text-amber-800",
  standard: "bg-gray-100 text-gray-700",
  discovery: "bg-blue-50 text-blue-700",
};

const STATUS_COLORS: Record<string, string> = {
  available: "text-green-600",
  discontinued: "text-red-500",
  out_of_stock: "text-orange-500",
  low_stock: "text-yellow-600",
};

const SYNC_STATUS_COLORS: Record<string, string> = {
  success: "text-green-600",
  failed: "text-red-500",
  running: "text-blue-500",
};

const TIERS = ["", "strategic", "standard", "discovery"];
const SOURCE_TYPES = ["", "eco_new", "secondhand", "eco_label_certified"];
// 18 collections canoniques (source data/styles.json) pour le filtre de tags de style.
const STYLES = ["", "scandinave", "japandi", "boheme", "boho", "mid-century", "industriel", "mediterraneen", "haussmannien", "wabi-sabi", "quiet-luxury", "art-deco", "cottage-anglais", "dark-academia", "desert", "seventies", "color-block", "memphis", "maximaliste"];

export function CatalogAdmin({ initialProducts, totalCount, syncRuns, merchants, categories }: Props) {
  const MERCHANTS = ["", ...merchants];
  // Catégories = DISTINCT réel du catalogue (RPC distinct_catalog_categories, trié A-Z côté
  // SQL) — remplace une liste dérivée du schéma d'attributs qui omettait les catégories sans
  // schéma dédié (curtains, cushion, bed, nightstand, paint, seat_pad → schéma "default").
  const CATEGORIES = ["", ...categories];
  const [products, setProducts] = useState(initialProducts);
  const [count, setCount] = useState(totalCount);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    merchant: "", category: "", partner_tier: "", source_type: "", availability_status: "",
    style_core: "", style_compatible: "",
  });
  // Filtres par attribut structuré (multi-select : plusieurs valeurs par attribut → OU).
  const [attrFilters, setAttrFilters] = useState<Record<string, string[]>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTier, setEditingTier] = useState("");
  const [syncing, setSyncing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Sélection en masse (édition groupée d'attributs) — persiste entre pages, remise à
  // zéro seulement au changement de catégorie (le schéma d'attributs en dépend).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkField, setBulkField] = useState<"attr" | "category">("attr");
  const [bulkAttr, setBulkAttr] = useState<{ key: string; value: string }>({ key: "", value: "" });
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  // Aperçu grand format au survol d'une miniature (fixed → pas clippé par l'overflow du tableau).
  const [hover, setHover] = useState<{ url: string; x: number; y: number } | null>(null);

  // Tout changement de FILTRE repart de la page 1 — et remet l'état `page` avec.
  // Sans ça (bug QA 2026-07-11), filtrer depuis la page 40 laissait page=40 alors
  // que les données affichées étaient celles de la page 1 : « Suiv. » se
  // désactivait (page >= totalPages) et la navigation était bloquée.
  function applyFilters(f = filters, s = search, af = attrFilters) {
    setPage(1);
    void fetchProducts(1, f, s, af);
  }

  function goToPage(p: number) {
    setPage(p);
    void fetchProducts(p);
  }

  async function fetchProducts(p = page, f = filters, s = search, af = attrFilters) {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        ...(s ? { search: s } : {}),
        ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)),
      });
      // Multi-select : un param attr_<clé> répété par valeur cochée (→ filtre IN côté API).
      for (const [k, vals] of Object.entries(af)) for (const v of vals) if (v) params.append(`attr_${k}`, v);
      const res = await fetch(`/api/admin/catalog?${params}`);
      const data = await res.json() as { data: PartnerProduct[]; count: number };
      setProducts(data.data ?? []);
      setCount(data.count ?? 0);
    } catch {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  // Persistance position/filtres au retour d'une fiche produit (sessionStorage).
  const STORAGE_KEY = "catalogAdmin.state";
  function saveState() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ filters, attrFilters, search, page, scrollY: window.scrollY }));
    } catch { /* ignore */ }
  }
  useEffect(() => {
    const raw = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return;
    try {
      const s = JSON.parse(raw) as { filters?: typeof filters; attrFilters?: Record<string, string[]>; search?: string; page?: number; scrollY?: number };
      if (s.filters) setFilters(s.filters);
      if (s.attrFilters) setAttrFilters(s.attrFilters);
      if (s.search) setSearch(s.search);
      const p = s.page ?? 1;
      setPage(p);
      void fetchProducts(p, s.filters ?? filters, s.search ?? "", s.attrFilters ?? {}).then(() => {
        if (typeof s.scrollY === "number") requestAnimationFrame(() => window.scrollTo(0, s.scrollY!));
      });
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveTier(id: string) {
    try {
      await fetch(`/api/admin/catalog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partner_tier: editingTier }),
      });
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, partner_tier: editingTier } : p)),
      );
      setEditingId(null);
      toast.success("Tier mis à jour");
    } catch {
      toast.error("Erreur lors de la mise à jour");
    }
  }

  async function handleSync(merchant?: string) {
    setSyncing(merchant ?? "all");
    try {
      const res = await fetch("/api/admin/catalog/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchant }),
      });
      const data = await res.json() as { results: Record<string, unknown> };
      toast.success(`Sync lancée : ${JSON.stringify(data.results)}`);
      await fetchProducts(1);
    } catch {
      toast.error("Erreur de sync");
    } finally {
      setSyncing(null);
    }
  }

  const totalPages = Math.ceil(count / 20);
  // Attributs enum de la catégorie sélectionnée + couleur par famille → filtres multi-select.
  const attrSchema = filters.category
    ? getSchemaV3(schemaForCategory(filters.category)).filter((a) => a.type === "enum")
    : [];
  const attrGroups: { key: string; values: string[] }[] = filters.category
    ? [
        { key: "color_family", values: [...COLOR_FAMILIES] },
        ...attrSchema.map((a) => ({ key: a.key, values: [...(a.vocab ?? []), "unknown", "n/a"] })),
      ]
    : [];

  // Schéma COMPLET (enum + hex) de la catégorie filtrée, pour l'édition en masse — distinct
  // de `attrSchema` ci-dessous qui ne garde que les enum (sert aux filtres multi-select).
  const bulkSchema = filters.category ? getSchemaV3(schemaForCategory(filters.category)) : [];

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const pageIds = products.map((p) => p.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function togglePageSelection() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function selectAllFiltered() {
    setSelectingAll(true);
    try {
      const params = new URLSearchParams({
        ids_only: "1",
        ...(search ? { search } : {}),
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      });
      for (const [k, vals] of Object.entries(attrFilters)) for (const v of vals) if (v) params.append(`attr_${k}`, v);
      const res = await fetch(`/api/admin/catalog?${params}`);
      const data = (await res.json()) as { data: { id: string }[]; count: number };
      setSelected(new Set(data.data.map((r) => r.id)));
      if (data.count > data.data.length) {
        toast.warning(`${data.count} produits correspondent aux filtres, seuls les ${data.data.length} premiers sont sélectionnés (limite édition groupée).`);
      }
    } catch {
      toast.error("Erreur de sélection");
    } finally {
      setSelectingAll(false);
    }
  }

  function clearSelection() {
    setSelected(new Set());
    setBulkAttr({ key: "", value: "" });
    setBulkCategory("");
  }

  async function applyBulk() {
    const isCategory = bulkField === "category";
    if (isCategory ? !bulkCategory : !bulkAttr.key || !bulkAttr.value) return;
    const label = isCategory ? `catégorie = ${bulkCategory}` : `${bulkAttr.key} = ${bulkAttr.value}`;
    if (!confirm(`Appliquer ${label} à ${selected.size} produit(s) ?`)) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/admin/catalog/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isCategory ? { ids: [...selected], category: bulkCategory } : { ids: [...selected], attr: bulkAttr }),
      });
      const data = (await res.json()) as { updated?: number; failed?: number; error?: string };
      if (!res.ok) { toast.error(data.error ?? "Échec de l'édition groupée"); return; }
      toast.success(`${data.updated ?? 0} produit(s) mis à jour${data.failed ? ` · ${data.failed} échec(s)` : ""}`);
      clearSelection();
      // Recharge depuis le serveur (mêmes filtres/page) plutôt qu'un patch local : si le
      // filtre actif (attribut OU catégorie) ne matche plus les produits corrigés, ils
      // doivent disparaître de la liste — un patch local ne le voyait pas et le compteur
      // `count` restait périmé.
      await fetchProducts();
    } catch {
      toast.error("Échec de l'édition groupée");
    } finally {
      setBulkBusy(false);
    }
  }

  function toggleAttr(key: string, value: string) {
    const cur = attrFilters[key] ?? [];
    const next = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
    const af = { ...attrFilters, [key]: next };
    setAttrFilters(af);
    applyFilters(filters, search, af);
  }

  // Pagination numérotée : 1 … n-1 [n] n+1 … N (fenêtre glissante + ellipses).
  function pageItems(current: number, total: number): (number | "…")[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const out: (number | "…")[] = [1];
    const from = Math.max(2, current - 1);
    const to = Math.min(total - 1, current + 1);
    if (from > 2) out.push("…");
    for (let p = from; p <= to; p++) out.push(p);
    if (to < total - 1) out.push("…");
    out.push(total);
    return out;
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-foyer-ink">Catalogue partenaires</h1>
          <p className="mt-1 text-sm text-foyer-muted">
            {count} produit{count !== 1 ? "s" : ""} · hybrid matching α-10
          </p>
        </div>
        <button
          onClick={() => handleSync()}
          disabled={syncing !== null}
          className="flex items-center gap-2 rounded-lg bg-foyer-ink px-4 py-2.5 text-sm font-medium text-foyer-cream hover:bg-foyer-ink/90 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
          Resync tous
        </button>
      </div>

      {/* Filtres */}
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchProducts(1, filters, search)}
          placeholder="Rechercher par nom…"
          className="rounded-md border border-foyer-border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-foyer-sage"
        />
        {[
          { key: "category", label: "Catégorie", opts: CATEGORIES },
          { key: "merchant", label: "Merchant", opts: MERCHANTS },
          { key: "partner_tier", label: "Tier", opts: TIERS },
          { key: "source_type", label: "Source", opts: SOURCE_TYPES },
          { key: "style_core", label: "Style core", opts: STYLES },
          { key: "style_compatible", label: "Style compatible", opts: STYLES },
        ].map(({ key, label, opts }) => (
          <select
            key={key}
            value={filters[key as keyof typeof filters]}
            onChange={(e) => {
              const f = { ...filters, [key]: e.target.value };
              setFilters(f);
              // Changer de catégorie réinitialise les filtres d'attribut (vocab différent)
              // ET la sélection en masse (le schéma d'édition groupée en dépend aussi).
              if (key === "category") { setAttrFilters({}); clearSelection(); fetchProducts(1, f, search, {}); }
              else fetchProducts(1, f);
            }}
            className="rounded-md border border-foyer-border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-foyer-sage"
          >
            <option value="">{label}</option>
            {opts.filter(Boolean).map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ))}
        <button
          onClick={() => applyFilters()}
          disabled={loading}
          className="rounded-md border border-foyer-border px-3 py-1.5 text-sm text-foyer-muted hover:text-foyer-ink disabled:opacity-50"
        >
          {loading ? "Chargement…" : "Filtrer"}
        </button>
      </div>

      {/* Filtres par attribut (catégorie sélectionnée) */}
      {filters.category && (
        <div className="mb-4 flex flex-wrap items-start gap-2 rounded-md border border-dashed border-foyer-border bg-foyer-cream/30 px-3 py-2">
          <span className="mt-1.5 text-xs font-medium uppercase tracking-wide text-foyer-muted">Attributs</span>
          {/* Multi-select par attribut (+ couleur par famille). Plusieurs valeurs cochées = OU. */}
          {attrGroups.map((g) => {
            const sel = attrFilters[g.key] ?? [];
            return (
              <details key={g.key} className="relative">
                <summary className="cursor-pointer list-none rounded-md border border-foyer-border bg-white px-2.5 py-1.5 text-sm">
                  {g.key === "color_family" ? "couleur" : g.key}{sel.length ? ` (${sel.length})` : ""}
                </summary>
                <div className="absolute z-20 mt-1 max-h-64 w-44 overflow-auto rounded-md border border-foyer-border bg-white p-1.5 shadow-lg">
                  {g.values.map((v) => (
                    <label key={v} className="flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-sm hover:bg-foyer-cream/50">
                      <input type="checkbox" checked={sel.includes(v)} onChange={() => toggleAttr(g.key, v)} />
                      {v}
                    </label>
                  ))}
                </div>
              </details>
            );
          })}
          {Object.values(attrFilters).some((a) => a.length) && (
            <button
              onClick={() => { setAttrFilters({}); applyFilters(filters, search, {}); }}
              className="mt-1.5 text-xs text-foyer-muted underline hover:text-foyer-ink"
            >
              réinitialiser
            </button>
          )}
        </div>
      )}

      {/* Édition groupée — visible dès qu'une sélection existe. Deux champs éditables :
          attribut structuré (nécessite un filtre catégorie, schéma dépendant) ou catégorie
          elle-même (reclassement, ex. corriger un canapé importé en armchair). */}
      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-foyer-sage bg-foyer-sage/10 px-3 py-2.5">
          <span className="text-sm font-medium text-foyer-ink">{selected.size} sélectionné{selected.size > 1 ? "s" : ""}</span>
          <select
            value={bulkField}
            onChange={(e) => { setBulkField(e.target.value as "attr" | "category"); setBulkAttr({ key: "", value: "" }); setBulkCategory(""); }}
            className="rounded-md border border-foyer-border bg-white px-2.5 py-1.5 text-sm"
          >
            <option value="attr">Attribut</option>
            <option value="category">Catégorie</option>
          </select>

          {bulkField === "category" ? (
            <>
              <select
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                className="rounded-md border border-foyer-border bg-white px-2.5 py-1.5 text-sm"
              >
                <option value="">Nouvelle catégorie…</option>
                {CATEGORIES.filter(Boolean).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button
                onClick={applyBulk}
                disabled={!bulkCategory || bulkBusy}
                className="rounded-md bg-foyer-ink px-3 py-1.5 text-sm font-medium text-foyer-cream hover:bg-foyer-ink/90 disabled:opacity-50"
              >
                {bulkBusy ? "Application…" : `Reclasser ${selected.size}`}
              </button>
            </>
          ) : !filters.category ? (
            <span className="text-xs text-foyer-muted">— filtrez par catégorie pour éditer un attribut en masse</span>
          ) : (
            <>
              <select
                value={bulkAttr.key}
                onChange={(e) => setBulkAttr({ key: e.target.value, value: "" })}
                className="rounded-md border border-foyer-border bg-white px-2.5 py-1.5 text-sm"
              >
                <option value="">Attribut…</option>
                {bulkSchema.map((a) => (
                  <option key={a.key} value={a.key}>{a.key}</option>
                ))}
              </select>
              {bulkAttr.key && (() => {
                const attrDef = bulkSchema.find((a) => a.key === bulkAttr.key);
                if (!attrDef) return null;
                if (attrDef.type === "hex") {
                  return (
                    <input
                      value={bulkAttr.value}
                      onChange={(e) => setBulkAttr({ ...bulkAttr, value: e.target.value })}
                      placeholder="#rrggbb"
                      className="w-28 rounded-md border border-foyer-border bg-white px-2.5 py-1.5 font-mono text-sm"
                    />
                  );
                }
                return (
                  <select
                    value={bulkAttr.value}
                    onChange={(e) => setBulkAttr({ ...bulkAttr, value: e.target.value })}
                    className="rounded-md border border-foyer-border bg-white px-2.5 py-1.5 text-sm"
                  >
                    <option value="">Valeur…</option>
                    {[...(attrDef.vocab ?? []), "unknown", "n/a"].map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                );
              })()}
              <button
                onClick={applyBulk}
                disabled={!bulkAttr.key || !bulkAttr.value || bulkBusy}
                className="rounded-md bg-foyer-ink px-3 py-1.5 text-sm font-medium text-foyer-cream hover:bg-foyer-ink/90 disabled:opacity-50"
              >
                {bulkBusy ? "Application…" : `Appliquer à ${selected.size}`}
              </button>
            </>
          )}
          {allPageSelected && count > products.length && (
            <button
              onClick={selectAllFiltered}
              disabled={selectingAll}
              className="text-xs text-foyer-sage underline hover:text-foyer-ink disabled:opacity-50"
            >
              {selectingAll ? "…" : `sélectionner les ${count} produits des filtres`}
            </button>
          )}
          <button onClick={clearSelection} className="ml-auto text-xs text-foyer-muted underline hover:text-foyer-ink">
            désélectionner
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-foyer-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-foyer-cream/50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input type="checkbox" checked={allPageSelected} onChange={togglePageSelection} aria-label="Tout sélectionner cette page" />
              </th>
              {["Image", "Nom", "Catégorie", "Styles", "Merchant", "Prix", "Tier", "Statut", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-foyer-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-foyer-border">
            {products.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-foyer-muted">
                  {loading ? "Chargement…" : "Aucun produit. Lancez une sync pour importer."}
                </td>
              </tr>
            )}
            {products.map((p) => (
              <tr key={p.id} className={`hover:bg-foyer-cream/30 ${selected.has(p.id) ? "bg-foyer-sage/5" : ""}`}>
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} aria-label={`Sélectionner ${p.name}`} />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/catalog/${p.id}`} className="block" onClick={saveState}>
                    {p.primary_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.primary_image_url}
                        alt={p.name}
                        className="size-20 rounded-md object-cover border border-foyer-border"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        onMouseEnter={(e) => setHover({ url: p.primary_image_url, x: e.clientX, y: e.clientY })}
                        onMouseMove={(e) => setHover((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : h))}
                        onMouseLeave={() => setHover(null)}
                      />
                    ) : (
                      <div className="size-20 rounded-md bg-foyer-cream border border-foyer-border" />
                    )}
                  </Link>
                </td>
                <td className="px-4 py-3 max-w-[280px]">
                  <Link href={`/admin/catalog/${p.id}`} className="block truncate font-medium text-foyer-ink hover:text-foyer-sage hover:underline" onClick={saveState}>
                    {p.name}
                  </Link>
                  {p.metadata?.attrs && Object.keys(p.metadata.attrs).length > 0 && (
                    <div className="mt-0.5 truncate text-[11px] text-foyer-muted" title={Object.entries(p.metadata.attrs).map(([k, v]) => `${k}:${v}`).join(" · ")}>
                      {Object.entries(p.metadata.attrs).map(([k, v]) => `${k}:${v}`).join(" · ")}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-foyer-muted">{p.category}</td>
                {/* Tags de style : core = chip pleine (incarne), compatible = contour. */}
                <td className="px-4 py-3 max-w-[180px]">
                  <div className="flex flex-wrap gap-1">
                    {(p.style_affinity ?? []).map((s) => (
                      <span key={s} className="rounded-full bg-foyer-sage/90 px-2 py-0.5 text-[10px] font-medium text-white">{s}</span>
                    ))}
                    {(p.metadata?.style_compatible ?? []).slice(0, 3).map((s) => (
                      <span key={s} className="rounded-full border border-foyer-border px-2 py-0.5 text-[10px] text-foyer-muted" title="compatible">{s}</span>
                    ))}
                    {(p.metadata?.style_compatible?.length ?? 0) > 3 && (
                      <span className="text-[10px] text-foyer-muted" title={(p.metadata?.style_compatible ?? []).slice(3).join(", ")}>+{(p.metadata?.style_compatible?.length ?? 0) - 3}</span>
                    )}
                    {!(p.style_affinity?.length || p.metadata?.style_compatible?.length) && (
                      <span className="text-[10px] text-foyer-muted">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-foyer-muted">{p.merchant}</td>
                <td className="px-4 py-3 text-foyer-ink">
                  {p.price != null ? `${p.price} €` : "–"}
                </td>
                <td className="px-4 py-3">
                  {editingId === p.id ? (
                    <div className="flex gap-1">
                      <select
                        value={editingTier}
                        onChange={(e) => setEditingTier(e.target.value)}
                        className="rounded border border-foyer-border px-1.5 py-1 text-xs"
                      >
                        {["strategic", "standard", "discovery"].map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleSaveTier(p.id)}
                        className="rounded bg-foyer-sage px-2 py-1 text-xs text-white"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded border border-foyer-border px-2 py-1 text-xs text-foyer-muted"
                      >
                        ✗
                      </button>
                    </div>
                  ) : (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIER_COLORS[p.partner_tier] ?? ""}`}>
                      {p.partner_tier}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${STATUS_COLORS[p.availability_status] ?? "text-foyer-muted"}`}>
                    {p.availability_status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingId(p.id); setEditingTier(p.partner_tier); }}
                      className="text-xs text-foyer-muted hover:text-foyer-ink"
                    >
                      Tier
                    </button>
                    <button
                      onClick={() => handleSync(p.merchant)}
                      disabled={syncing !== null}
                      className="text-xs text-foyer-muted hover:text-foyer-sage disabled:opacity-50"
                    >
                      Sync
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination numérotée (+ saut direct) — « Préc./Suiv. » seuls obligeaient
          à 50 clics pour atteindre la page 50 d'un filtre. */}
      {totalPages > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-foyer-muted">
          <span>{count} produits · page {page}/{totalPages}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1 || loading}
              className="flex items-center gap-1 rounded border border-foyer-border px-2.5 py-1.5 hover:text-foyer-ink disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" /> Préc.
            </button>

            {pageItems(page, totalPages).map((it, i) =>
              it === "…" ? (
                <span key={`gap-${i}`} className="px-1 text-foyer-muted/60">…</span>
              ) : (
                <button
                  key={it}
                  onClick={() => goToPage(it)}
                  disabled={loading}
                  aria-current={it === page ? "page" : undefined}
                  className={`min-w-8 rounded border px-2 py-1.5 tabular-nums transition-colors disabled:opacity-40 ${
                    it === page
                      ? "border-foyer-ink bg-foyer-ink font-medium text-foyer-cream"
                      : "border-foyer-border hover:text-foyer-ink"
                  }`}
                >
                  {it}
                </button>
              ),
            )}

            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages || loading}
              className="flex items-center gap-1 rounded border border-foyer-border px-2.5 py-1.5 hover:text-foyer-ink disabled:opacity-40"
            >
              Suiv. <ChevronRight className="size-3.5" />
            </button>

            {totalPages > 7 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = Number(new FormData(e.currentTarget).get("goto"));
                  if (Number.isFinite(v) && v >= 1 && v <= totalPages) goToPage(v);
                }}
                className="ml-1 flex items-center gap-1"
              >
                <input
                  name="goto"
                  type="number"
                  min={1}
                  max={totalPages}
                  placeholder="N°"
                  className="w-16 rounded border border-foyer-border bg-white px-2 py-1.5 text-foyer-ink outline-none focus:border-foyer-ink"
                />
                <button type="submit" className="rounded border border-foyer-border px-2 py-1.5 hover:text-foyer-ink">
                  Aller
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Sync runs */}
      <div className="mt-10">
        <h2 className="mb-3 font-medium text-foyer-ink">Historique des syncs</h2>
        {syncRuns.length === 0 ? (
          <p className="text-sm text-foyer-muted italic">Aucune sync effectuée.</p>
        ) : (
          <div className="rounded-lg border border-foyer-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-foyer-cream/50">
                <tr>
                  {["Merchant", "Source", "Statut", "+", "~", "✗", "Date"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-foyer-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-foyer-border">
                {syncRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-foyer-cream/30">
                    <td className="px-4 py-2.5 font-medium text-foyer-ink">{run.merchant}</td>
                    <td className="px-4 py-2.5 text-foyer-muted">{run.source}</td>
                    <td className={`px-4 py-2.5 font-medium ${SYNC_STATUS_COLORS[run.status] ?? ""}`}>
                      {run.status}
                      {run.error_message && (
                        <span className="ml-1 text-xs text-foyer-muted" title={run.error_message}>⚠</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-green-600">+{run.items_added}</td>
                    <td className="px-4 py-2.5 text-foyer-muted">~{run.items_updated}</td>
                    <td className="px-4 py-2.5 text-red-400">✗{run.items_marked_unavailable}</td>
                    <td className="px-4 py-2.5 text-foyer-muted text-xs">
                      {new Date(run.started_at).toLocaleString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Aperçu grand format au survol (400×400, suit la souris, clampé à l'écran). */}
      {hover && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border border-foyer-border bg-white p-1 shadow-2xl"
          style={{
            left: Math.min(hover.x + 24, (typeof window !== "undefined" ? window.innerWidth : 1280) - 424),
            top: Math.min(Math.max(hover.y - 200, 8), (typeof window !== "undefined" ? window.innerHeight : 800) - 424),
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hover.url} alt="" className="size-[400px] rounded object-contain" />
        </div>
      )}
    </div>
  );
}
