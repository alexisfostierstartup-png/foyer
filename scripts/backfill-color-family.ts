#!/usr/bin/env npx tsx
/**
 * Peuple metadata.attrs.color_family (blanc/gris/bleu/…) à partir de la couleur STRUCTURÉE
 * (attrs.color ou top_color, Gemini = fiable) — PAS du color_hex (sharp, pollué par la scène).
 * Pur calcul, aucun appel API. Permet le filtre couleur par famille dans l'admin.
 *
 * Usage : npx tsx scripts/backfill-color-family.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  const { createSupabaseAdmin } = await import("../lib/supabase/server");
  const { colorFamily } = await import("../lib/color");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createSupabaseAdmin() as any;
  const PAGE = 1000;
  let from = 0, total = 0, skipped = 0;
  for (;;) {
    const { data } = await sb.from("partner_products").select("id, metadata").not("metadata->>attrs", "is", null).order("id").range(from, from + PAGE - 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data ?? []) as any[];
    if (rows.length === 0) break;
    let idx = 0;
    const CONC = 10;
    await Promise.all(Array.from({ length: CONC }, async () => {
      while (idx < rows.length) {
        const p = rows[idx++];
        const attrs = p.metadata?.attrs ?? {};
        const hex = attrs.color || attrs.top_color || p.metadata?.color_hex;
        const fam = colorFamily(typeof hex === "string" ? hex : null);
        if (!fam) { skipped++; continue; }
        await sb.from("partner_products").update({ metadata: { ...p.metadata, attrs: { ...attrs, color_family: fam } } }).eq("id", p.id);
        total++;
      }
    }));
    console.log(`  …${from + rows.length} lus · ${total} classés · ${skipped} sans couleur`);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  console.log(`\nTOTAL : ${total} produits avec color_family (${skipped} sans couleur exploitable).`);
  process.exit(0);
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
