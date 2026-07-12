"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ChevronLeft, ChevronRight, Loader2, Pencil } from "lucide-react";
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
 * Diaporama cyclique — un vrai tourniquet.
 *
 * Les cinq cartes sont montées EN PERMANENCE et ne changent jamais d'identité : seul
 * leur `transform` bouge quand l'index change. C'est ce qui fait qu'une carte latérale
 * VOYAGE physiquement jusqu'au centre, au lieu d'apparaître en fondu à sa place (ce que
 * faisait la version précédente, d'où l'effet de clignotement).
 *
 * Trois positions : centre (échelle 1, blanc, contenu complet), voisins (réduits, beiges,
 * glissés sous la carte centrale) et les autres, poussés dehors et transparents — ce sont
 * eux qui entrent en scène au coup suivant.
 */
function Diaporama({ piece }: { piece: PieceVue }) {
  const n = piece.variantes.length;
  const [i, setI] = useState(piece.depart);

  // Modulo positif : (-1 % 5) vaut -1 en JS, ce qui sortirait du tableau au premier
  // clic vers la gauche.
  const at = (k: number) => ((k % n) + n) % n;
  const aller = (pas: number) => setI((k) => at(k + pas));

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

  /** Distance CYCLIQUE à la carte courante : -2..+2 pour cinq cartes. */
  const ecart = (k: number) => {
    let d = k - at(i);
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    return d;
  };

  return (
    <div>
      <div className="relative">
        {/* Le rail. Hauteur fixe : les cartes sont en absolu, elles ne la portent pas. */}
        <div className="relative mx-auto h-[500px] w-full max-w-xl">
          {piece.variantes.map((v, k) => {
            const d = ecart(k);
            const actif = d === 0;
            const voisin = Math.abs(d) === 1;

            // Un voisin est décalé de 55 % de sa largeur et réduit à 0,52 : il finit
            // recouvert sur ~40 % par la carte centrale. Les cartes lointaines attendent
            // plus loin encore, invisibles, prêtes à entrer.
            const x = actif ? 0 : (d < 0 ? -1 : 1) * (voisin ? 55 : 78);
            const echelle = actif ? 1 : voisin ? 0.52 : 0.42;

            return (
              <button
                key={v.projectId}
                onClick={() => setI(k)}
                disabled={actif}
                aria-label={actif ? undefined : `Voir ${v.style}`}
                aria-current={actif}
                className={[
                  "absolute inset-x-0 top-0 rounded-3xl border border-foyer-border p-3 shadow-sm",
                  // Tout est animé par le MÊME nœud : translation, échelle, couleur de
                  // fond (beige → blanc en arrivant au centre) et opacité.
                  "transition-all duration-[600ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]",
                  "motion-reduce:transition-none",
                  actif ? "z-30 cursor-default bg-white" : "z-10 bg-[#f2ebdf]",
                  // Sous lg, la carte centrale prend toute la largeur : les voisines y
                  // seraient illisibles et déborderaient.
                  actif
                    ? "opacity-100"
                    : voisin
                      ? "opacity-0 hover:opacity-100 lg:opacity-90"
                      : "pointer-events-none opacity-0",
                ].join(" ")}
                style={{ transform: `translateX(${x}%) scale(${echelle})` }}
              >
                {/* Le surtitre ne concerne que la carte courante — il s'efface sur les
                    voisines plutôt que d'être retiré, pour que toutes gardent la même
                    hauteur (sinon leur géométrie sauterait pendant le voyage). */}
                <p
                  className={[
                    "px-2 pt-2 text-left text-[12px] uppercase tracking-[0.18em] text-foyer-muted",
                    "transition-opacity duration-[600ms]",
                    actif ? "opacity-100" : "opacity-0",
                  ].join(" ")}
                >
                  {piece.label} — {k + 1} / {n}
                </p>
                {/* Le nom se cale du côté VISIBLE : c'est le bord INTÉRIEUR d'une voisine
                    qui passe sous la carte centrale, donc un libellé aligné à gauche se
                    ferait couper sur la voisine de droite. */}
                <p
                  className={[
                    "mb-2 truncate px-2 font-serif text-2xl text-foyer-ink",
                    d > 0 ? "text-right" : "text-left",
                  ].join(" ")}
                >
                  {v.style}
                </p>

                <div className="overflow-hidden rounded-2xl bg-foyer-cream">
                  {v.renderUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.renderUrl}
                      alt={`${piece.label} — style ${v.style}`}
                      className="aspect-[4/3] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] w-full items-center justify-center text-[13px] text-foyer-muted">
                      Rendu en cours
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Flèches rondes, calées sur le visuel des cartes voisines. */}
        <BoutonNav direction="gauche" onClick={() => aller(-1)} flottant />
        <BoutonNav direction="droite" onClick={() => aller(1)} flottant />
      </div>

      {/* Le détail de la carte courante, sous le rail : il ne voyage pas (une liste de
          courses réduite à 0,52 serait illisible), il se substitue. */}
      <div className="relative z-30 mx-auto -mt-2 max-w-xl rounded-3xl border border-foyer-border bg-white px-5 pb-5">
        <Detail key={courant.projectId} variante={courant} />
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
              onClick={() => setI(k)}
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

function BoutonNav({
  direction,
  onClick,
  flottant = false,
}: {
  direction: "gauche" | "droite";
  onClick: () => void;
  /** Posé sur les côtés, à hauteur du visuel des cartes voisines. */
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
          ? // Une voisine est réduite à 0,52 autour du centre du rail : son visuel se
            // retrouve centré vers 262px du haut, moins la moitié du bouton (22px).
            // z-40 : au-dessus de toutes les cartes, sinon la flèche passerait dessous.
            `absolute top-[240px] z-40 hidden lg:flex ${direction === "gauche" ? "left-[2%]" : "right-[2%]"}`
          : "",
      ].join(" ")}
    >
      <Icone className="h-5 w-5" />
    </button>
  );
}

/** Carte complète — mode « colonnes ». */
function CarteProjet({ variante, eyebrow }: { variante: VarianteVue; eyebrow: string }) {
  const { style, renderUrl } = variante;

  return (
    <section className="flex h-full flex-col rounded-3xl border border-foyer-border bg-white p-5">
      <div className="mb-4">
        <p className="text-[12px] uppercase tracking-[0.18em] text-foyer-muted">{eyebrow}</p>
        <h2 className="mt-0.5 font-serif text-2xl text-foyer-ink">{style}</h2>
      </div>

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

      <Detail variante={variante} />
    </section>
  );
}

/** Liste de courses + total + CTA. Partagé par les deux modes d'affichage. */
function Detail({ variante }: { variante: VarianteVue }) {
  const { items, total, sansPrix, projectId, listePrete } = variante;

  return (
    <div className="flex flex-1 flex-col">
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
                    <img src={it.product.imageUrl} alt="" className="h-full w-full object-contain" />
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

      <BoutonModifier projectId={projectId} />
    </div>
  );
}

/**
 * Interrupteur : l'édition depuis un dossier pro est VOLONTAIREMENT désactivée pour
 * l'instant. Passer à `true` la rallume — la mécanique (duplication + route /fork) est en
 * place et testée, seul le bouton est bloqué.
 */
const EDITION_ACTIVE = false;

/**
 * « Modifier ce projet » — n'ouvre PAS le projet illustré : il en duplique un et ouvre la
 * copie. Le dossier pro montre des projets MASTER au client ; les retoucher directement
 * détruirait ce qu'il regarde (une régénération écrase le rendu, sans historique).
 */
function BoutonModifier({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const dupliquer = async () => {
    if (!EDITION_ACTIVE) return;
    setEnCours(true);
    setErreur(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/fork`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "duplication impossible");
      router.push(`/create/${body.id}/final`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "duplication impossible");
      setEnCours(false);
    }
  };

  return (
    <div className="mt-4">
      <button
        onClick={dupliquer}
        disabled={enCours || !EDITION_ACTIVE}
        aria-disabled={!EDITION_ACTIVE}
        className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-foyer-ink px-5 py-3 text-[14px] font-medium text-foyer-cream transition-opacity disabled:opacity-40 enabled:cursor-pointer enabled:hover:opacity-90"
      >
        {enCours ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Création de votre copie…
          </>
        ) : (
          <>
            <Pencil className="h-4 w-4" />
            Modifier ce projet
            <ArrowUpRight className="h-4 w-4" />
          </>
        )}
      </button>
      <p className="mt-2 text-center text-[12px] text-foyer-muted">
        {erreur ??
          (EDITION_ACTIVE
            ? "Une copie est créée : le projet présenté ici reste intact."
            : "Bientôt disponible.")}
      </p>
    </div>
  );
}
