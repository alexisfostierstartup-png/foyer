import { notFound } from "next/navigation";
import { Heart } from "lucide-react";
import { getShareLinkBySlug, getJobRenders, incrementShareViewCount } from "@/lib/db/pro";

export const dynamic = "force-dynamic";

type ShareLinkData = {
  job_id: string;
  slug: string;
  pro_generation_jobs: {
    id: string;
    total_renders: number;
    completed_renders: number;
    pro_properties: { address?: string; property_type?: string } | null;
  } | null;
};

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const link = (await getShareLinkBySlug(slug)) as ShareLinkData | null;
  if (!link || !link.pro_generation_jobs) notFound();

  // Increment view count (fire-and-forget pattern)
  incrementShareViewCount(slug).catch(() => {});

  const renders = await getJobRenders(link.job_id);
  const completed = renders.filter((r) => r.status === "completed" && r.render_url);
  const job = link.pro_generation_jobs;
  const property = job.pro_properties;

  return (
    <div className="min-h-dvh bg-[#faf6f0]">
      {/* Header */}
      <header className="border-b border-foyer-border bg-foyer-cream/80 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <p className="font-serif text-[20px] font-medium text-foyer-ink">Foyer</p>
            <p className="text-[11px] uppercase tracking-[0.08em] text-foyer-muted">Home staging virtuel</p>
          </div>
          {property?.address && (
            <div className="text-right">
              <p className="text-[13px] font-medium text-foyer-ink">{property.address}</p>
              <p className="text-[11px] capitalize text-foyer-muted">{property.property_type}</p>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* Hero */}
        <div className="mb-10 text-center">
          <h1 className="font-serif text-[32px] font-medium text-foyer-ink sm:text-[40px]">
            {property?.address ?? "Projet"}
          </h1>
          <p className="mt-2 text-[14px] text-foyer-muted">
            {completed.length} visualisation{completed.length !== 1 ? "s" : ""} ·{" "}
            Généré avec Foyer
          </p>
        </div>

        {/* Renders grid */}
        {completed.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-foyer-border bg-foyer-cream px-6 py-20 text-center">
            <p className="text-[16px] text-foyer-muted">La génération est toujours en cours — revenez dans quelques minutes.</p>
          </div>
        ) : (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
            {completed.map((render) => (
              <div key={render.id} className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-foyer-border/50 bg-foyer-cream">
                <img
                  src={render.render_url!}
                  alt={render.ambiance_slug}
                  className="w-full object-cover"
                />
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-[13px] font-medium text-foyer-ink">
                      {(render as unknown as { pro_property_rooms?: { name: string } }).pro_property_rooms?.name ?? "Pièce"}
                    </p>
                    <p className="text-[11px] capitalize text-foyer-muted">{render.ambiance_slug}</p>
                  </div>
                  {render.is_favorite && (
                    <Heart className="size-4 fill-current text-red-400" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer CTA */}
        <div className="mt-16 rounded-2xl border border-foyer-sage/30 bg-foyer-sage/8 px-8 py-8 text-center">
          <p className="font-serif text-[22px] text-foyer-ink">Vous êtes agent immobilier ?</p>
          <p className="mt-2 text-[14px] text-foyer-muted">
            Foyer Pro génère des portfolios de home staging virtuel en quelques clics.
          </p>
          <a
            href="/pro"
            className="mt-6 inline-flex rounded-full bg-foyer-sage px-6 py-2.5 text-[14px] font-semibold text-white shadow-[0_2px_8px_rgba(107,142,111,0.3)]"
          >
            Découvrir Foyer Pro
          </a>
        </div>
      </main>
    </div>
  );
}
