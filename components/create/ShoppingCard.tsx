"use client";

import { useState, useEffect } from "react";
import {
  Sofa, Table, CircleDot, LampFloor, Tv, Frame, Grid2x2, BookOpen, Shrub,
  PaintBucket, Package, Pencil, Check, ExternalLink, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShoppingItem, ShoppingSource, ProductMatch } from "@/lib/types";

const CATEGORY_ICON: Record<string, LucideIcon> = {
  sofa: Sofa, armchair: Sofa,
  table: Table, coffee_table: Table, side_table: Table, dining_table: Table,
  rug: CircleDot,
  lamp: LampFloor, floor_lamp: LampFloor,
  tv_stand: Tv,
  molding: Frame, mouldings: Frame, mirror: Frame,
  floor: Grid2x2,
  shelf: BookOpen, bookshelf: BookOpen,
  plant: Shrub,
  curtain: Package, cushion: Package, other: Package, dresser: Package, sideboard: Package,
  paint: PaintBucket,
};

const SOURCE_TAG: Record<ShoppingSource, { label: string; className: string }> = {
  reuse: { label: "Réutilisation", className: "bg-foyer-sage/15 text-foyer-sage" },
  diy:   { label: "Réutilisation", className: "bg-foyer-sage/15 text-foyer-sage" },
  secondhand: { label: "Seconde main", className: "bg-sky-100 text-sky-700" },
  new:   { label: "Neuf",            className: "bg-violet-100 text-violet-700" },
};

function SourceTag({ source }: { source: ShoppingSource }) {
  const t = SOURCE_TAG[source] ?? SOURCE_TAG.new;
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-medium", t.className)}>
      {t.label}
    </span>
  );
}

function matchSource(m: ProductMatch): ShoppingSource {
  return m.source_type === "secondhand" ? "secondhand" : "new";
}

// Affichage des blocs de DEBUG scoring uniquement si ?debug=1 dans l'URL (sinon masqué pour
// un visiteur normal / une démo). Lu après montage (client) → pas de mismatch d'hydratation.
export function useDebug(): boolean {
  const [debug, setDebug] = useState(false);
  useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).get("debug") === "1");
  }, []);
  return debug;
}

// ── Débogage scoring (/final) ────────────────────────────────────────────────
// Décompose le score final d'un produit : image / attributs / texte + leurs POIDS,
// puis le détail par attribut (valeur rendu vs produit, ✓/✗, poids). But : comprendre
// pourquoi un produit gagne (ex. une banquette qui bat le vrai canapé sur les attrs).
function fmt(n: number | null | undefined): string {
  return n == null ? "—" : n.toFixed(2);
}
function ScoreBreakdown({ m }: { m: ProductMatch }) {
  const wImg = m.imgWeight;                         // poids image effectif (w_eff)
  const wTxt = wImg != null ? 1 - wImg : undefined; // poids du terme attributs/texte
  const usesStruct = m.structScore != null;         // attrs comparés → terme = struct, sinon texte
  return (
    <div className="mt-1.5 rounded-md bg-foyer-cream/60 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-foyer-muted">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <span className="font-semibold text-foyer-ink">final {Math.round(m.similarity * 100)}%</span>
        <span>image {fmt(m.simImage)}{wImg != null && <span className="opacity-60"> ·w{Math.round(wImg * 100)}</span>}</span>
        <span>
          attrs {fmt(m.structScore)}
          {wTxt != null && usesStruct && <span className="opacity-60"> ·w{Math.round(wTxt * 100)}</span>}
        </span>
        <span>texte {fmt(m.simText)}{!usesStruct && wTxt != null && <span className="opacity-60"> ·w{Math.round(wTxt * 100)} (repli)</span>}</span>
        {m.colorDeltaE != null && <span>ΔE {m.colorDeltaE}</span>}
        {m.belowThreshold && <span className="rounded bg-amber-100 px-1 text-amber-700">confiance faible</span>}
      </div>
      {m.attrScores && m.attrScores.length > 0 && (
        <div className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-x-3 gap-y-0.5">
          {m.attrScores.map((a) => (
            <span
              key={a.key}
              className={cn(
                "whitespace-nowrap",
                !a.compared ? "opacity-40" : a.sim >= 0.5 ? "text-foyer-sage" : "text-rose-500",
              )}
            >
              <span className="opacity-60">{a.key}</span> {a.render ?? "?"}
              <span className="px-0.5">{a.compared ? (a.sim >= 0.99 ? "=" : a.sim > 0 ? "≈" : "≠") : "·"}</span>
              {a.product ?? "?"}<span className="opacity-50"> ·w{a.weight}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// En-tête debug AU NIVEAU DE L'ITEM : la règle de pondération de la catégorie (image vs
// attrs + image max) ET les attributs détectés sur le RENDU (le "target") avec leur poids.
// Permet de repérer une mauvaise extraction côté rendu (ex. legs_type mal lu) qui fausse le
// score de TOUS les produits de cet item.
function ItemScoringHeader({ item }: { item: ShoppingItem }) {
  const wr = item.weightRule;
  if (!wr) return null;
  const ea = (item.elementAttrs ?? {}) as Record<string, unknown>;
  return (
    <div className="mt-2 rounded-lg border border-dashed border-foyer-border bg-foyer-cream/40 px-3 py-2 font-mono text-[11px] leading-relaxed text-foyer-muted">
      <div className="font-semibold text-foyer-ink">
        Pondération {item.category} : image {Math.round(wr.imgW * 100)}% / attrs {Math.round((1 - wr.imgW) * 100)}%
        <span className="font-normal opacity-60"> (image max {Math.round(wr.imgWMax * 100)}% si peu d&apos;attrs)</span>
      </div>
      <div className="mt-1">
        <span className="opacity-60">Attributs du rendu (cible) — poids&nbsp;:</span>
        <div className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-3 gap-y-0.5">
          {Object.entries(wr.attrWeights).map(([k, w]) => {
            const v = ea[k];
            const bad = v == null || v === "unknown" || v === "n/a" || v === "";
            return (
              <span key={k} className={cn(bad && "text-amber-600")}>
                <span className="opacity-60">{k}</span> {bad ? "—" : String(v)}
                <span className="opacity-50"> ·w{w}</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Miniature + agrandissement au survol.
function Thumb({ url, alt, fallback }: { url: string | null; alt: string; fallback: LucideIcon }) {
  const [err, setErr] = useState(false);
  const Fallback = fallback;
  if (!url || err) {
    return (
      <div className="flex size-20 shrink-0 items-center justify-center rounded-xl border border-foyer-border bg-foyer-cream">
        <Fallback className="size-7 text-foyer-muted" strokeWidth={1.5} aria-hidden />
      </div>
    );
  }
  return (
    <div className="group relative size-20 shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} onError={() => setErr(true)}
        className="size-full rounded-xl border border-foyer-border object-cover" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" aria-hidden
        className="pointer-events-none absolute left-0 top-0 z-30 hidden size-52 rounded-xl border border-foyer-border bg-white object-contain shadow-xl group-hover:block" />
    </div>
  );
}

export function ShoppingCard({ item }: { item: ShoppingItem }) {
  const [open, setOpen] = useState(false);
  const [selIdx, setSelIdx] = useState(0);
  const debug = useDebug();

  const Icon = CATEGORY_ICON[item.category] ?? Package;
  const matches = item.matches ?? [];
  const best = matches[selIdx];

  return (
    <div className="rounded-2xl border border-foyer-border bg-white p-3">
      {best ? (
        <div className="flex items-center gap-4">
          <Thumb url={best.primary_image_url} alt={best.name} fallback={Icon} />

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="line-clamp-2 text-[15px] font-medium text-foyer-ink">{best.name}</p>
            <div className="flex flex-wrap items-center gap-2">
              <SourceTag source={matchSource(best)} />
              <span className="text-[13px] text-foyer-muted">{best.merchant}</span>
              <span className="rounded-full bg-foyer-sage/10 px-1.5 py-0.5 text-[11px] font-medium text-foyer-sage">
                {Math.round(best.similarity * 100)}%
              </span>
            </div>
            {debug && <ScoreBreakdown m={best} />}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className="font-serif text-[17px] text-foyer-ink">
              {best.price != null ? `${best.price} €` : "–"}
            </span>
            <div className="flex items-center gap-1.5">
              {best.product_url && (
                <a href={best.product_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 rounded-full border border-foyer-border px-2.5 py-1 text-[13px] text-foyer-ink transition-colors hover:bg-foyer-cream">
                  <ExternalLink className="size-3" aria-hidden />Voir
                </a>
              )}
              {matches.length > 1 && (
                <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
                  className={cn("flex items-center gap-1 rounded-full border px-2.5 py-1 text-[13px] transition-colors",
                    open ? "border-foyer-ink text-foyer-ink" : "border-foyer-border text-foyer-muted hover:text-foyer-ink")}>
                  <Pencil className="size-3" aria-hidden />Modifier
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        // Aucun match au-dessus du seuil → à sourcer.
        <div className="flex items-center gap-4">
          <Thumb url={null} alt={item.name} fallback={Icon} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="line-clamp-2 text-[15px] font-medium text-foyer-ink">{item.name}</p>
            <span className="text-[13px] text-foyer-muted">À sourcer</span>
          </div>
        </div>
      )}

      {/* Alternatives (top 2-4) */}
      {open && matches.length > 1 && (
        <div className="mt-3 border-t border-foyer-border pt-3">
          <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-foyer-muted">
            Autres produits
          </p>
          <ul className="flex flex-col gap-2">
            {matches.map((m, i) => (
              <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-foyer-border p-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Thumb url={m.primary_image_url} alt={m.name} fallback={Icon} />
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="line-clamp-2 text-[14px] text-foyer-ink">{m.name}</span>
                    <div className="flex items-center gap-2">
                      <SourceTag source={matchSource(m)} />
                      <span className="text-[12px] text-foyer-muted">{m.merchant} · {Math.round(m.similarity * 100)}%</span>
                    </div>
                    {debug && <ScoreBreakdown m={m} />}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[14px] text-foyer-ink">{m.price != null ? `${m.price} €` : "–"}</span>
                  <button type="button" disabled={i === selIdx} onClick={() => { setSelIdx(i); setOpen(false); }}
                    className={cn("flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-medium transition-colors",
                      i === selIdx ? "cursor-default bg-foyer-sage/15 text-foyer-sage" : "bg-foyer-sage text-white hover:bg-foyer-sage/90")}>
                    {i === selIdx ? <><Check className="size-3.5" aria-hidden />Choisi</> : "Choisir"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* PEINTURE : couleur du mur détectée dans le rendu (même quand "à sourcer"). */}
      {item.targetHex && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-foyer-muted">
          Couleur détectée&nbsp;:
          <span
            className="inline-block size-3.5 rounded border border-foyer-border"
            style={{ backgroundColor: item.targetHex }}
            aria-hidden
          />
          <span className="font-mono text-foyer-ink">{item.targetHex}</span>
        </p>
      )}

      {/* Raw audit (mode test) — pour repérer un élément détecté mais non/mal matché. */}
      <p className="mt-2 text-[11px] text-foyer-muted/80">
        Détecté&nbsp;: <span className="font-medium">{item.name}</span> · {item.category}
        {(item.quantity ?? 1) > 1 ? ` ×${item.quantity}` : ""}
      </p>

      {/* Règle de pondération + attributs du rendu (debug scoring, ?debug=1). */}
      {debug && <ItemScoringHeader item={item} />}
    </div>
  );
}
