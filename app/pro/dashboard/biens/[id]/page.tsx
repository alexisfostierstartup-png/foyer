import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus, ChevronLeft, Camera, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProperty, getRooms, listJobs } from "@/lib/db/pro";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  running: "En cours",
  completed: "Terminé",
  failed: "Erreur",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-foyer-muted/20 text-foyer-muted",
  running: "bg-blue-100 text-blue-700",
  completed: "bg-foyer-sage/15 text-foyer-sage",
  failed: "bg-red-100 text-red-600",
};

export default async function BienDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?tab=signin");

  const [property, rooms, jobs] = await Promise.all([
    getProperty(id, user.id),
    getRooms(id),
    listJobs(id, user.id),
  ]);

  if (!property) notFound();

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/pro/dashboard/biens"
            className="rounded-full p-2 text-foyer-muted transition-colors hover:bg-foyer-border hover:text-foyer-ink"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <div>
            <h1 className="font-serif text-[22px] font-medium text-foyer-ink">{property.address}</h1>
            <p className="text-[12px] capitalize text-foyer-muted">
              {property.property_type}
              {property.surface_m2 ? ` · ${property.surface_m2} m²` : ""}
              {" · "}
              {rooms.length} pièce{rooms.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Link
          href={`/pro/create?propertyId=${property.id}`}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-foyer-sage px-4 py-2 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(107,142,111,0.3)] transition-all hover:-translate-y-0.5"
        >
          <Zap className="size-3.5" />
          Générer
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Rooms grid */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-foyer-muted">Pièces</h2>
          </div>

          {rooms.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-foyer-border bg-foyer-cream px-6 py-12 text-center">
              <Camera className="mx-auto mb-2 size-7 text-foyer-muted/40" />
              <p className="text-[14px] text-foyer-muted">Aucune pièce.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {rooms.map((room) => (
                <div key={room.id} className="overflow-hidden rounded-2xl border border-foyer-border bg-foyer-cream">
                  {room.primary_photo_url ? (
                    <img
                      src={room.primary_photo_url}
                      alt={room.name}
                      className="aspect-[4/3] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] w-full items-center justify-center bg-foyer-border/30">
                      <Camera className="size-6 text-foyer-muted/40" />
                    </div>
                  )}
                  <div className="px-3 py-2">
                    <p className="truncate text-[13px] font-medium text-foyer-ink">{room.name}</p>
                    <p className="text-[11px] capitalize text-foyer-muted">{room.room_type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Jobs sidebar */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-foyer-muted">
              Générations
            </h2>
          </div>

          {jobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-foyer-border bg-foyer-cream px-4 py-8 text-center">
              <p className="text-[13px] text-foyer-muted">Aucune génération pour ce bien.</p>
              <Link
                href={`/pro/create?propertyId=${property.id}`}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-foyer-sage px-3 py-1.5 text-[12px] font-medium text-white"
              >
                <Plus className="size-3" />
                Lancer une génération
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/pro/dashboard/jobs/${job.id}`}
                  className="flex items-center justify-between rounded-xl border border-foyer-border bg-foyer-cream px-4 py-3 transition-colors hover:border-foyer-sage/40"
                >
                  <div>
                    <p className="text-[13px] font-medium text-foyer-ink">
                      {job.completed_renders}/{job.total_renders} rendus
                    </p>
                    <p className="text-[11px] text-foyer-muted">
                      {new Date(job.created_at!).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[job.status ?? "pending"] ?? STATUS_COLOR.pending}`}>
                    {STATUS_LABEL[job.status ?? "pending"]}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {property.notes && (
        <div className="mt-6 rounded-2xl border border-foyer-border bg-foyer-cream p-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foyer-muted">Notes</p>
          <p className="text-[13px] text-foyer-ink">{property.notes}</p>
        </div>
      )}
    </div>
  );
}
