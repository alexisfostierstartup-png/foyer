"use client";

/**
 * HOTSPOTS SUR LE RENDU — un point par meuble shoppable (bbox de l'audit) :
 *  - hover (desktop) / tap (mobile) → mini-fenêtre avec les visuels des matches ;
 *  - « Modifier ce meuble » → iterate ciblé (tap-to-target, libération précise
 *    du verrou de liste par element_id).
 * Murs & sols restent volontairement SANS hotspot (contrôles dédiés sous l'image).
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import type { ShoppingItem } from "@/lib/types";

type Bbox = { x: number; y: number; w: number; h: number };

// Catégories sans hotspot : surfaces (contrôles dédiés) et peinture.
const NO_HOTSPOT = new Set(["wall", "floor", "ceiling", "paint"]);

type Hotspot = {
  elementId: string;
  name: string;
  cx: number; // centre bbox, en % du rendu
  cy: number;
  thumbs: { url: string; alt: string }[];
};

export function RenderHotspots({
  projectId,
  items,
  bboxById,
  showModify,
}: {
  projectId: string;
  items: ShoppingItem[];
  bboxById: Record<string, Bbox>;
  /** false en mode expert : l'édition live a son propre bouton. */
  showModify: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const hotspots = useMemo<Hotspot[]>(() => {
    const seen = new Set<string>();
    const out: Hotspot[] = [];
    for (const it of items) {
      if (!it.elementId || seen.has(it.elementId) || NO_HOTSPOT.has(it.category)) continue;
      let b = bboxById[it.elementId];
      if (!b || b.w <= 0 || b.h <= 0) continue;
      // L'audit renvoie parfois la bbox en 0-1000 au lieu de 0-1 (variance
      // modèle) → normalisation défensive, et rejet si toujours incohérente.
      if (b.x > 1.5 || b.y > 1.5 || b.w > 1.5 || b.h > 1.5) {
        b = { x: b.x / 1000, y: b.y / 1000, w: b.w / 1000, h: b.h / 1000 };
      }
      if (b.x + b.w > 1.2 || b.y + b.h > 1.2) continue;
      const thumbs = (it.matches ?? [])
        .filter((m) => m.primary_image_url)
        .slice(0, 4)
        .map((m) => ({ url: m.primary_image_url as string, alt: m.name }));
      if (thumbs.length === 0 && !showModify) continue; // rien à montrer ni à faire
      seen.add(it.elementId);
      out.push({
        elementId: it.elementId,
        name: it.name,
        cx: Math.min(97, Math.max(3, (b.x + b.w / 2) * 100)),
        cy: Math.min(95, Math.max(5, (b.y + b.h / 2) * 100)),
        thumbs,
      });
    }
    return out;
  }, [items, bboxById, showModify]);

  if (hotspots.length === 0) return null;

  return (
    // pointer-events-none : la couche laisse le slider avant/après fonctionner,
    // seuls les dots/popovers sont interactifs.
    <div className="pointer-events-none absolute inset-0 z-10">
      {openId && (
        <button
          type="button"
          aria-label="Fermer"
          className="pointer-events-auto absolute inset-0 cursor-default"
          onClick={() => setOpenId(null)}
        />
      )}
      {hotspots.map((h) => {
        const open = openId === h.elementId;
        // Popover au-dessus du dot, en dessous si trop haut ; recentré près des bords.
        const above = h.cy > 30;
        return (
          <div
            key={h.elementId}
            className="pointer-events-auto absolute"
            style={{ left: `${h.cx}%`, top: `${h.cy}%`, transform: "translate(-50%, -50%)" }}
            onMouseEnter={() => setOpenId(h.elementId)}
            onMouseLeave={() => setOpenId((v) => (v === h.elementId ? null : v))}
          >
            <button
              type="button"
              aria-label={h.name}
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : h.elementId)}
              className="flex size-6 items-center justify-center rounded-full bg-white/85 shadow-[0_1px_6px_rgba(31,41,35,0.35)] ring-1 ring-black/10 backdrop-blur transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-foyer-sage"
            >
              <span className={`size-2.5 rounded-full transition-colors ${open ? "bg-foyer-sage" : "bg-foyer-ink/70"}`} />
            </button>

            {open && (
              <div
                className={`absolute left-1/2 z-20 w-[196px] -translate-x-1/2 rounded-2xl border border-foyer-border bg-white p-2 shadow-[0_8px_28px_rgba(31,41,35,0.18)] ${
                  above ? "bottom-8" : "top-8"
                } ${h.cx < 18 ? "translate-x-[-30%]" : h.cx > 82 ? "translate-x-[-70%]" : ""}`}
              >
                <p className="mb-1.5 line-clamp-1 px-1 text-[12px] font-medium text-foyer-ink">{h.name}</p>
                {h.thumbs.length > 0 ? (
                  <div className={`grid gap-1.5 ${h.thumbs.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                    {h.thumbs.map((t) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={t.url}
                        src={t.url}
                        alt={t.alt}
                        loading="lazy"
                        className="aspect-square w-full rounded-lg border border-foyer-border/60 bg-foyer-cream object-cover"
                      />
                    ))}
                  </div>
                ) : (
                  <p className="px-1 pb-1 text-[11px] text-foyer-muted">Pas encore de propositions</p>
                )}
                {showModify && (
                  <Link
                    href={`/create/${projectId}/iterate?target=${encodeURIComponent(h.elementId)}&label=${encodeURIComponent(h.name)}`}
                    className="mt-2 flex h-8 items-center justify-center gap-1.5 rounded-full bg-foyer-sage text-[12px] font-medium text-white transition-opacity hover:opacity-90"
                  >
                    <Pencil className="size-3" aria-hidden />
                    Modifier ce meuble
                  </Link>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
