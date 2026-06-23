#!/usr/bin/env npx tsx
/**
 * Backfill metadata.color_hex : couleur dominante de chaque produit (région centrale de
 * l'image), pour le terme couleur hex/ΔE du matching (Étape 1). Image → sharp, pas de LLM.
 * Idempotent (ne touche que les produits sans color_hex). User-Agent navigateur (cdiscount
 * sert du webp et bloque sinon). Échecs tolérés (produit sans color_hex → pas de bonus).
 *
 * Usage : npx tsx scripts/backfill-color-hex.ts [cat1,cat2|all] [--force]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

async function dominantHex(url: string, sharp: typeof import("sharp")): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "image/avif,image/webp,*/*" } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const m = await sharp(buf).metadata();
    const W = m.width ?? 0, H = m.height ?? 0;
    if (!W || !H) return null;
    // Région centrale 40% → l'objet, en évitant le fond blanc et les bords.
    const px = await sharp(buf)
      .extract({ left: Math.round(W * 0.3), top: Math.round(H * 0.3), width: Math.round(W * 0.4), height: Math.round(H * 0.4) })
      .resize(1, 1).raw().toBuffer();
    return "#" + [px[0], px[1], px[2]].map((x) => x.toString(16).padStart(2, "0")).join("");
  } catch { return null; }
}

async function main() {
  const arg = process.argv[2];
  const force = process.argv.includes("--force");
  const cats = arg && arg !== "all" ? arg.split(",").map((s) => s.trim()) : null;
  const { createSupabaseAdmin } = await import("../lib/supabase/server");
  const sharp = (await import("sharp")).default;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createSupabaseAdmin() as any;

  type Row = { id: string; primary_image_url: string; metadata: Record<string, unknown> | null };
  const rows: Row[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    let q = sb.from("partner_products").select("id, primary_image_url, metadata").not("primary_image_url", "is", null).order("id").range(from, from + PAGE - 1);
    if (cats) q = q.in("category", cats);
    const { data, error } = await q;
    if (error) { console.error(error.message); process.exit(1); }
    const page = (data ?? []) as Row[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  const todo = force ? rows : rows.filter((r) => !(r.metadata && (r.metadata as Record<string, unknown>).color_hex));
  console.log(`${todo.length}/${rows.length} produits à traiter${cats ? ` (cats: ${cats.join(",")})` : ""}.`);

  const CONC = 8;
  let done = 0, ok = 0;
  for (let i = 0; i < todo.length; i += CONC) {
    const batch = todo.slice(i, i + CONC);
    await Promise.all(batch.map(async (p) => {
      const hex = await dominantHex(p.primary_image_url, sharp);
      done++;
      if (!hex) return;
      ok++;
      const md = { ...(p.metadata ?? {}), color_hex: hex };
      await sb.from("partner_products").update({ metadata: md }).eq("id", p.id);
    }));
    if (done % 200 === 0 || done === todo.length) console.log(`  ${done}/${todo.length} (${ok} hex)`);
  }
  console.log(`✅ ${ok}/${todo.length} color_hex calculés.`);
  process.exit(0);
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
