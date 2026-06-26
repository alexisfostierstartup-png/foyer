#!/usr/bin/env npx tsx
/**
 * color_hex des PEINTURES Luxens (LM) — l'image = un pot CENTRÉ sur un FOND qui EST la
 * couleur de la peinture. Sharp central prend le pot (gris) → faux. On échantillonne la
 * BANDE DU HAUT (le fond = la vraie teinte). Idempotent par --force.
 *
 * Usage : npx tsx scripts/backfill-paint-color.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

async function main() {
  const { createSupabaseAdmin } = await import("../lib/supabase/server");
  const sharp = (await import("sharp")).default;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createSupabaseAdmin() as any;
  const { data } = await sb.from("partner_products").select("id, primary_image_url, metadata").eq("category", "paint").ilike("name", "%luxens%").not("primary_image_url", "is", null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];
  let done = 0, fail = 0, idx = 0;
  const CONC = 8;
  const worker = async () => {
    while (idx < rows.length) {
      const p = rows[idx++];
      try {
        const res = await fetch(p.primary_image_url, { headers: { "User-Agent": UA, Accept: "image/png,image/jpeg,image/webp" } });
        if (!res.ok) { fail++; continue; }
        const buf = Buffer.from(await res.arrayBuffer());
        const m = await sharp(buf).metadata();
        const W = m.width ?? 0, H = m.height ?? 0;
        if (!W || !H) { fail++; continue; }
        // bande du HAUT (fond = couleur), en évitant les bords (cadres éventuels).
        const { data: px } = await sharp(buf)
          .extract({ left: Math.floor(W * 0.05), top: Math.floor(H * 0.03), width: Math.max(1, Math.floor(W * 0.9)), height: Math.max(1, Math.floor(H * 0.1)) })
          .resize(1, 1).raw().toBuffer({ resolveWithObject: true });
        const hex = "#" + [px[0], px[1], px[2]].map((v: number) => v.toString(16).padStart(2, "0")).join("");
        await sb.from("partner_products").update({ metadata: { ...p.metadata, color_hex: hex } }).eq("id", p.id);
        done++;
      } catch { fail++; }
    }
  };
  await Promise.all(Array.from({ length: CONC }, () => worker()));
  console.log(`✓ ${done} peintures Luxens re-colorées (bande haut) · ${fail} échecs`);
  process.exit(0);
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
