import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { updateProject } from "@/lib/storage/projects";

/**
 * NOMMER UN TESTEUR après coup (admin) — filet indépendant du formulaire : le
 * lien d'entrée n'avait pas de ?t= (redirection nue), Alexis recoupe visiteur ↔
 * réponse par horodatage et pose le prénom ici. Tague data.testerTag sur TOUS
 * les projets du groupe (anon_id OU user_id). Route protégée par le middleware
 * admin (cookie admin_session).
 */
export async function POST(req: NextRequest) {
  const { tag, anonId, userId } = (await req.json().catch(() => ({}))) as {
    tag?: string;
    anonId?: string;
    userId?: string;
  };
  const slug = (tag ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 64);
  if (!slug || (!anonId && !userId)) {
    return NextResponse.json({ error: "tag et anonId|userId requis" }, { status: 400 });
  }

  let q = createSupabaseAdmin().from("foyer_projects").select("id").limit(100);
  q = anonId ? q.eq("anon_id", anonId) : q.eq("user_id", userId!);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let n = 0;
  for (const row of data ?? []) {
    await updateProject(row.id, { testerTag: slug });
    n += 1;
  }
  console.log(`[admin/tester-name] ${n} projet(s) tagués → ${slug}`);
  return NextResponse.json({ ok: true, tagged: n, tag: slug });
}
