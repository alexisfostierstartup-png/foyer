"use client";

import Link from "next/link";
import { useState } from "react";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

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

const MERCHANTS = ["", "manomano", "castorama", "la_redoute", "ikea", "cdiscount", "leroy_merlin"];
const TIERS = ["", "strategic", "standard", "discovery"];
const SOURCE_TYPES = ["", "eco_new", "secondhand", "eco_label_certified"];
const CATEGORIES = [
  "", "sofa", "armchair", "coffee_table", "side_table", "tv_stand", "sideboard",
  "bookshelf", "dining_table", "chair", "rug", "floor_lamp", "dresser",
  "paint", "mouldings", "batten", "floor",
];

export function CatalogAdmin({ initialProducts, totalCount, syncRuns }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [count, setCount] = useState(totalCount);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    merchant: "", category: "", partner_tier: "", source_type: "", availability_status: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTier, setEditingTier] = useState("");
  const [syncing, setSyncing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchProducts(p = page, f = filters, s = search) {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        ...(s ? { search: s } : {}),
        ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)),
      });
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
        ].map(({ key, label, opts }) => (
          <select
            key={key}
            value={filters[key as keyof typeof filters]}
            onChange={(e) => {
              const f = { ...filters, [key]: e.target.value };
              setFilters(f);
              fetchProducts(1, f);
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
          onClick={() => fetchProducts(1)}
          disabled={loading}
          className="rounded-md border border-foyer-border px-3 py-1.5 text-sm text-foyer-muted hover:text-foyer-ink disabled:opacity-50"
        >
          {loading ? "Chargement…" : "Filtrer"}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-foyer-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-foyer-cream/50">
            <tr>
              {["Image", "Nom", "Catégorie", "Merchant", "Prix", "Tier", "Statut", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-foyer-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-foyer-border">
            {products.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-foyer-muted">
                  {loading ? "Chargement…" : "Aucun produit. Lancez une sync pour importer."}
                </td>
              </tr>
            )}
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-foyer-cream/30">
                <td className="px-4 py-3">
                  <Link href={`/admin/catalog/${p.id}`} className="block">
                    {p.primary_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.primary_image_url}
                        alt={p.name}
                        className="size-10 rounded-md object-cover border border-foyer-border"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="size-10 rounded-md bg-foyer-cream border border-foyer-border" />
                    )}
                  </Link>
                </td>
                <td className="px-4 py-3 max-w-[200px]">
                  <Link href={`/admin/catalog/${p.id}`} className="block truncate font-medium text-foyer-ink hover:text-foyer-sage hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-foyer-muted">{p.category}</td>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-foyer-muted">
          <span>Page {page}/{totalPages} · {count} produits</span>
          <div className="flex gap-2">
            <button
              onClick={() => { setPage((p) => p - 1); fetchProducts(page - 1); }}
              disabled={page <= 1}
              className="flex items-center gap-1 rounded border border-foyer-border px-3 py-1.5 hover:text-foyer-ink disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" /> Préc.
            </button>
            <button
              onClick={() => { setPage((p) => p + 1); fetchProducts(page + 1); }}
              disabled={page >= totalPages}
              className="flex items-center gap-1 rounded border border-foyer-border px-3 py-1.5 hover:text-foyer-ink disabled:opacity-40"
            >
              Suiv. <ChevronRight className="size-3.5" />
            </button>
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
    </div>
  );
}
