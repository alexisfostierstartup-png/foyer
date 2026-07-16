import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { updateProject } from "@/lib/storage/projects";

/**
 * RÉTRO-TAG TESTEUR — appelé par le client quand il arrive avec ?t=… (fin de
 * formulaire → redirect). Le cookie tague les projets FUTURS (upload) ; cette
 * route rattrape les projets DÉJÀ créés par ce navigateur (test fait AVANT le
 * formulaire) : tous les projets de son anon_id sans tag reçoivent le sien.
 * Les deux ordres (test→formulaire, formulaire→test) sont donc couverts.
 */
export async function POST(req: NextRequest) {
  const tag = req.cookies.get("foyer_tester")?.value;
  const anonId = req.cookies.get("foyer_anon_id")?.value;
  if (!tag || !anonId) return NextResponse.json({ ok: true, tagged: 0 });

  const { data } = await createSupabaseAdmin()
    .from("foyer_projects")
    .select("id, data")
    .eq("anon_id", anonId)
    .order("created_at", { ascending: false })
    .limit(50);

  let tagged = 0;
  for (const row of data ?? []) {
    const d = row.data as { testerTag?: string | null };
    if (d?.testerTag) continue;
    await updateProject(row.id, { testerTag: tag });
    tagged += 1;
  }
  if (tagged > 0) console.log(`[tester-tag] ${tagged} projet(s) rétro-tagué(s) → ${tag}`);
  return NextResponse.json({ ok: true, tagged });
}
