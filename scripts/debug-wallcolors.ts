import { config } from "dotenv";
config({ path: ".env.local" });
config();
async function main() {
  const { buildBeforeAfterComposite } = await import("../lib/ai/pipeline");
  const { getChangedWallColors } = await import("../lib/shopping/paintMatch");
  const { createSupabaseAdmin } = await import("../lib/supabase/server");
  const { data } = await createSupabaseAdmin().from("foyer_projects").select("data").eq("id", "ND5qBysTZ4di6wdY1xLEb").single();
  const p = data!.data as { basePhotoUrl: string; generatedRenderUrl: string };
  const comp = await buildBeforeAfterComposite(p.basePhotoUrl, p.generatedRenderUrl);
  const walls = await getChangedWallColors(comp.buffer as never);
  console.log("walls:", JSON.stringify(walls, null, 2));
}
main().catch((e) => { console.error("erreur:", e); process.exit(1); });
