#!/usr/bin/env npx tsx
/**
 * Supprime les fichiers Storage (buckets renders + room-images) antérieurs à une date
 * cutoff — demandé explicitement par l'utilisateur (limite de stockage Supabase atteinte,
 * catalogue partenaire écarté comme cause : 0 fichier catalogue dans Storage, vérifié).
 * Utilise l'API Storage (storage.remove) — pas un DELETE SQL brut sur storage.objects, qui
 * ne libérerait pas le stockage physique sous-jacent.
 *
 * Usage : npx tsx scripts/_import7/purge-old-storage.ts [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const CUTOFF = "2026-07-05T00:00:00Z";
const BUCKETS = ["renders", "room-images"];

async function main() {
  const dry = process.argv.includes("--dry");
  const { createSupabaseAdmin } = await import("../../lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createSupabaseAdmin() as any;

  for (const bucket of BUCKETS) {
    const { data: rows, error } = await sb
      .from("storage.objects")
      .select("name, created_at")
      .eq("bucket_id", bucket)
      .lt("created_at", CUTOFF);
    if (error) {
      // PostgREST n'expose pas storage.objects par défaut → repli sur une requête SQL directe.
      console.error(`[purge] Impossible de lister ${bucket} via le client (${error.message}) — utiliser execute_sql pour la liste, puis relancer avec --paths.`);
      continue;
    }
    const paths = (rows ?? []).map((r: { name: string }) => r.name);
    console.log(`[purge] ${bucket}: ${paths.length} fichiers avant ${CUTOFF}`);
    if (paths.length === 0) continue;
    if (dry) { console.log(`[purge] --dry : rien supprimé. Exemples: ${paths.slice(0, 3).join(", ")}`); continue; }

    const CHUNK = 100;
    let removed = 0;
    for (let i = 0; i < paths.length; i += CHUNK) {
      const chunk = paths.slice(i, i + CHUNK);
      const { error: rmErr } = await sb.storage.from(bucket).remove(chunk);
      if (rmErr) { console.error(`[purge] ${bucket} chunk ${i}: échec — ${rmErr.message}`); continue; }
      removed += chunk.length;
      console.log(`[purge] ${bucket}: ${removed}/${paths.length} supprimés`);
    }
  }
  console.log("[purge] terminé.");
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
