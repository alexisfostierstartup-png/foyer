import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FolderOpen, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/actions";
import { listProjects } from "@/lib/storage/projects";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth?tab=signin");

  const profile = await getProfile(user.id);
  const isExpert = profile?.plan === "expert" || profile?.plan === "pro";

  if (!isExpert) {
    return (
      <div className="min-h-dvh bg-foyer-cream">
        <nav className="flex items-center justify-between px-6 py-5">
          <Link href="/" className="font-serif text-[20px] tracking-tight text-foyer-ink">
            Foyer
          </Link>
          <Link href="/account" className="text-[13px] text-foyer-muted hover:text-foyer-ink">
            Mon compte
          </Link>
        </nav>
        <main className="mx-auto flex max-w-[480px] flex-col items-center px-6 pb-16 pt-16 text-center">
          <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-foyer-sage/12">
            <FolderOpen className="size-7 text-foyer-sage" />
          </div>
          <h1 className="font-serif text-[28px] font-medium text-foyer-ink">
            Sauvegardez vos projets
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-foyer-muted">
            Avec Foyer Expert, tous vos projets sont conservés dans votre espace personnel.
            Retrouvez n'importe quel rendu, comparez, ou reprenez là où vous vous étiez arrêté.
          </p>
          <Link
            href="/features"
            className="mt-8 flex h-[52px] items-center gap-2 rounded-full bg-foyer-sage px-8 font-semibold text-white shadow-[0_2px_12px_rgba(107,142,111,0.35)] transition-all hover:-translate-y-0.5"
          >
            Découvrir Foyer Expert
            <ArrowRight className="size-4" />
          </Link>
          <Link href="/create" className="mt-4 text-[13px] text-foyer-muted hover:text-foyer-ink">
            Continuer sans sauvegarder
          </Link>
        </main>
      </div>
    );
  }

  const allProjects = await listProjects();
  const userProjects = allProjects
    .filter((p) => p.userId === user.id && p.is_saved)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="min-h-dvh bg-foyer-cream">
      <nav className="flex items-center justify-between px-6 py-5">
        <Link href="/" className="font-serif text-[20px] tracking-tight text-foyer-ink">
          Foyer
        </Link>
        <Link href="/account" className="text-[13px] text-foyer-muted hover:text-foyer-ink">
          Mon compte
        </Link>
      </nav>

      <main className="mx-auto max-w-[640px] px-6 pb-16">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-serif text-[28px] font-medium text-foyer-ink">Mes projets</h1>
          <Link
            href="/create"
            className="flex items-center gap-1.5 rounded-full bg-foyer-sage px-4 py-2 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(107,142,111,0.3)] transition-all hover:-translate-y-0.5"
          >
            <Plus className="size-3.5" />
            Nouveau
          </Link>
        </div>

        {userProjects.length === 0 ? (
          <div className="rounded-3xl border border-foyer-border bg-white px-8 py-16 text-center">
            <FolderOpen className="mx-auto mb-4 size-10 text-foyer-muted/40" />
            <p className="text-[15px] font-medium text-foyer-ink">Aucun projet sauvegardé</p>
            <p className="mt-1 text-[13px] text-foyer-muted">
              Créez un rendu et cliquez "Sauvegarder" pour le retrouver ici.
            </p>
            <Link
              href="/create"
              className="mt-6 inline-flex h-[44px] items-center rounded-full bg-foyer-sage px-6 text-[14px] font-medium text-white shadow-[0_2px_8px_rgba(107,142,111,0.3)] transition-all hover:-translate-y-0.5"
            >
              Créer un projet →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {userProjects.map((project) => (
              <Link
                key={project.id}
                href={`/create/${project.id}/final`}
                className="group overflow-hidden rounded-2xl border border-foyer-border bg-white transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                {project.generatedRenderUrl ? (
                  <div className="aspect-[4/3] w-full overflow-hidden bg-foyer-cream">
                    <img
                      src={project.generatedRenderUrl}
                      alt={`${project.roomType} — ${project.selectedStyleId ?? "rendu"}`}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className="aspect-[4/3] w-full bg-foyer-border/30" />
                )}
                <div className="p-4">
                  <p className="text-[14px] font-medium capitalize text-foyer-ink">
                    {project.roomType} · {project.selectedStyleId ?? "Sans style"}
                  </p>
                  <p className="mt-0.5 text-[12px] text-foyer-muted">
                    {new Date(project.createdAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
