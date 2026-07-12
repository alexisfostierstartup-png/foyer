export const dynamic = "force-dynamic";

import type { ReactNode } from "react";
import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { CatalogProductGallery } from "@/components/admin/CatalogProductGallery";
import { ProductAttrsEditor } from "@/components/admin/ProductAttrsEditor";

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-foyer-border bg-foyer-cream px-2 py-0.5 text-foyer-muted">
      {children}
    </span>
  );
}

export default async function CatalogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: p } = await (supabase as any)
    .from("partner_products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!p) {
    return (
      <div className="max-w-4xl">
        <Link href="/admin/catalog" className="text-sm text-foyer-muted hover:text-foyer-ink">
          ← Retour au catalogue
        </Link>
        <div className="mt-8 rounded-2xl border border-foyer-border bg-foyer-cream/40 px-6 py-12 text-center">
          <p className="font-serif text-lg text-foyer-ink">Ce produit n&apos;existe plus</p>
          <p className="mt-2 text-sm text-foyer-muted">
            Il a probablement été supprimé ou remplacé lors d&apos;une mise à jour du catalogue.
          </p>
          <Link
            href="/admin/catalog"
            className="mt-5 inline-block rounded-lg bg-foyer-ink px-4 py-2 text-sm text-foyer-cream hover:bg-foyer-ink/90"
          >
            Retour au catalogue
          </Link>
        </div>
      </div>
    );
  }

  const metadata = (p.metadata ?? {}) as Record<string, unknown>;
  const features = (metadata.features ?? null) as Record<string, unknown> | null;
  const attrs = (metadata.attrs ?? null) as Record<string, unknown> | null;
  const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
  const images: string[] = Array.isArray(p.image_urls) ? p.image_urls : [];

  return (
    <div className="max-w-4xl">
      <Link href="/admin/catalog" className="text-sm text-foyer-muted hover:text-foyer-ink">
        ← Retour au catalogue
      </Link>

      <div className="mt-4 grid gap-8 md:grid-cols-2">
        {/* Galerie : clic miniature → grand + choix de l'image 1 (cosine) */}
        <CatalogProductGallery productId={p.id} images={images} initialPrimary={p.primary_image_url ?? ""} />

        {/* Infos */}
        <div>
          <h1 className="font-serif text-xl text-foyer-ink">{p.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <Badge>{p.category}</Badge>
            <Badge>{p.merchant}</Badge>
            <Badge>{p.source_type}</Badge>
            {p.partner_tier && <Badge>{p.partner_tier}</Badge>}
            <Badge>{p.availability_status}</Badge>
          </div>

          {/* color_hex = couleur dominante (sharp) : FIABLE pour peinture/sol (aplats), mais
              polluée par la scène sur le mobilier photographié en situation → on ne l'affiche
              (et le matching ne s'en sert) QUE pour peinture/sol. Le mobilier utilise attrs.color. */}
          {(p.category === "paint" || p.category === "floor") && typeof metadata.color_hex === "string" && (
            <div className="mt-3 flex items-center gap-2.5">
              <span
                className="size-8 rounded-md border border-foyer-border"
                style={{ backgroundColor: metadata.color_hex }}
                aria-hidden
              />
              <span className="font-mono text-sm text-foyer-ink">{metadata.color_hex}</span>
              <span className="text-xs text-foyer-muted">hex (matching peinture/sol par couleur)</span>
            </div>
          )}

          <p className="mt-3 text-2xl text-foyer-ink">
            {p.price != null ? `${p.price} ${p.currency ?? "€"}` : "–"}
          </p>

          {p.product_url && (
            <a
              href={p.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block rounded-lg bg-foyer-ink px-4 py-2 text-sm text-foyer-cream hover:bg-foyer-ink/90"
            >
              Voir le produit ↗
            </a>
          )}

          {/* Tags de style (backfill-style-tags) : core = le produit incarne le style
              (chip pleine, utilisé par le bonus matching + le dashboard des trous) ;
              compatible = s'intègre sans détonner (contour, bonus faible). */}
          {(((p.style_affinity ?? []) as string[]).length > 0 || ((metadata.style_compatible ?? []) as string[]).length > 0) && (
            <section className="mt-5 rounded-xl border border-foyer-border bg-foyer-cream/40 p-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-foyer-muted">
                Styles
                {typeof metadata.style_tagged_at === "string" && (
                  <span className="ml-2 font-normal normal-case text-foyer-muted/70">· taggé le {metadata.style_tagged_at.slice(0, 10)}</span>
                )}
              </h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {((p.style_affinity ?? []) as string[]).map((s) => (
                  <span key={s} className="rounded-full bg-foyer-sage/90 px-2.5 py-1 text-xs font-medium text-white" title="core — incarne le style">{s}</span>
                ))}
                {((metadata.style_compatible ?? []) as string[]).map((s) => (
                  <span key={s} className="rounded-full border border-foyer-border bg-white/70 px-2.5 py-1 text-xs text-foyer-muted" title="compatible">{s}</span>
                ))}
              </div>
            </section>
          )}

          {/* Attributs structurés — ÉDITABLES (repasse manuelle : clic sur un attribut →
              vocabulaire fermé de la catégorie). Affiché même sans attrs : c'est
              justement là qu'on veut pouvoir en saisir. */}
          <ProductAttrsEditor
            productId={p.id}
            category={p.category}
            initialAttrs={(attrs ?? {}) as Record<string, unknown>}
            attrsModel={typeof metadata.attrs_model === "string" ? metadata.attrs_model : null}
            initialManual={(metadata.attrs_manual as string[]) ?? []}
          />

          {p.description && (
            <section className="mt-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-foyer-muted">Description</h2>
              <p className="mt-1 whitespace-pre-line text-sm text-foyer-ink">{p.description}</p>
            </section>
          )}

          {features && Object.keys(features).length > 0 && (
            <section className="mt-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-foyer-muted">Caractéristiques</h2>
              <div className="mt-1 text-sm">
                {Object.entries(features).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-foyer-border/50 py-1">
                    <span className="text-foyer-muted">{k}</span>
                    <span className="text-right text-foyer-ink">{String(v)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-foyer-muted">Metadata (brut)</h2>
            <pre className="mt-1 overflow-x-auto rounded-md bg-foyer-cream/60 p-3 text-xs text-foyer-ink">
              {JSON.stringify(metadata, null, 2)}
            </pre>
          </section>

          <p className="mt-4 text-xs text-foyer-muted">
            id: {p.id} · external_id: {p.external_id} · maj:{" "}
            {p.last_synced_at ? new Date(p.last_synced_at).toLocaleString("fr-FR") : "–"}
          </p>
        </div>
      </div>
    </div>
  );
}
