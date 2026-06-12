"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Heart,
  Download,
  Share2,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Columns2,
  LayoutGrid,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type RenderRow = {
  id: string;
  status: string;
  ambiance_slug: string;
  render_url?: string | null;
  is_favorite?: boolean;
  pro_property_rooms?: { name: string; room_type: string } | null;
};

type JobStatus = {
  id: string;
  status: string;
  total_renders: number;
  completed_renders: number;
  failed_renders: number;
  renders: RenderRow[];
  pro_properties?: { address?: string; property_type?: string } | null;
};

type ViewMode = "grid" | "compare";

export default function JobResultsPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();

  const [job, setJob] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [sharingUrl, setSharingUrl] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchStatus = useCallback(async () => {
    const res = await fetch(`/api/pro/jobs/${jobId}/status`);
    if (!res.ok) return;
    const data = (await res.json()) as JobStatus;
    setJob(data);
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Poll while running
  useEffect(() => {
    if (!job) return;
    if (job.status === "completed" || job.status === "failed") return;
    const t = setInterval(fetchStatus, 4000);
    return () => clearInterval(t);
  }, [job, fetchStatus]);

  async function toggleFavorite(renderId: string, current: boolean) {
    await fetch(`/api/pro/renders/${renderId}/favorite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_favorite: !current }),
    });
    setJob((prev) =>
      prev
        ? {
            ...prev,
            renders: prev.renders.map((r) =>
              r.id === renderId ? { ...r, is_favorite: !current } : r,
            ),
          }
        : prev,
    );
  }

  async function handleShare() {
    const res = await fetch(`/api/pro/jobs/${jobId}/share`, { method: "POST" });
    if (!res.ok) { toast.error("Erreur lors de la création du lien."); return; }
    const { url } = (await res.json()) as { url: string };
    setSharingUrl(url);
  }

  async function copyShareUrl() {
    if (!sharingUrl) return;
    await navigator.clipboard.writeText(sharingUrl);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
    toast.success("Lien copié !");
  }

  async function exportPdf() {
    setExporting(true);
    try {
      const res = await fetch(`/api/pro/jobs/${jobId}/export-pdf`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `foyer-${jobId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Erreur lors de l'export PDF.");
    } finally {
      setExporting(false);
    }
  }

  function handleCompareClick(renderId: string) {
    if (compareA === renderId) { setCompareA(null); return; }
    if (compareB === renderId) { setCompareB(null); return; }
    if (!compareA) { setCompareA(renderId); return; }
    if (!compareB) { setCompareB(renderId); return; }
    setCompareA(renderId);
    setCompareB(null);
  }

  const completedRenders = job?.renders.filter((r) => r.status === "completed" && r.render_url) ?? [];
  const compareRenderA = completedRenders.find((r) => r.id === compareA);
  const compareRenderB = completedRenders.find((r) => r.id === compareB);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-foyer-muted" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <p className="text-[16px] text-foyer-muted">Job introuvable.</p>
        <button type="button" onClick={() => router.back()} className="text-[13px] text-foyer-sage underline">
          Retour
        </button>
      </div>
    );
  }

  const progress = job.total_renders > 0 ? (job.completed_renders / job.total_renders) * 100 : 0;
  const isRunning = job.status === "pending" || job.status === "running";

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full p-2 text-foyer-muted transition-colors hover:bg-foyer-border hover:text-foyer-ink"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div>
            <h1 className="font-serif text-[22px] font-medium text-foyer-ink">
              {job.pro_properties?.address ?? "Résultats"}
            </h1>
            <p className="text-[12px] text-foyer-muted">
              {job.completed_renders}/{job.total_renders} rendus terminés
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-xl border border-foyer-border bg-foyer-cream p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={cn(
                "rounded-lg p-1.5 transition-colors",
                viewMode === "grid" ? "bg-white shadow-sm text-foyer-ink" : "text-foyer-muted hover:text-foyer-ink",
              )}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("compare")}
              className={cn(
                "rounded-lg p-1.5 transition-colors",
                viewMode === "compare" ? "bg-white shadow-sm text-foyer-ink" : "text-foyer-muted hover:text-foyer-ink",
              )}
            >
              <Columns2 className="size-4" />
            </button>
          </div>

          {/* Share */}
          {!sharingUrl ? (
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 rounded-full border border-foyer-border px-3 py-1.5 text-[12px] font-medium text-foyer-muted transition-colors hover:text-foyer-ink"
            >
              <Share2 className="size-3.5" />
              Partager
            </button>
          ) : (
            <button
              type="button"
              onClick={copyShareUrl}
              className="flex items-center gap-1.5 rounded-full border border-foyer-sage px-3 py-1.5 text-[12px] font-medium text-foyer-sage"
            >
              {copying ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copying ? "Copié !" : "Copier le lien"}
            </button>
          )}

          {/* PDF export */}
          <button
            type="button"
            onClick={exportPdf}
            disabled={exporting || job.completed_renders === 0}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors",
              job.completed_renders === 0 || exporting
                ? "bg-foyer-muted/20 text-foyer-muted"
                : "bg-foyer-sage text-white hover:bg-foyer-sage/90",
            )}
          >
            {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            PDF
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {isRunning && (
        <div className="mb-6 rounded-2xl border border-foyer-border bg-foyer-cream p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-medium text-foyer-ink">Génération en cours…</span>
            <span className="text-[12px] text-foyer-muted">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-foyer-border">
            <div
              className="h-full rounded-full bg-foyer-sage transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Compare mode */}
      {viewMode === "compare" && (
        <div className="mb-6">
          {compareA && compareB ? (
            <div className="grid grid-cols-2 gap-4">
              {[compareRenderA, compareRenderB].map((r, i) => r && (
                <div key={r.id} className="space-y-2">
                  <div className="rounded-2xl border border-foyer-sage/40 bg-foyer-cream p-1">
                    <img src={r.render_url!} alt="" className="w-full rounded-xl object-cover" />
                  </div>
                  <p className="text-center text-[12px] text-foyer-muted">
                    {r.pro_property_rooms?.name} — {r.ambiance_slug}
                  </p>
                  <button
                    type="button"
                    onClick={() => i === 0 ? setCompareA(null) : setCompareB(null)}
                    className="block w-full text-center text-[11px] text-foyer-muted underline"
                  >
                    Retirer
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-foyer-border bg-foyer-cream px-6 py-8 text-center">
              <Columns2 className="mx-auto mb-2 size-6 text-foyer-muted/40" />
              <p className="text-[13px] text-foyer-muted">
                Sélectionnez 2 rendus dans la galerie ci-dessous pour les comparer.
                {compareA ? " (1/2 sélectionné)" : " (0/2 sélectionné)"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Renders grid */}
      {job.renders.length === 0 && !isRunning ? (
        <div className="rounded-2xl border border-dashed border-foyer-border bg-foyer-cream px-6 py-16 text-center">
          <XCircle className="mx-auto mb-3 size-8 text-red-400/60" />
          <p className="text-[14px] text-foyer-muted">Aucun rendu disponible.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {/* Pending slots */}
          {Array.from({ length: job.total_renders - job.renders.length }).map((_, i) => (
            <div
              key={`pending-${i}`}
              className="flex aspect-[4/3] animate-pulse flex-col items-center justify-center rounded-2xl border border-foyer-border bg-foyer-border/20"
            >
              <Loader2 className="size-6 animate-spin text-foyer-muted/40" />
            </div>
          ))}

          {/* Real renders (reverse: most recent first) */}
          {[...job.renders].reverse().map((render) => (
            <div
              key={render.id}
              className={cn(
                "group relative overflow-hidden rounded-2xl border transition-all",
                viewMode === "compare"
                  ? (compareA === render.id || compareB === render.id)
                    ? "border-foyer-sage ring-2 ring-foyer-sage/40 cursor-pointer"
                    : "border-foyer-border cursor-pointer hover:border-foyer-sage/50"
                  : "border-foyer-border",
              )}
              onClick={() => viewMode === "compare" && render.status === "completed" && render.render_url
                ? handleCompareClick(render.id)
                : undefined
              }
            >
              {render.status === "completed" && render.render_url ? (
                <>
                  <img
                    src={render.render_url}
                    alt={render.ambiance_slug}
                    className="aspect-[4/3] w-full object-cover"
                  />
                  {viewMode === "grid" && (
                    <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/40 via-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(render.id, !!render.is_favorite); }}
                          className={cn(
                            "rounded-full p-1.5 backdrop-blur-sm transition-colors",
                            render.is_favorite
                              ? "bg-red-500/80 text-white"
                              : "bg-black/30 text-white hover:bg-red-500/70",
                          )}
                        >
                          <Heart className={cn("size-4", render.is_favorite && "fill-current")} />
                        </button>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium text-white">{render.pro_property_rooms?.name}</p>
                        <p className="text-[10px] text-white/80">{render.ambiance_slug}</p>
                      </div>
                    </div>
                  )}
                </>
              ) : render.status === "failed" ? (
                <div className="flex aspect-[4/3] flex-col items-center justify-center bg-red-50">
                  <XCircle className="size-6 text-red-400" />
                  <p className="mt-1 text-[11px] text-red-400">Échec</p>
                </div>
              ) : (
                <div className="flex aspect-[4/3] flex-col items-center justify-center bg-foyer-cream">
                  <Loader2 className="size-5 animate-spin text-foyer-muted/60" />
                  <p className="mt-1 text-[10px] text-foyer-muted/60">En cours…</p>
                </div>
              )}

              {/* Compare selection indicator */}
              {viewMode === "compare" && (compareA === render.id || compareB === render.id) && (
                <div className="absolute left-2 top-2 flex size-5 items-center justify-center rounded-full bg-foyer-sage text-white">
                  <CheckCircle2 className="size-3.5" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
