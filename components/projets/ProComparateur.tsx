"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
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

  if (piece.affichage === "diaporama") return <Diaporama piece={piece} />;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {piece.variantes.map((v, i) => (
        <CarteProjet
          key={v.projectId}
          variante={v}
          eyebrow={`${piece.label} ${i + 1}`}
        />
      ))}
    </div>
  );
}

/**
 * Diaporama cyclique : le projet courant en grand, ses deux voisins réduits de part et
 * d'autre — celui d'avant à gauche, celui d'après à droite — en visuel seul. Au-delà du
 * dernier on revient au premier, et inversement.
 */
function Diaporama({ piece }: { piece: PieceVue }) {
  const n = piece.variantes.length;
  const [i, setI] = useState(piece.depart);
  // Sens du dernier déplacement : il décide du côté d'où les cartes pivotent.
  const [sens, setSens] = useState(1);

  // Le modulo positif : (-1 % 5) vaut -1 en JS, ce qui sortirait du tableau au premier
  // clic vers la gauche.
  const at = (k: number) => ((k % n) + n) % n;
  const aller = (pas: number) => {
    setSens(pas >= 0 ? 1 : -1);
    setI((k) => at(k + pas));
  };
  const allerA = (k: number) => {
    setSens(k >= at(i) ? 1 : -1);
    setI(k);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") aller(-1);
      if (e.key === "ArrowRight") aller(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  const courant = piece.variantes[at(i)];
  const avant = piece.variantes[at(i - 1)];
  const apres = piece.variantes[at(i + 1)];

  // On avance → les cartes entrent par la droite, et inversement.
  const tourniquet = sens > 0 ? "tourniquet-droite" : "tourniquet-gauche";

  return (
    <div>
      <div className="relative flex items-start justify-center">
        {/* Voisins : encart beige (nom du style + visuel), glissé SOUS la carte centrale —
            c'est ce chevauchement qui fait lire un diaporama plutôt que trois cartes.
            Masqués sous lg : la carte centrale y prend toute la largeur. */}
        {/* `key` = l'identité de la carte : sans lui React réutilise le nœud et
            l'animation ne rejouerait pas d'un style à l'autre. */}
        <Apercu
          key={`g-${avant.projectId}`}
          variante={avant}
          cote="gauche"
          onClick={() => aller(-1)}
          animation={tourniquet}
        />

        {/* z-10 : la carte courante passe PAR-DESSUS les aperçus. */}
        <div key={courant.projectId} className={`relative z-10 w-full max-w-xl ${tourniquet}`}>
          <CarteProjet
            variante={courant}
            eyebrow={`${piece.label} — ${at(i) + 1} / ${n}`}
          />
        </div>

        <Apercu
          key={`d-${apres.projectId}`}
          variante={apres}
          cote="droite"
          onClick={() => aller(1)}
          animation={tourniquet}
        />

        {/* Flèches rondes, alignées sur le visuel des aperçus. */}
        <BoutonNav direction="gauche" onClick={() => aller(-1)} flottant />
        <BoutonNav direction="droite" onClick={() => aller(1)} flottant />
      </div>

      {/* Pastilles. Les flèches y reviennent sous lg, où les flottantes sont masquées :
          sans elles il ne resterait plus rien pour naviguer. */}
      <div className="mt-6 flex items-center justify-center gap-4">
        <span className="lg:hidden">
          <BoutonNav direction="gauche" onClick={() => aller(-1)} />
        </span>
        <div className="flex gap-1.5">
          {piece.variantes.map((v, k) => (
            <button
              key={v.projectId}
              aria-label={`Aller à ${v.style}`}
              aria-current={k === at(i)}
              onClick={() => allerA(k)}
              className={[
                "h-1.5 rounded-full transition-all",
                k === at(i) ? "w-6 bg-foyer-ink" : "w-1.5 bg-foyer-border hover:bg-foyer-muted",
              ].join(" ")}
            />
          ))}
        </div>
        <span className="lg:hidden">
          <BoutonNav direction="droite" onClick={() => aller(1)} />
        </span>
      </div>
    </div>
  );
}

function Apercu({
  variante,
  cote,
  onClick,
  animation,
}: {
  variante: VarianteVue;
  cote: "gauche" | "droite";
  onClick: () => void;
  animation: string;
}) {
  if (!variante.renderUrl) return null;

  return (
    <button
      onClick={onClick}
      aria-label={`Voir ${variante.style}`}
      className={[
        // top-[132px] : cale le visuel de l'aperçu sur celui de la carte centrale, qui
        // commence sous son bandeau (surtitre + nom du style).
        "absolute top-[132px] z-0 hidden w-[27%] rounded-2xl border border-foyer-border",
        "bg-[#f2ebdf] p-3 shadow-sm lg:block",
        "opacity-80 hover:opacity-100",
        // L'aperçu (z-0) passe SOUS la carte centrale (z-10) sur ~40 % de sa largeur :
        // la carte fait 576px centrée, donc son bord tombe à ~24 % du rail ; en calant
        // l'aperçu (27 % de large) à 8 %, il en disparaît un gros tiers. C'est ce
        // recouvrement franc qui donne l'effet de découverte.
        cote === "gauche" ? "left-[8%]" : "right-[8%]",
        animation,
      ].join(" ")}
    >
      {/* Le nom se cale du côté VISIBLE : c'est le bord intérieur de l'aperçu qui passe
          sous la carte centrale, et un libellé aligné à gauche s'y ferait couper. */}
      <p
        className={[
          "mb-2 truncate px-1 font-serif text-[16px] text-foyer-ink",
          cote === "gauche" ? "text-left" : "text-right",
        ].join(" ")}
      >
        {variante.style}
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={variante.renderUrl}
        alt=""
        className="aspect-[4/3] w-full rounded-xl object-cover"
      />
    </button>
  );
}

function BoutonNav({
  direction,
  onClick,
  flottant = false,
}: {
  direction: "gauche" | "droite";
  onClick: () => void;
  /** Posé sur les côtés, à hauteur du visuel central, au-dessus des aperçus. */
  flottant?: boolean;
}) {
  const Icone = direction === "gauche" ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      aria-label={direction === "gauche" ? "Style précédent" : "Style suivant"}
      className={[
        "flex h-11 w-11 items-center justify-center rounded-full border border-foyer-border",
        "bg-white text-foyer-ink shadow-sm transition-colors hover:bg-foyer-ink hover:text-foyer-cream",
        flottant
          ? // Alignée sur le VISUEL de l'aperçu, pas sur la carte centrale : l'aperçu
            // démarre à 132px, son image sous 12px de marge + le nom du style (~32px),
            // et fait ~207px de haut → centre à ~284px, moins la moitié du bouton (22px).
            // z-20 : au-dessus des aperçus ET de la carte centrale, sinon la flèche
            // disparaîtrait sous l'un ou l'autre.
            `absolute top-[262px] z-20 hidden lg:flex ${direction === "gauche" ? "left-[2%]" : "right-[2%]"}`
          : "",
      ].join(" ")}
    >
      <Icone className="h-5 w-5" />
    </button>
  );
}

function CarteProjet({ variante, eyebrow }: { variante: VarianteVue; eyebrow: string }) {
  const { style, renderUrl, items, total, sansPrix, projectId, listePrete } = variante;

  return (
    <section className="flex h-full flex-col rounded-3xl border border-foyer-border bg-white p-5">
      {/* 1 — le style */}
      <div className="mb-4">
        <p className="text-[12px] uppercase tracking-[0.18em] text-foyer-muted">{eyebrow}</p>
        <h2 className="mt-0.5 font-serif text-2xl text-foyer-ink">{style}</h2>
      </div>

      {/* 2 — le visuel */}
      <div className="overflow-hidden rounded-2xl bg-foyer-cream">
        {renderUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={renderUrl}
            alt={`${eyebrow} — style ${style}`}
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
