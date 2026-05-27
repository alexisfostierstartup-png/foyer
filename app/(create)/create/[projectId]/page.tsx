export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="font-serif text-3xl text-foyer-ink">Étape 4 — Rendu &amp; marquage</h1>
      <p className="mt-4 max-w-md text-foyer-muted">
        Projet <span className="font-mono text-foyer-ink">{projectId}</span> (placeholder).
        Marquage du mobilier : garder / customiser / remplacer.
      </p>
    </main>
  );
}
