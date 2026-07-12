"use client";

/**
 * HOTSPOTS SUR LE RENDU — un point par meuble shoppable (bbox de l'audit) :
 *  - clic/hover → box « Notre sélection » PERSISTANTE (fermeture au ✕ ou clic
 *    extérieur uniquement — un popover qui suit la souris est inutilisable) ;
 *  - clic sur un visuel = choisir SON produit préféré (remonte en tête de liste) ;
 *  - « Modifier ce meuble » → iterate ciblé (tap-to-target).
 * Murs & sols restent volontairement SANS hotspot (contrôles dédiés sous l'image).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, X, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { ShoppingItem } from "@/lib/types";

// Suggestions du mode ciblé (mêmes que l'écran iterate).
const TARGET_SUGGESTIONS = ["Remplacer par un autre modèle", "Changer la couleur", "Plus grand", "Plus petit", "Enlever ce meuble"];

type Bbox = { x: number; y: number; w: number; h: number };

// Catégories sans hotspot : surfaces à contrôles dédiés sous l'image. La
// PEINTURE murale, elle, a un pin (demande Alexis 2026-07-11) : positionné via
// la bbox du mur repeint (bboxById["paint-<hex>"], posée par analyzeRender).
const NO_HOTSPOT = new Set(["wall", "floor", "ceiling"]);

type Hotspot = {
  elementId: string;
  // Ligne shopping porteuse (elementId primaire de l'item) : le choix d'un
  // produit depuis N'IMPORTE quel pin d'une ligne ×N s'applique à LA ligne.
  // elementId reste l'exemplaire précis (tap-to-target sur CE meuble-là).
  selectId: string;
  name: string;
  cx: number; // centre bbox, en % du rendu
  cy: number;
  thumbs: { url: string; alt: string; idx: number }[];
};

export function RenderHotspots({
  projectId,
  items,
  bboxById,
  showModify,
  selected,
  onSelect,
  sliderPos = 0,
}: {
  projectId: string;
  items: ShoppingItem[];
  bboxById: Record<string, Bbox>;
  /** false en mode expert : l'édition live a son propre bouton. */
  showModify: boolean;
  /** Choix utilisateur par elementId (index dans matches). */
  selected?: Record<string, number>;
  onSelect?: (elementId: string, matchIdx: number) => void;
  /** Position du curseur avant/après (0-100). Les pins désignent des meubles du
   *  rendu APRÈS : sous la moitié « avant », ils pointeraient dans le vide. */
  sliderPos?: number;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  // Placement vertical mesuré à l'ouverture : au-dessus du point si la place
  // dans le VIEWPORT le permet, sinon en dessous (jamais coupée par la fenêtre).
  const [openAbove, setOpenAbove] = useState(true);
  const BOX_ESTIMATE_PX = 320;
  const openAt = (id: string, el: HTMLElement) => {
    setOpenAbove(el.getBoundingClientRect().top > BOX_ESTIMATE_PX);
    setOpenId(id);
  };
  const rootRef = useRef<HTMLDivElement>(null);
  // Modal « Modifier ce meuble » : instructions ciblées SANS quitter /final.
  const [modalFor, setModalFor] = useState<Hotspot | null>(null);
  const [targetNote, setTargetNote] = useState("");
  const [applying, setApplying] = useState(false);

  async function applyTargetEdit() {
    if (!modalFor || !targetNote.trim() || applying) return;
    setApplying(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/iterate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userRequest: targetNote.trim(),
          targetElementIds: [modalFor.elementId],
          targetLabel: modalFor.name,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? "La retouche a échoué. Réessayez.");
        setApplying(false);
        return;
      }
      window.location.reload(); // nouveau rendu + liste recalculée en fond
    } catch {
      toast.error("La retouche a échoué. Réessayez.");
      setApplying(false);
    }
  }

  // Clic N'IMPORTE OÙ en dehors de la couche hotspots (liste, page…) → fermer.
  useEffect(() => {
    if (!openId) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpenId(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [openId]);

  const hotspots = useMemo<Hotspot[]>(() => {
    const seen = new Set<string>();
    const out: Hotspot[] = [];
    for (const it of items) {
      // UN pin PAR exemplaire fusionné (elementIds) — 2 lampadaires sur une
      // ligne ×2 = 2 pins ; repli sur elementId pour les lignes non fusionnées.
      const ids = it.elementIds?.length ? it.elementIds : it.elementId ? [it.elementId] : [];
      if (ids.length === 0 || NO_HOTSPOT.has(it.category)) continue;
      const thumbs = (it.matches ?? [])
        .map((m, idx) => ({ url: m.primary_image_url, alt: m.name, idx }))
        .filter((t): t is { url: string; alt: string; idx: number } => Boolean(t.url))
        .slice(0, 4);
      if (thumbs.length === 0 && !showModify) continue; // rien à montrer ni à faire
      for (const id of ids) {
        if (seen.has(id)) continue;
        let b = bboxById[id];
        if (!b || b.w <= 0 || b.h <= 0) continue;
        // L'audit mélange parfois les échelles 0-1 et 0-1000 AU SEIN d'une même
        // bbox (ex. x normalisé, y en millièmes) → normalisation PAR COMPOSANTE.
        const n = (v: number) => (v > 1.5 ? v / 1000 : v);
        b = { x: n(b.x), y: n(b.y), w: n(b.w), h: n(b.h) };
        // Un meuble TRONQUÉ au bord du cadre revient parfois avec w/h = coordonnée
        // max (pas une taille) → x+w ou y+h > 1. On CLAMPE à l'image au lieu de
        // jeter le pin (fauteuil du 1er plan sans pin mais listé = incohérence,
        // projet QAWf50S1 2026-07-11) ; seuls les slivers dégénérés sont écartés.
        b = { x: Math.min(1, Math.max(0, b.x)), y: Math.min(1, Math.max(0, b.y)), w: b.w, h: b.h };
        b = { ...b, w: Math.min(b.w, 1 - b.x), h: Math.min(b.h, 1 - b.y) };
        if (b.w <= 0.02 || b.h <= 0.02) continue;
        seen.add(id);
        out.push({
          elementId: id,
          selectId: it.elementId ?? id,
          name: it.name,
          cx: Math.min(97, Math.max(3, (b.x + b.w / 2) * 100)),
          cy: Math.min(95, Math.max(5, (b.y + b.h / 2) * 100)),
          thumbs,
        });
      }
    }
    return out;
  }, [items, bboxById, showModify]);

  if (hotspots.length === 0) return null;

  return (
    // pointer-events-none : la couche laisse le slider avant/après fonctionner,
    // seuls les dots/popovers sont interactifs.
    // z-30 : la box qui déborde sous l'image doit passer AU-DESSUS des sections
    // suivantes (tabs, CTA édition live) — elles sont positionnées sans z-index.
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-30">
      {openId && (
        <button
          type="button"
          aria-label="Fermer"
          className="pointer-events-auto absolute inset-0 cursor-default"
          onClick={() => setOpenId(null)}
        />
      )}
      {hotspots.map((h) => {
        // Le pin désigne un meuble du rendu APRÈS. Passé sous le curseur, il
        // flotterait au-dessus de la photo AVANT, où le meuble n'existe pas.
        if (h.cx < sliderPos) return null;
        const open = openId === h.elementId;
        const chosen = selected?.[h.selectId] ?? 0;
        // Placement mesuré au viewport à l'ouverture ; recentrée près des bords.
        const above = openAbove;
        return (
          <div
            key={h.elementId}
            className="pointer-events-auto absolute"
            style={{ left: `${h.cx}%`, top: `${h.cy}%`, transform: "translate(-50%, -50%)" }}
          >
            <button
              type="button"
              aria-label={h.name}
              aria-expanded={open}
              onClick={(e) => (open ? setOpenId(null) : openAt(h.elementId, e.currentTarget))}
              onMouseEnter={(e) => openAt(h.elementId, e.currentTarget)}
              className="flex size-6 items-center justify-center rounded-full bg-white/85 shadow-[0_1px_6px_rgba(31,41,35,0.35)] ring-1 ring-black/10 backdrop-blur transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-foyer-sage"
            >
              <span className={`size-2.5 rounded-full transition-colors ${open ? "bg-foyer-sage" : "bg-foyer-ink/70"}`} />
            </button>

            {open && (
              <div
                className={`absolute left-1/2 z-20 w-[210px] -translate-x-1/2 rounded-2xl border border-foyer-border bg-white p-2.5 shadow-[0_8px_28px_rgba(31,41,35,0.18)] ${
                  above ? "bottom-8" : "top-8"
                } ${h.cx < 18 ? "translate-x-[-30%]" : h.cx > 82 ? "translate-x-[-70%]" : ""}`}
              >
                <div className="mb-1.5 flex items-start justify-between gap-2 px-0.5">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-foyer-sage">
                      Notre sélection — produits similaires
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-[12px] font-medium text-foyer-ink">{h.name}</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Fermer"
                    onClick={() => setOpenId(null)}
                    className="rounded-full p-0.5 text-foyer-muted transition-colors hover:bg-foyer-cream hover:text-foyer-ink"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </div>
                {h.thumbs.length > 0 ? (
                  <div className={`grid gap-1.5 ${h.thumbs.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                    {h.thumbs.map((t) => {
                      const isChosen = chosen === t.idx;
                      return (
                        <button
                          key={t.idx}
                          type="button"
                          onClick={() => onSelect?.(h.selectId, t.idx)}
                          aria-pressed={isChosen}
                          title={t.alt}
                          className={`relative overflow-hidden rounded-lg border transition-shadow ${
                            isChosen ? "border-foyer-sage ring-2 ring-foyer-sage/60" : "border-foyer-border/60 hover:ring-2 hover:ring-foyer-border"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={t.url} alt={t.alt} loading="lazy" className="aspect-square w-full bg-foyer-cream object-cover" />
                          {isChosen && (
                            <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-foyer-sage text-white">
                              <Check className="size-3" aria-hidden />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="px-1 pb-1 text-[11px] text-foyer-muted">Pas encore de propositions</p>
                )}
                {showModify && (
                  <button
                    type="button"
                    onClick={() => { setModalFor(h); setTargetNote(""); setOpenId(null); }}
                    className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded-full bg-foyer-sage text-[12px] font-medium text-white transition-opacity hover:opacity-90"
                  >
                    <Pencil className="size-3" aria-hidden />
                    Modifier ce meuble
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Modal instructions ciblées — reste sur /final, une génération au clic.
          PORTAL vers <body> : un `fixed` rendu dans la couche z-30 serait piégé
          dans son stacking context (tabs/liste visibles à travers, vu 2026-07-10). */}
      {modalFor && createPortal(
        <div
          className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center bg-foyer-ink/40 p-5 backdrop-blur-sm"
          onClick={() => { if (!applying) setModalFor(null); }}
        >
          <div
            className="w-full max-w-[380px] rounded-2xl border border-foyer-border bg-white p-4 shadow-[0_16px_48px_rgba(31,41,35,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-foyer-sage">Modifier ce meuble</p>
                <p className="mt-0.5 line-clamp-1 text-[14px] font-medium text-foyer-ink">{modalFor.name}</p>
              </div>
              <button
                type="button"
                aria-label="Fermer"
                disabled={applying}
                onClick={() => setModalFor(null)}
                className="rounded-full p-1 text-foyer-muted transition-colors hover:bg-foyer-cream hover:text-foyer-ink"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {TARGET_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTargetNote(s)}
                  className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                    targetNote === s
                      ? "border-2 border-foyer-ink bg-foyer-ink/5 text-foyer-ink"
                      : "border border-foyer-border text-foyer-muted hover:text-foyer-ink"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <textarea
              value={targetNote}
              onChange={(e) => setTargetNote(e.target.value)}
              placeholder={`Que faire de « ${modalFor.name} » ?`}
              rows={2}
              className="mt-3 w-full resize-none rounded-xl border border-foyer-border bg-foyer-cream px-3 py-2.5 text-sm text-foyer-ink outline-none placeholder:text-foyer-muted focus:border-foyer-ink"
            />
            <button
              type="button"
              disabled={!targetNote.trim() || applying}
              onClick={applyTargetEdit}
              className={`mt-3 flex h-[44px] w-full items-center justify-center gap-2 rounded-full font-medium transition-all ${
                !targetNote.trim() || applying
                  ? "bg-foyer-border text-foyer-muted"
                  : "bg-foyer-sage text-white shadow-[0_2px_8px_rgba(107,142,111,0.35)] hover:-translate-y-0.5"
              }`}
            >
              {applying ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Retouche en cours…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" aria-hidden />
                  Appliquer
                </>
              )}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
