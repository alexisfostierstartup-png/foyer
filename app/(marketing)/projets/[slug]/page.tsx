import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { BeforeAfterV2 } from "@/components/landing/v2/parts";
import { PROJETS, getProjet, type ProjetVitrine } from "@/lib/projets";

/* ============================================================================
 * VITRINE — une page par projet réalisé.
 *
 * Les données sont FIGÉES dans data/projets/<slug>.json (script
 * scripts/export-projet-vitrine.ts). Choix délibéré : une vitrine publique ne doit
 * pas bouger quand on retouche le projet en base, et un rendu raté ne doit jamais
 * s'afficher tout seul sur le site.
 *
 * Lecture SEULE : le top-1 de chaque ligne, aucun bouton d'édition.
 * ========================================================================== */

export function generateStaticParams() {
  return PROJETS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = PROJETS.find((p) => p.slug === slug);
  return {
    title: meta ? `${meta.nom} — Héra` : "Projet — Héra",
    description: meta?.resume,
  };
}

const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;

const FAMILLE: Record<string, string> = {
  sofa: "Canapé", armchair: "Fauteuil", chair: "Chaises", coffee_table: "Table basse",
  dining_table: "Table à manger", side_table: "Table d'appoint", tv_stand: "Meuble TV",
  sideboard: "Buffet", bookshelf: "Bibliothèque", rug: "Tapis", floor_lamp: "Lampadaire",
  table_lamp: "Lampe", ceiling_light: "Suspension", paint: "Peinture", floor: "Sol",
};

function Ligne({ item }: { item: ProjetVitrine["items"][number] }) {
  const { product: p } = item;
  return (
    <li className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4">
      {p.imageUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={p.imageUrl}
          alt={p.name}
          loading="lazy"
          className="size-16 shrink-0 rounded-xl object-cover ring-1 ring-line"
        />
      ) : (
        <span className="size-16 shrink-0 rounded-xl bg-bone ring-1 ring-line" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {FAMILLE[item.category] ?? item.category.replace(/_/g, " ")}
          {item.quantity > 1 && ` · ×${item.quantity}`}
        </p>
        <p className="mt-0.5 truncate text-[15px] text-ink" title={p.name}>{p.name}</p>
        <p className="text-[12px] text-muted-foreground">{p.merchant?.replace(/_/g, " ")}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-display text-lg text-ink">{p.price != null ? eur(p.price) : "—"}</span>
        {p.url && (
          <a
            href={p.url}
            target="_blank"
            rel="noreferrer nofollow"
            aria-label={`Voir ${p.name}`}
            className="grid size-8 place-items-center rounded-full ring-1 ring-line text-muted-foreground transition-colors hover:text-ink hover:ring-ink"
          >
            <ArrowUpRight className="size-4" aria-hidden />
          </a>
        )}
      </div>
    </li>
  );
}

export default async function ProjetPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const meta = PROJETS.find((p) => p.slug === slug);
  const data = meta ? await getProjet(slug) : null;
  if (!meta || !data) notFound();

  return (
    <main className="grain">
      <div className="mx-auto max-w-4xl px-5 pb-24 pt-28 sm:pt-32">
        <Link
          href="/#gallery"
          className="inline-flex items-center gap-2 text-[13px] text-muted-foreground transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Tous les projets
        </Link>

        <header className="mt-8">
          <span className="text-[11px] uppercase tracking-[0.22em] text-forest">{meta.tag}</span>
          <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-[-0.02em] sm:text-5xl">
            {meta.titre}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            {meta.resume}
          </p>
        </header>

        <div className="mt-10 overflow-hidden rounded-3xl ring-1 ring-line shadow-card-lg">
          <BeforeAfterV2 beforeSrc={data.beforeUrl} afterSrc={data.afterUrl} beforeAlt={`${meta.nom} — avant`} afterAlt={`${meta.nom} — après`} />
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-line sm:grid-cols-4">
          {[
            { k: "Surface", v: meta.surface },
            { k: "Conservé", v: meta.conserve },
            { k: "Articles", v: String(data.items.length) },
            { k: "Coût du projet", v: eur(data.totalEstimated) },
          ].map((s) => (
            <div key={s.k} className="bg-bone px-5 py-4">
              <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.k}</dt>
              <dd className="mt-1 font-display text-2xl text-ink">{s.v}</dd>
            </div>
          ))}
        </dl>

        <section className="mt-14">
          <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-forest">
            <span className="h-px w-6 bg-current opacity-60" />
            La liste
          </span>
          <h2 className="mt-4 font-display text-3xl tracking-[-0.02em]">
            Tout ce que vous voyez, vous pouvez l&apos;avoir
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            Chaque meuble du rendu correspond à un produit réel, choisi dans le catalogue et
            réellement intégré dans l&apos;image. Voici la liste exacte.
          </p>

          <ul className="mt-8 flex flex-col gap-3">
            {data.items.map((it, i) => (
              <Ligne key={`${it.category}-${i}`} item={it} />
            ))}
          </ul>

          <div className="mt-6 flex items-baseline justify-between rounded-2xl border border-line bg-card px-5 py-4">
            <span className="text-[14px] text-ink">
              Total — {data.items.length} article{data.items.length > 1 ? "s" : ""}
            </span>
            <span className="font-display text-3xl text-ink">{eur(data.totalEstimated)}</span>
          </div>
        </section>

        <div className="mt-14 rounded-3xl bg-ink px-8 py-10 text-center text-cream">
          <h2 className="font-display text-3xl tracking-[-0.02em]">Et chez vous&nbsp;?</h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed opacity-80">
            Une photo de votre pièce suffit. On garde ce qui mérite de l&apos;être, et on
            chine le reste.
          </p>
          <Link
            href="/create"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-cream px-6 py-3 text-[14px] font-medium text-ink transition-opacity hover:opacity-90"
          >
            Commencer un projet
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </main>
  );
}
