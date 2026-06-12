import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Image as ImageIcon, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/actions";
import { listProjects } from "@/lib/storage/projects";

export const dynamic = "force-dynamic";

const NEOPHYTE_LIMIT = 3;

export default async function RendusPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth?tab=signin&next=/dashboard/rendus");

  const profile = await getProfile(user.id);
  const plan = profile?.plan ?? "neophyte";
  const isExpert = plan === "expert" || plan === "pro";

  // Load all projects belonging to this user that have a completed render
  const allProjects = await listProjects();
  const userProjects = allProjects
    .filter((p) => p.userId === user.id && p.generatedRenderUrl)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const visibleProjects = isExpert ? userProjects : userProjects.slice(0, NEOPHYTE_LIMIT);
  const hiddenCount = isExpert ? 0 : Math.max(0, userProjects.length - NEOPHYTE_LIMIT);

  const ROOM_LABEL: Record<string, string> = { salon: "Salon", chambre: "Chambre" };

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-[24px] font-medium text-foyer-ink">Mes Rendus</h1>
          <p className="text-[13px] text-foyer-muted">
            {userProjects.length} rendu{userProjects.length !== 1 ? "s" : ""}
            {!isExpert && ` · ${visibleProjects.length}/${NEOPHYTE_LIMIT} affichés`}
          </p>
        </div>
        <Link
          href="/create"
          className="flex items-center gap-1.5 rounded-full bg-foyer-sage px-4 py-2 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(107,142,111,0.3)] transition-all hover:-translate-y-0.5"
        >
          <Plus className="size-3.5" />
          Nouveau projet
        </Link>
      </div>

      {userProjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-foyer-border bg-foyer-cream px-6 py-20 text-center">
          <ImageIcon className="mx-auto mb-3 size-10 text-foyer-muted/30" />
          <p className="text-[15px] font-medium text-foyer-ink">Aucun rendu pour l'instant</p>
          <p className="mt-1 text-[13px] text-foyer-muted">
            Créez votre premier projet pour visualiser votre intérieur.
          </p>
          <Link
            href="/create"
            className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-foyer-sage px-5 py-2.5 text-[13px] font-semibold text-white"
          >
            <Plus className="size-3.5" />
            Commencer
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProjects.map((project) => (
              <Link
                key={project.id}
                href={`/create/${project.id}/final`}
                className="group overflow-hidden rounded-2xl border border-foyer-border bg-foyer-cream transition-all hover:-translate-y-0.5 hover:border-foyer-sage/40 hover:shadow-md"
              >
                {/* After render thumbnail */}
                <div className="relative aspect-[4/3] overflow-hidden bg-foyer-border/30">
                  <img
                    src={project.generatedRenderUrl!}
                    alt="Rendu"
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  {/* Before chip */}
                  {project.basePhotoUrl && (
                    <div className="absolute bottom-2 right-2 size-12 overflow-hidden rounded-xl border-2 border-white shadow-md">
                      <img src={project.basePhotoUrl} alt="Avant" className="size-full object-cover" />
                    </div>
                  )}
                  {/* Shopping list badge */}
                  {project.shoppingList && project.shoppingList.length > 0 && (
                    <div className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                      {project.shoppingList.length} articles
                    </div>
                  )}
                </div>

                <div className="px-4 py-3">
                  <p className="text-[13px] font-medium text-foyer-ink">
                    {ROOM_LABEL[project.roomType] ?? project.roomType}
                    {project.selectedStyleId && (
                      <span className="ml-2 text-[11px] capitalize text-foyer-muted">
                        · {project.selectedStyleId}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] text-foyer-muted">
                    {new Date(project.createdAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </Link>
            ))}

            {/* Locked slots for neophyte */}
            {hiddenCount > 0 && Array.from({ length: Math.min(hiddenCount, 3) }).map((_, i) => (
              <div
                key={`locked-${i}`}
                className="relative overflow-hidden rounded-2xl border border-dashed border-foyer-border bg-foyer-cream"
              >
                <div className="aspect-[4/3] bg-foyer-border/20" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-foyer-cream/80 backdrop-blur-[2px]">
                  <Lock className="size-5 text-foyer-muted/60" />
                  <p className="text-[11px] text-foyer-muted">Rendu masqué</p>
                </div>
              </div>
            ))}
          </div>

          {/* Upgrade banner for neophyte with hidden renders */}
          {hiddenCount > 0 && (
            <div className="mt-6 rounded-2xl border border-foyer-ochre/30 bg-foyer-ochre/8 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[14px] font-semibold text-foyer-ink">
                    {hiddenCount} rendu{hiddenCount > 1 ? "s" : ""} masqué{hiddenCount > 1 ? "s" : ""}
                  </p>
                  <p className="mt-0.5 text-[13px] text-foyer-muted">
                    Passez Expert pour accéder à tous vos rendus et listes de courses.
                  </p>
                </div>
                <Link
                  href="/features"
                  className="shrink-0 rounded-full bg-foyer-sage px-4 py-2 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(107,142,111,0.3)]"
                >
                  Passer Expert
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
