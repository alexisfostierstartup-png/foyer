export const dynamic = "force-dynamic";
import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase/server";

type Row = {
  id: string;
  created_at: string;
  anon_id: string | null;
  data: {
    testerTag?: string | null;
    roomType?: string;
    mode?: string;
    selectedStyleId?: string;
    generatedRenderUrl?: string | null;
    expertRenderUrl?: string | null;
    shoppingList?: unknown[];
  };
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

/**
 * USER TESTS — parcours par testeur (demande Alexis 2026-07-17).
 * Le « nom » est le tag du lien d'entrée distribué (…/create?t=lea → cookie →
 * data.testerTag sur chaque projet). Les anonymes SANS tag sont regroupés par
 * anon_id (cookie navigateur) sous un pseudonyme court — on voit donc aussi les
 * visiteurs arrivés sans lien personnalisé.
 */
export default async function TesteursPage({
  searchParams,
}: {
  searchParams: Promise<{ tous?: string }>;
}) {
  // Par défaut : seulement les testeurs à LIEN personnalisé — les groupes
  // « anonyme » (cookie foyer_anon_id, historique d'un mois : navigateurs
  // d'Alexis, visiteurs) noyaient la vue (« 29 testeurs » avant tout user test).
  const { tous } = await searchParams;
  const inclureAnonymes = tous === "1";
  const { data, error } = await createSupabaseAdmin()
    .from("foyer_projects")
    .select("id, created_at, anon_id, data")
    .order("created_at", { ascending: false })
    .limit(400);

  const rows = (data ?? []) as Row[];
  // Groupe : tag explicite sinon anon_id raccourci.
  const groupes = new Map<string, { nom: string; via: "lien" | "anonyme"; projets: Row[] }>();
  for (const r of rows) {
    const tag = r.data?.testerTag?.trim();
    const cle = tag ? `t:${tag}` : r.anon_id ? `a:${r.anon_id}` : `p:${r.id}`;
    const g = groupes.get(cle) ?? {
      nom: tag ?? (r.anon_id ? `visiteur ${r.anon_id.slice(0, 6)}` : `projet ${r.id.slice(0, 6)}`),
      via: tag ? ("lien" as const) : ("anonyme" as const),
      projets: [],
    };
    g.projets.push(r);
    groupes.set(cle, g);
  }
  const liste = [...groupes.values()]
    .filter((g) => inclureAnonymes || g.via === "lien")
    .sort((a, b) => Date.parse(b.projets[0].created_at) - Date.parse(a.projets[0].created_at));
  const nbAnonymes = [...groupes.values()].filter((g) => g.via === "anonyme").length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-2xl text-foyer-ink">Testeurs</h1>
        <p className="text-sm text-foyer-muted mt-1">
          {liste.length} testeur{liste.length !== 1 ? "s" : ""} à lien personnalisé — lien
          d&apos;entrée à distribuer :{" "}
          <code className="rounded bg-foyer-border/40 px-1">/create?t=prenom</code>
          {" · "}
          {inclureAnonymes ? (
            <Link href="/admin/testeurs" className="text-foyer-sage hover:underline">
              masquer les anonymes
            </Link>
          ) : (
            <Link href="/admin/testeurs?tous=1" className="text-foyer-sage hover:underline">
              afficher aussi les {nbAnonymes} anonymes (historique)
            </Link>
          )}
        </p>
        {liste.length === 0 && !inclureAnonymes && (
          <p className="mt-3 text-sm italic text-foyer-muted">
            Aucun testeur à lien pour l&apos;instant — distribue des liens {" "}
            <code className="rounded bg-foyer-border/40 px-1">/create?t=prenom</code> et ils
            apparaîtront ici dès leur premier projet.
          </p>
        )}
        {error && <p className="mt-2 text-sm text-foyer-terra">Erreur : {error.message}</p>}
      </div>

      <div className="space-y-6">
        {liste.map((g) => (
          <section key={g.nom} className="rounded-lg border border-foyer-border bg-white">
            <header className="flex items-center justify-between border-b border-foyer-border px-4 py-3">
              <span className="font-medium text-foyer-ink">
                {g.nom}
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${
                    g.via === "lien" ? "bg-foyer-sage/15 text-foyer-sage" : "bg-foyer-border text-foyer-muted"
                  }`}
                >
                  {g.via === "lien" ? "lien personnalisé" : "anonyme"}
                </span>
              </span>
              <span className="text-sm text-foyer-muted">
                {g.projets.length} projet{g.projets.length !== 1 ? "s" : ""}
              </span>
            </header>
            <table className="w-full text-sm">
              <tbody>
                {g.projets.map((p) => (
                  <tr key={p.id} className="border-b border-foyer-border/50 last:border-b-0">
                    <td className="px-4 py-2 w-16 text-foyer-muted">{timeAgo(p.created_at)}</td>
                    <td className="px-4 py-2 font-mono text-[12px] text-foyer-muted">{p.id.slice(0, 10)}…</td>
                    <td className="px-4 py-2">{p.data?.roomType ?? "—"}</td>
                    <td className="px-4 py-2">{p.data?.mode === "expert" ? "expert" : "standard"}</td>
                    <td className="px-4 py-2">{p.data?.selectedStyleId ?? "—"}</td>
                    <td className="px-4 py-2 text-foyer-muted">
                      {p.data?.expertRenderUrl || p.data?.generatedRenderUrl ? "rendu ✓" : "sans rendu"}
                      {Array.isArray(p.data?.shoppingList) ? ` · ${p.data.shoppingList.length} items` : ""}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <Link href={`/create/${p.id}/final`} className="text-foyer-sage hover:underline" target="_blank">
                        voir
                      </Link>
                      <Link href={`/admin/logs?project=${p.id}`} className="ml-3 text-foyer-sage hover:underline">
                        logs
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  );
}
