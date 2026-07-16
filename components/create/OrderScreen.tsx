"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, ShoppingBag, Store, Trash2 } from "lucide-react";

/**
 * COMMANDE CONSOLIDÉE — renaissance de l'écran de l'îlot Wizard-of-Oz (retiré le
 * 2026-07-04 avec les produits mockés), branché cette fois sur la VRAIE liste du
 * projet (demande Alexis 2026-07-16 : « Commander » doit re-router ici, avec une
 * poubelle par article pour sortir du panier ce qu'on ne veut pas).
 *
 * Les articles retirés sont persistés par projet (localStorage) : ils survivent
 * au va-et-vient /final ↔ commande, mais ne touchent PAS la shopping list du
 * projet — retirer du panier n'est pas retirer de la déco.
 */
export type OrderItem = {
  key: string; // id de ligne shopping (stable) — clé de la poubelle
  label: string; // catégorie lisible (« Canapé »)
  name: string;
  price: number | null;
  merchant: string;
  url: string | null;
  imgUrl: string | null;
  quantity: number;
};

const removedKey = (projectId: string) => `foyer-order-removed-${projectId}`;

export function OrderScreen({ projectId, items }: { projectId: string; items: OrderItem[] }) {
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(removedKey(projectId));
      if (raw) setRemoved(new Set(JSON.parse(raw) as string[]));
    } catch { /* défauts */ }
  }, [projectId]);

  const toggle = (key: string) =>
    setRemoved((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try { localStorage.setItem(removedKey(projectId), JSON.stringify([...next])); } catch { /* best-effort */ }
      return next;
    });

  const kept = useMemo(() => items.filter((it) => !removed.has(it.key)), [items, removed]);
  const groups = useMemo(() => {
    const map = new Map<string, OrderItem[]>();
    for (const it of kept) {
      const list = map.get(it.merchant) ?? [];
      list.push(it);
      map.set(it.merchant, list);
    }
    return [...map.entries()]
      .map(([merchant, list]) => ({
        merchant,
        list,
        subtotal: list.reduce((s, p) => s + (p.price ?? 0) * p.quantity, 0),
        sansPrix: list.filter((p) => p.price == null).length,
      }))
      .sort((a, b) => b.list.length - a.list.length);
  }, [kept]);
  const total = kept.reduce((s, p) => s + (p.price ?? 0) * p.quantity, 0);
  const sansPrix = kept.filter((p) => p.price == null).length;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[560px] bg-foyer-cream px-5 pb-32 pt-6">
      <Link
        href={`/create/${projectId}/final`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-foyer-muted transition-colors hover:text-foyer-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Retour à mon projet
      </Link>
      <h1 className="font-serif text-2xl text-foyer-ink">Ma commande</h1>
      <p className="mt-1 text-sm text-foyer-muted">
        {kept.length} article{kept.length !== 1 ? "s" : ""}, regroupés par enseigne — retirez ce que
        vous ne voulez pas commander.
      </p>

      {groups.map(({ merchant, list, subtotal, sansPrix: sp }) => (
        <section key={merchant} className="mt-6 rounded-xl border border-foyer-border bg-white">
          <header className="flex items-center justify-between border-b border-foyer-border px-4 py-3">
            <span className="flex items-center gap-2 font-medium text-foyer-ink">
              <Store className="size-4 text-foyer-sage" aria-hidden /> {merchant}
            </span>
            <span className="text-sm text-foyer-muted">
              {subtotal > 0 ? `${subtotal.toLocaleString("fr-FR")} €` : ""}
              {sp > 0 ? ` + ${sp} à sourcer` : ""}
            </span>
          </header>
          <ul>
            {list.map((it) => (
              <li key={it.key} className="flex items-center gap-3 border-b border-foyer-border/60 px-4 py-3 last:border-b-0">
                {it.imgUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.imgUrl} alt="" className="size-14 shrink-0 rounded-lg border border-foyer-border object-cover" />
                ) : (
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-foyer-border/40">
                    <ShoppingBag className="size-5 text-foyer-muted" aria-hidden />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-wide text-foyer-muted">
                    {it.label}
                    {it.quantity > 1 ? ` ×${it.quantity}` : ""}
                  </p>
                  <p className="truncate text-sm text-foyer-ink">{it.name}</p>
                  <p className="text-sm font-medium text-foyer-ink">
                    {it.price != null ? `${(it.price * it.quantity).toLocaleString("fr-FR")} €` : "Prix à confirmer"}
                  </p>
                </div>
                {it.url && (
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full p-2 text-foyer-sage transition-colors hover:bg-foyer-sage/10"
                    aria-label={`Ouvrir la page produit — ${it.name}`}
                  >
                    <ExternalLink className="size-4" aria-hidden />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => toggle(it.key)}
                  className="rounded-full p-2 text-foyer-muted transition-colors hover:bg-foyer-terra/10 hover:text-foyer-terra"
                  aria-label={`Retirer ${it.name} du panier`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {removed.size > 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-foyer-border px-4 py-3 text-sm text-foyer-muted">
          {removed.size} article{removed.size !== 1 ? "s" : ""} retiré{removed.size !== 1 ? "s" : ""} du panier —{" "}
          {items
            .filter((it) => removed.has(it.key))
            .map((it) => (
              <button
                key={it.key}
                type="button"
                onClick={() => toggle(it.key)}
                className="mr-2 underline decoration-dotted underline-offset-2 hover:text-foyer-ink"
              >
                remettre « {it.name.slice(0, 30)} »
              </button>
            ))}
        </div>
      )}

      {/* BARRE FLOTTANTE — total + ouverture des pages produit du panier. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-foyer-border bg-foyer-cream/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[560px] items-center justify-between gap-3">
          <div>
            <p className="text-xs text-foyer-muted">Total estimé</p>
            <p className="font-serif text-lg text-foyer-ink">
              {total.toLocaleString("fr-FR")} €{sansPrix > 0 ? ` + ${sansPrix} à sourcer` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              for (const it of kept) if (it.url) window.open(it.url, "_blank");
            }}
            className="flex h-11 items-center justify-center gap-2 rounded-full bg-foyer-sage px-6 font-medium text-white shadow-[0_2px_8px_rgba(107,142,111,0.35)] transition-all hover:-translate-y-0.5"
          >
            <ShoppingBag className="size-4" aria-hidden /> Ouvrir les pages produit
          </button>
        </div>
      </div>
    </div>
  );
}
