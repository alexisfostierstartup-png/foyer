import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin, createClient } from "@/lib/supabase/server";
import { updateProject } from "@/lib/storage/projects";
import { getClientIp, checkRateLimit, RATE_LIMITED_BODY } from "@/lib/security/rateLimit";

/**
 * « ET VOTRE PRÉNOM ? » — fin de parcours /final (spec Alexis 2026-07-17) :
 * chaque navigateur a déjà un sessionID (cookie foyer_anon_id, ou compte
 * connecté) auquel tous ses projets sont rattachés. Quand le testeur donne son
 * prénom à la fin, on REMPLACE ce sessionID par le nom : tous les projets de la
 * session sont tagués (data.testerTag), et le cookie foyer_tester couvre les
 * projets suivants. L'admin /testeurs affiche alors le prénom.
 */
export async function POST(req: NextRequest) {
  if (!(await checkRateLimit(getClientIp(req), "tester-name", 10))) {
    return NextResponse.json(RATE_LIMITED_BODY, { status: 429 });
  }
  const { name, firstName, lastName } = (await req.json().catch(() => ({}))) as {
    name?: string;
    firstName?: string;
    lastName?: string;
  };
  // Nom COMPLET affichable (« Léa Dupont ») + tag slug (« lea-dupont »).
  const complet = [firstName, lastName].filter((s) => s?.trim()).join(" ").trim() || (name ?? "").trim();
  const tag = complet
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 64);
  if (!tag) return NextResponse.json({ error: "prénom manquant" }, { status: 400 });

  const anonId = req.cookies.get("foyer_anon_id")?.value;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  const poseCookie = (res: NextResponse) => {
    // Toujours posé, MÊME sans session existante (formulaire rempli AVANT le
    // premier projet) : les projets à venir de ce navigateur porteront le nom.
    res.cookies.set("foyer_tester", tag, { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 90 });
    return res;
  };
  if (!anonId && !userId) return poseCookie(NextResponse.json({ ok: true, tagged: 0, tag }));

  // Tous les projets de la session (les deux identités si les deux existent).
  const admin = createSupabaseAdmin();
  const ids = new Set<string>();
  if (anonId) {
    const { data } = await admin.from("foyer_projects").select("id").eq("anon_id", anonId).limit(100);
    for (const r of data ?? []) ids.add(r.id);
  }
  if (userId) {
    const { data } = await admin.from("foyer_projects").select("id").eq("user_id", userId).limit(100);
    for (const r of data ?? []) ids.add(r.id);
  }
  let n = 0;
  for (const id of ids) {
    await updateProject(id, { testerTag: tag, testerName: complet.slice(0, 120) });
    n += 1;
  }
  console.log(`[tester-name] session nommée « ${complet} » → ${n} projet(s)`);

  return poseCookie(NextResponse.json({ ok: true, tagged: n, tag }));
}
