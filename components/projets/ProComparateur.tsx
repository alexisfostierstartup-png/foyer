"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Pencil } from "lucide-react";
import type { DossierProVue, PieceVue, VarianteVue } from "@/lib/projetsPro";

const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;

const SOURCE_LABEL: Record<string, string> = {
  secondhand: "Seconde main",
  diy: "Fourniture",
};

export function ProComparateur({ dossier }: { dossier: DossierProVue }) {
  const [pieceActive, setPieceActive] = useState(dossier.pieces[0]?.slug ?? "");
  const piece = dossier.pieces.find((p) => p.slug === pieceActive) ?? dossier.pieces[0];

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <header className="mb-8">
        <p className="text-[12px] uppercase tracking-[0.18em] text-foyer-muted">Dossier client</p>
        <h1 className="mt-1 font-serif text-4xl text-foyer-ink">{dossier.nom}</h1>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-foyer-muted">
          {dossier.sousTitre}
        </p>
      </header>

      {/* Onglets de pièce */}
      <div
        role="tablist"
        aria-label="Pièces du dossier"
        className="mb-8 flex flex-wrap gap-2 border-b border-foyer-border pb-3"
      >
        {dossier.pieces.map((p) => {
          const actif = p.slug === piece?.slug;
          return (
            <button
              key={p.slug}
              role="tab"
              aria-selected={actif}
              onClick={() => setPieceActive(p.slug)}
              className={[
                "rounded-full px-4 py-2 text-[14px] transition-colors",
                actif
                  ? "bg-foyer-ink text-foyer-cream"
                  : "text-foyer-muted hover:bg-foyer-border/40 hover:text-foyer-ink",
              ].join(" ")}
            >
              {p.label}
              {p.variantes.length === 0 && (
                <span className="ml-1.5 text-[12px] opacity-60">à venir</span>
              )}
            </button>
          );
        })}
      </div>

      {piece && <PieceVueBloc piece={piece} />}
    </div>
  );
}

function PieceVueBloc({ piece }: { piece: PieceVue }) {
  if (piece.variantes.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-foyer-border bg-white/50 px-6 py-16 text-center">
        <p className="font-serif text-xl text-foyer-ink">{piece.label} — à venir</p>
        <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-foyer-muted">
          Aucune direction n&apos;a encore été travaillée pour cette pièce.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {piece.variantes.map((v, i) => (
        <ColonneProjet key={v.projectId} variante={v} rang={i + 1} piece={piece.label} />
      ))}
    </div>
  );
}

function ColonneProjet({
  variante,
  rang,
  piece,
}: {
  variante: VarianteVue;
  rang: number;
  piece: string;
}) {
  const { style, renderUrl, items, total, sansPrix, projectId, listePrete } = variante;

  return (
    <section className="flex flex-col rounded-3xl border border-foyer-border bg-white p-5">
      {/* 1 — le style */}
      <div className="mb-4">
        <p className="text-[12px] uppercase tracking-[0.18em] text-foyer-muted">
          {piece} {rang}
        </p>
        <h2 className="mt-0.5 font-serif text-2xl text-foyer-ink">{style}</h2>
      </div>

      {/* 2 — le visuel */}
      <div className="overflow-hidden rounded-2xl bg-foyer-cream">
        {renderUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={renderUrl}
            alt={`${piece} — style ${style}`}
            className="aspect-[4/3] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center text-[13px] text-foyer-muted">
            Rendu en cours
          </div>
        )}
      </div>

      {/* 3 — la liste de courses */}
      <div className="mt-5 flex-1">
        <h3 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-foyer-muted">
          Liste de courses
        </h3>

        {!listePrete ? (
          <p className="rounded-xl bg-foyer-cream px-4 py-6 text-center text-[13px] text-foyer-muted">
            La liste n&apos;a pas encore été calculée pour ce rendu.
          </p>
        ) : (
          <ul className="divide-y divide-foyer-border/70">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-3 py-2.5">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-foyer-cream">
                  {it.product?.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={it.product.imageUrl}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] text-foyer-ink">
                    {it.product?.name ?? it.detected}
                  </p>
                  <p className="truncate text-[12px] text-foyer-muted">
                    {[
                      it.product?.merchant,
                      SOURCE_LABEL[it.source],
                      it.quantity > 1 ? `${it.quantity} ×` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || it.detected}
                  </p>
                </div>

                <span className="shrink-0 text-[14px] tabular-nums text-foyer-ink">
                  {typeof it.product?.price === "number" ? (
                    eur(it.product.price * it.quantity)
                  ) : (
                    <span className="text-[12px] text-foyer-muted">À sourcer</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 4 — le total */}
      <div className="mt-5 rounded-2xl bg-foyer-cream px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[14px] text-foyer-muted">
            Total — {items.length} article{items.length > 1 ? "s" : ""}
          </span>
          <span className="font-serif text-2xl text-foyer-ink">{eur(total)}</span>
        </div>
        {sansPrix > 0 && (
          <p className="mt-1 text-[12px] text-foyer-muted">
            dont {sansPrix} à sourcer, non compté{sansPrix > 1 ? "s" : ""} dans le total
          </p>
        )}
      </div>

      {/* 5 — le CTA */}
      <Link
        href={`/create/${projectId}/final`}
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-foyer-ink px-5 py-3 text-[14px] font-medium text-foyer-cream transition-opacity hover:opacity-90"
      >
        <Pencil className="h-4 w-4" />
        Modifier ce projet
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
