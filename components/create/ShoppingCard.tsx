"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Sofa, Table, CircleDot, LampFloor, Tv, Frame, Grid2x2, BookOpen, Shrub,
  PaintBucket, Package, Pencil, Check, ExternalLink, X, Sparkles, Loader2, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShoppingItem, ShoppingSource, ProductMatch, CustomProduct } from "@/lib/types";
import { useExpertOverrides, affectsRender } from "@/components/create/expertOverrides";
import { CustomRefInput } from "@/components/create/CustomRefInput";

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
      {m.attrScores && m.attrScores.length > 0 ? (
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
      ) : (
        // Aucun attribut comparé = le PRODUIT n'est pas taggé (les ~8 000 du catalogue
        // sans metadata.attrs). Conséquence NON évidente : le score devient l'image PURE
        // (partnerMatch : coverage 0 → similarity = simImage) — le produit échappe donc à
        // tout contrôle de forme/matière et peut gagner sur un simple beau packshot.
        // On l'affiche au lieu de laisser un vide qui se lit comme « rien à signaler ».
        <div className="mt-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700">
          produit sans attributs → scoré à l&apos;IMAGE SEULE (aucun contrôle forme/matière)
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
  // PEINTURE : le seul « attribut » qui compte est la COULEUR CIBLE — la grille
  // d'attrs générique est du bruit ici (demande Alexis 2026-07-16). Hex cible en
  // clair + swatch ; le ΔE par pot est déjà dans le ScoreBreakdown de chaque match.
  if (item.category === "paint" || (item.targetHex && !wr)) {
    if (!item.targetHex) return null;
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-foyer-border bg-foyer-cream/40 px-3 py-2 font-mono text-[11px] text-foyer-muted">
        <span className="font-semibold text-foyer-ink">Hex cible (mesuré sur le rendu, hors ombres)</span>
        <span
          className="inline-block size-4 rounded border border-foyer-border"
          style={{ backgroundColor: item.targetHex }}
          aria-hidden
        />
        <span className="text-foyer-ink">{item.targetHex}</span>
      </div>
    );
  }
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

// L'id projet se lit dans l'URL (/create/<id>/final) : la carte est cliente et
// n'a pas besoin d'un prop drilling pour un identifiant déjà dans l'adresse.
function projectIdFromPath(): string | null {
  const seg = window.location.pathname.split("/");
  const i = seg.indexOf("create");
  return i >= 0 && seg[i + 1] ? seg[i + 1] : null;
}

export function ShoppingCard({ item }: { item: ShoppingItem }) {
  const [open, setOpen] = useState(false);
  const [localSelIdx, setLocalSelIdx] = useState(0);
  // « Intégrer ce meuble » (flux gratuit) : swap NB2 du produit choisi dans le rendu.
  const [integrating, setIntegrating] = useState(false);
  // « Modifier la couleur » (ligne peinture) : sélecteur de teinte → itération murs.
  const [colorOpen, setColorOpen] = useState(false);
  const [colorVal, setColorVal] = useState<string | null>(null);
  const debug = useDebug();

  // Rendu expert : la sélection d'un produit alternatif est CONTRÔLÉE par le
  // contexte (pour accumuler les modifs → un seul re-render). Sinon locale/visuelle.
  const ov = useExpertOverrides();
  const controlled = !!ov?.enabled && affectsRender(item);
  const selIdx = controlled ? (ov!.selected[item.elementId!] ?? 0) : localSelIdx;
  // Produit sur-mesure choisi par l'user (URL/JPEG) → prioritaire à l'affichage.
  const customPick = controlled && item.elementId ? ov!.custom[item.elementId] : undefined;
  const choose = (i: number) => {
    if (controlled) { ov!.choose(item.elementId!, i); ov!.setCustom(item.elementId!, null); }
    else setLocalSelIdx(i);
    setOpen(false);
  };
  const pickCustom = (cp: CustomProduct) => { if (controlled) { ov!.setCustom(item.elementId!, cp); setOpen(false); } };

  // Feature offerte au flux GRATUIT (demande Alexis 2026-07-16) : incruster le produit
  // affiché dans le rendu, façon expert — un élément par geste, une passe NB2.
  async function integrer(product: ProductMatch) {
    const projectId = projectIdFromPath();
    if (!projectId || !item.elementId || integrating) return;
    setIntegrating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/integrate-piece`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elementId: item.elementId, productId: product.id }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? "L'intégration a échoué. Réessayez.");
        setIntegrating(false);
        return;
      }
      toast.success("Meuble intégré — le rendu et la liste se mettent à jour.");
      window.location.reload();
    } catch {
      toast.error("L'intégration a échoué. Réessayez.");
      setIntegrating(false);
    }
  }

  // Ligne PEINTURE : plus d'alternatives de pots au CTA — le client choisit une
  // TEINTE, le rendu est repeint (itération murs) et le pot re-matché derrière.
  async function appliquerCouleur() {
    const projectId = projectIdFromPath();
    const hex = colorVal ?? item.targetHex;
    if (!projectId || !hex || integrating) return;
    setIntegrating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/iterate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userRequest: `Repeindre les murs en ${hex} — peinture OPAQUE, TOUS les pans peints de ce pot dans cette même teinte, aucun pan oublié. Ne rien changer d'autre.`,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? "Le changement de couleur a échoué. Réessayez.");
        setIntegrating(false);
        return;
      }
      toast.success("Couleur appliquée — le rendu se met à jour.");
      window.location.reload();
    } catch {
      toast.error("Le changement de couleur a échoué. Réessayez.");
      setIntegrating(false);
    }
  }

  const estPeinture = item.category === "paint";
  // Pendant l'intégration/repeinte (~20-40 s + reload), un spinner sur le seul CTA
  // se perdait dans la page — voile PLEIN ÉCRAN pour dire clairement que ça
  // travaille (QA Alexis 2026-07-17).
  const voileIntegration = integrating ? (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-foyer-ink/60 backdrop-blur-sm">
      <Loader2 className="size-9 animate-spin text-white" aria-hidden />
      <div className="px-8 text-center">
        <p className="font-medium text-white">
          {estPeinture ? "Nouvelle couleur en cours d'application…" : "Intégration du meuble dans votre rendu…"}
        </p>
        <p className="mt-1 text-[13px] text-white/80">Comptez 20 à 40 secondes — la page se rechargera toute seule.</p>
      </div>
    </div>
  ) : null;
  // Intégrable : flux gratuit uniquement (l'expert a son flux d'overrides groupés),
  // un vrai meuble matché relié à un élément du rendu.
  const canIntegrate = !controlled && !estPeinture && !!item.elementId && item.source !== "diy";

  const Icon = CATEGORY_ICON[item.category] ?? Package;
  const matches = item.matches ?? [];
  const best = matches[selIdx];
  const canModify = controlled || matches.length > 1;

  return (
    <div className="rounded-2xl border border-foyer-border bg-white p-3">
      {voileIntegration}
      {customPick ? (
        <div className="flex items-center gap-4">
          <Thumb url={customPick.imageUrl} alt={customPick.name ?? "Votre référence"} fallback={Icon} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="line-clamp-2 text-[15px] font-medium text-foyer-ink">{customPick.name ?? "Votre référence"}</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-foyer-sage/15 px-2 py-0.5 text-[11px] font-medium text-foyer-sage">Votre référence</span>
              {customPick.merchant && <span className="text-[13px] text-foyer-muted">{customPick.merchant}</span>}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className="font-serif text-[17px] text-foyer-ink">{customPick.price != null ? `${customPick.price} €` : "–"}</span>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => ov!.setCustom(item.elementId!, null)} title="Retirer"
                className="flex items-center gap-1 rounded-full border border-foyer-border px-2.5 py-1 text-[13px] text-foyer-muted transition-colors hover:text-foyer-ink">
                <X className="size-3" aria-hidden />Retirer
              </button>
              <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
                className={cn("flex items-center gap-1 rounded-full border px-2.5 py-1 text-[13px] transition-colors",
                  open ? "border-foyer-ink text-foyer-ink" : "border-foyer-border text-foyer-muted hover:text-foyer-ink")}>
                <Pencil className="size-3" aria-hidden />Modifier
              </button>
            </div>
          </div>
        </div>
      ) : best ? (
        // Prix à droite du produit, ACTIONS sur leur propre ligne pleine largeur
        // (flex-wrap) : l'ancienne colonne de droite (prix + 3 CTA en ligne, shrink-0)
        // faisait ~350 px à elle seule et explosait la carte sur téléphone
        // (responsive « ne va pas du tout », QA Alexis 2026-07-17).
        <div>
          <div className="flex items-start gap-3">
            <Thumb url={best.primary_image_url} alt={best.name} fallback={Icon} />

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="line-clamp-2 text-[15px] font-medium text-foyer-ink">{best.name}</p>
              <div className="flex flex-wrap items-center gap-2">
                <SourceTag source={matchSource(best)} />
                <span className="text-[13px] text-foyer-muted">{best.merchant}</span>
                {/* % de similarité = outil de réglage, pas une info user (retiré de la
                    vue publique, QA Alexis 2026-07-17) — visible avec ?debug=1. */}
                {debug && (
                  <span className="rounded-full bg-foyer-sage/10 px-1.5 py-0.5 text-[11px] font-medium text-foyer-sage">
                    {Math.round(best.similarity * 100)}%
                  </span>
                )}
              </div>
              {debug && <ScoreBreakdown m={best} />}
            </div>

            <span className="shrink-0 font-serif text-[17px] text-foyer-ink">
              {best.price != null ? `${best.price} €` : "–"}
            </span>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center justify-end gap-1.5">
              {best.product_url && (
                <a href={best.product_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 rounded-full border border-foyer-border px-2.5 py-1 text-[13px] text-foyer-ink transition-colors hover:bg-foyer-cream">
                  <ExternalLink className="size-3" aria-hidden />Voir
                </a>
              )}
              {estPeinture && !controlled ? (
                // Peinture : plus d'alternatives de pots au CTA (demande Alexis
                // 2026-07-16) — le client choisit une TEINTE, le rendu suit.
                <button type="button" onClick={() => setColorOpen((o) => !o)} aria-expanded={colorOpen}
                  disabled={integrating}
                  className={cn("flex items-center gap-1 rounded-full border px-2.5 py-1 text-[13px] transition-colors",
                    colorOpen ? "border-foyer-ink text-foyer-ink" : "border-foyer-border text-foyer-muted hover:text-foyer-ink")}>
                  <PaintBucket className="size-3" aria-hidden />Modifier la couleur
                </button>
              ) : canModify ? (
                <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
                  className={cn("flex items-center gap-1 rounded-full border px-2.5 py-1 text-[13px] transition-colors",
                    open ? "border-foyer-ink text-foyer-ink" : "border-foyer-border text-foyer-muted hover:text-foyer-ink")}>
                  <Pencil className="size-3" aria-hidden />Modifier
                </button>
              ) : null}
              {canIntegrate && (
                // Avant-goût du mode expert offert au flux gratuit : le produit
                // affiché est INCRUSTÉ dans le rendu (1 passe NB2).
                <button type="button" onClick={() => integrer(best)} disabled={integrating}
                  className="flex items-center gap-1 rounded-full bg-foyer-sage px-2.5 py-1 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60">
                  {integrating ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <Sparkles className="size-3" aria-hidden />}
                  Intégrer ce meuble
                  <span className="ml-0.5 text-[10px] uppercase tracking-wide bg-white/20 px-1.5 py-0.5 rounded-full">
                    Payant
                  </span>
                </button>
              )}
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
          {controlled && (
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
              className={cn("flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[13px] transition-colors",
                open ? "border-foyer-ink text-foyer-ink" : "border-foyer-border text-foyer-muted hover:text-foyer-ink")}>
              <Pencil className="size-3" aria-hidden />Indiquer
            </button>
          )}
        </div>
      )}

      {/* Panneau PEINTURE : choix d'une nouvelle teinte → itération murs. */}
      {colorOpen && estPeinture && (
        <div className="mt-3 flex items-center gap-3 border-t border-foyer-border pt-3">
          <input
            type="color"
            value={colorVal ?? item.targetHex ?? "#c58160"}
            onChange={(e) => setColorVal(e.target.value)}
            aria-label="Nouvelle couleur des murs"
            className="size-9 cursor-pointer rounded-lg border border-foyer-border bg-white p-1"
          />
          <span className="font-mono text-[13px] text-foyer-ink">{colorVal ?? item.targetHex ?? ""}</span>
          <button type="button" onClick={appliquerCouleur} disabled={integrating || !(colorVal ?? item.targetHex)}
            className="ml-auto flex items-center gap-1 rounded-full bg-foyer-sage px-3 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60">
            {integrating ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <Check className="size-3" aria-hidden />}
            Appliquer cette couleur
          </button>
        </div>
      )}

      {/* Panneau : produit sur-mesure (URL/JPEG) + alternatives matchées */}
      {open && !estPeinture && (controlled || matches.length > 1) && (
        <div className="mt-3 border-t border-foyer-border pt-3">
          {controlled && <CustomRefInput onPicked={pickCustom} />}
          {matches.length > 1 && (
          <>
          <p className="mb-2 mt-3 text-[12px] font-medium uppercase tracking-[0.08em] text-foyer-muted">
            Ou choisir un autre produit
          </p>
          <ul className="flex flex-col gap-2">
            {/* Le choix actuel (selIdx) est déjà affiché en haut de la carte — pas besoin
                de le re-lister ici (demande Alexis 2026-07-16). */}
            {matches.map((m, i) => i === selIdx ? null : (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-foyer-border p-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Thumb url={m.primary_image_url} alt={m.name} fallback={Icon} />
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="line-clamp-2 text-[14px] text-foyer-ink">{m.name}</span>
                    <div className="flex items-center gap-2">
                      <SourceTag source={matchSource(m)} />
                      <span className="text-[12px] text-foyer-muted">
                        {m.merchant}
                        {debug ? ` · ${Math.round(m.similarity * 100)}%` : ""}
                      </span>
                    </div>
                    {debug && <ScoreBreakdown m={m} />}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-[14px] text-foyer-ink">{m.price != null ? `${m.price} €` : "–"}</span>
                  {m.product_url && (
                    <a href={m.product_url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 rounded-full border border-foyer-border px-2.5 py-1 text-[13px] text-foyer-ink transition-colors hover:bg-foyer-cream">
                      <ExternalLink className="size-3" aria-hidden />Voir
                    </a>
                  )}
                  {canIntegrate && (
                    <button type="button" onClick={() => integrer(m)} disabled={integrating}
                      className="flex items-center gap-1 rounded-full bg-foyer-sage px-2.5 py-1 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60">
                      {integrating ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <Sparkles className="size-3" aria-hidden />}
                      Intégrer ce meuble
                      <span className="ml-0.5 text-[10px] uppercase tracking-wide bg-white/20 px-1.5 py-0.5 rounded-full">
                        Payant
                      </span>
                    </button>
                  )}
                  <button type="button" onClick={() => choose(i)}
                    className="flex items-center gap-1 rounded-full bg-foyer-sage/15 px-3 py-1 text-[13px] font-medium text-foyer-sage transition-colors hover:bg-foyer-sage/25">
                    Choisir
                  </button>
                </div>
              </li>
            ))}
          </ul>
          </>
          )}
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

      {/* Raw audit — debug uniquement (?debug=1) : « Détecté : … » parlait aux
          réglages, pas aux utilisateurs (QA Alexis 2026-07-17). */}
      {debug && (
        <p className="mt-2 text-[11px] text-foyer-muted/80">
          Détecté&nbsp;: <span className="font-medium">{item.name}</span> · {item.category}
          {(item.quantity ?? 1) > 1 ? ` ×${item.quantity}` : ""}
        </p>
      )}

      {/* Règle de pondération + attributs du rendu (debug scoring, ?debug=1). */}
      {debug && <ItemScoringHeader item={item} />}
    </div>
  );
}
