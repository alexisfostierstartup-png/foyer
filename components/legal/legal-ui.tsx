import type { ReactNode } from "react";

/**
 * Briques de présentation partagées par les pages légales (mentions légales,
 * confidentialité, cookies). Composants serveur, calqués sur le design system
 * Foyer (Fraunces pour les titres, palette argile/ocre/encre).
 */

export function LegalPage({
  title,
  updatedAt,
  intro,
  children,
}: {
  title: string;
  updatedAt: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article>
      <header className="mb-12">
        <h1 className="font-serif text-[34px] leading-tight tracking-tight text-foyer-ink">
          {title}
        </h1>
        <p className="mt-3 text-[13px] text-foyer-muted">
          Dernière mise à jour : {updatedAt}
        </p>
        {intro ? (
          <p className="mt-6 text-[16px] leading-7 text-foyer-ink/85">{intro}</p>
        ) : null}
      </header>
      <div className="space-y-10">{children}</div>
    </article>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-serif text-[22px] leading-snug text-foyer-ink">
        {title}
      </h2>
      <div className="space-y-3 text-[15px] leading-7 text-foyer-ink/80">
        {children}
      </div>
    </section>
  );
}

/** Jeton visuel pour les champs d'identité juridique restant à renseigner. */
export function Todo({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-foyer-terra/30 bg-foyer-terra/10 px-1.5 py-0.5 align-baseline font-mono text-[12px] font-medium text-foyer-terra-deep">
      {label ? `${label} : ` : ""}[À COMPLÉTER]
    </span>
  );
}

/** Liste « clé : valeur » pour les blocs d'identité / coordonnées. */
export function DefinitionList({
  items,
}: {
  items: { term: string; value: ReactNode }[];
}) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[200px_1fr]">
      {items.map((item) => (
        <div key={item.term} className="contents">
          <dt className="text-[14px] font-medium text-foyer-ink">{item.term}</dt>
          <dd className="text-[15px] text-foyer-ink/80">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Tableau responsive (scroll horizontal sur mobile) pour la page cookies. */
export function LegalTable({
  columns,
  rows,
  caption,
  wide = false,
}: {
  columns: string[];
  rows: ReactNode[][];
  caption?: string;
  /** Déborde la colonne de lecture sur grand écran (tableaux denses). */
  wide?: boolean;
}) {
  return (
    <div
      className={`overflow-x-auto rounded-xl border border-foyer-border ${
        wide ? "lg:-mx-16 xl:-mx-28" : ""
      }`}
    >
      <table className="w-full min-w-[680px] border-collapse text-left text-[13.5px]">
        {caption ? (
          <caption className="px-4 pt-4 text-left text-[13px] text-foyer-muted">
            {caption}
          </caption>
        ) : null}
        <thead>
          <tr className="border-b border-foyer-border bg-foyer-cream/60">
            {columns.map((col) => (
              <th
                key={col}
                scope="col"
                className="px-4 py-3 font-medium text-foyer-ink"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-foyer-border/60 last:border-0 align-top"
            >
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-foyer-ink/80">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CategoryBadge({
  tone,
  children,
}: {
  tone: "necessary" | "audience" | "affiliation";
  children: ReactNode;
}) {
  const styles = {
    necessary: "border-foyer-sage/30 bg-foyer-sage/10 text-foyer-sage",
    audience: "border-foyer-ochre/40 bg-foyer-ochre/10 text-foyer-ochre",
    affiliation: "border-foyer-terra/30 bg-foyer-terra/10 text-foyer-terra-deep",
  }[tone];
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[12px] font-medium ${styles}`}
    >
      {children}
    </span>
  );
}
