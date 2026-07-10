#!/usr/bin/env npx tsx
/**
 * AUDIT + PERSIST attrs Gemini, généralisé multi-marchand/multi-catégorie (variante de
 * scripts/_ikea/probe-attrs.ts, qui filtrait merchant='ikea' en dur). Séquentiel (PAS de
 * concurrence — contrairement à backfill-attrs.ts) pour que le "stop au 1er unknown" soit
 * déterministe. Persiste chaque produit AVANT de rencontrer un unknown (merge dans
 * metadata.attrs, préserve color_family/color_families déjà présents), saute les produits
 * déjà faits (metadata.attrs_model).
 *
 * S'ARRÊTE (tout le run, pas juste la catégorie courante) :
 *  - au 1er "unknown" sur un enum non accepté → affiche produit/image/attrs/attribut en
 *    cause, à corriger dans attributeSchemaV3.ts puis relancer (reprend sans perte).
 *  - si erreur quota/billing Gemini détectée (isTransientAiError renvoie false dessus) →
 *    message clair "crédits épuisés", pour que l'utilisateur sache s'il doit recharger.
 *
 * Usage :
 *   npx tsx scripts/audit-attrs.ts --merchants=maisons_du_monde,cyrillus [--lite]
 *     [--categories=sofa,armchair,...] [--accept=legs_material] [--coerce=legs_type:none]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
// gemini-2.5-flash-lite n'est plus accessible aux nouvelles clés API ("no longer available
// to new users", 404, vérifié 2026-07-10) → alias stable "gemini-flash-lite-latest" (pointe
// sur gemini-3.1-flash-lite au moment du fix), survit aux dépréciations futures de version.
const MODEL = process.argv.includes("--lite") ? "gemini-flash-lite-latest" : "gemini-2.5-flash";

// Même ordre de priorité que scripts/import-effinity-7.ts (gros mobilier → luminaires → déco).
const DEFAULT_CATEGORIES = [
  "sofa", "armchair", "chair", "coffee_table", "dining_table", "side_table",
  "sideboard", "dresser", "bookshelf", "stool", "desk", "bed", "dressing_table", "nightstand",
  "bench", "pouf", "headboard", "display_cabinet", "tv_stand", "bar_cabinet", "room_divider",
  "rug", "curtains",
  "pendant_lamp", "table_lamp", "wall_sconce", "floor_lamp",
  "mirror", "vase", "decorative_object", "cushion",
];

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /quota|billing|exceeded your current quota|insufficient/i.test(msg);
}

async function main() {
  const merchants = (process.argv.find((a) => a.startsWith("--merchants="))?.slice(12) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (merchants.length === 0) { console.error("Usage: audit-attrs.ts --merchants=m1,m2 [--categories=c1,c2] [--lite] [--accept=k1,k2] [--coerce=k:v,k2:v2]"); process.exit(1); }
  const categories = (process.argv.find((a) => a.startsWith("--categories="))?.slice(14) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const cats = categories.length > 0 ? categories : DEFAULT_CATEGORIES;
  const accept = new Set((process.argv.find((a) => a.startsWith("--accept="))?.slice(9) ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  const coerce: Record<string, string> = {};
  for (const pair of (process.argv.find((a) => a.startsWith("--coerce="))?.slice(9) ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const [k, v] = pair.split(":"); if (k && v) coerce[k] = v;
  }

  const { createSupabaseAdmin } = await import("../lib/supabase/server");
  const { getVisionProvider } = await import("../lib/ai/provider");
  const { withTracking } = await import("../lib/ai/track");
  const { getSchemaV3, schemaForCategory, buildExtractionPrompt } = await import("../lib/shopping/attributeSchemaV3");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createSupabaseAdmin() as any;

  console.log(`[audit-attrs] démarrage ${new Date().toISOString()} — marchands=${merchants.join(",")} modèle=${MODEL} catégories=${cats.length}`);

  let grandTotal = 0, grandFail = 0, grandCost = 0;

  // Throttle tier gratuit Gemini : 10 req/min constaté sur l'ancienne clé (cf. erreur
  // RESOURCE_EXHAUSTED "GenerateRequestsPerMinutePerProjectPerModel-FreeTier"). Conditionné
  // sur --lite (pas sur le nom du modèle, qui a changé le 2026-07-10 après dépréciation de
  // gemini-2.5-flash-lite) — nouvelle clé jamais vérifiée à cette limite, on garde la marge
  // de sécurité par défaut plutôt que de supposer une limite différente sans preuve.
  const RATE_LIMIT_MS = process.argv.includes("--lite") ? 6500 : 0;
  let lastCallAt = 0;
  async function throttle() {
    if (RATE_LIMIT_MS <= 0) return;
    const wait = lastCallAt + RATE_LIMIT_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
  }

  const extract = async (prompt: string, url: string): Promise<Record<string, unknown> | null> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await throttle();
        const buf = Buffer.from(await (await fetch(url, { headers: { "User-Agent": UA, Accept: "image/jpeg,image/webp" } })).arrayBuffer());
        const res = await withTracking(
          { step: "other", provider: "gemini_vision", requestPayload: { model: MODEL, purpose: "attrs_extraction" } },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          () => getVisionProvider("gemini_vision").analyze(prompt, [buf as any], { model: MODEL }),
        );
        return (res.parsed ?? null) as Record<string, unknown> | null;
      } catch (e) {
        if (isQuotaError(e)) {
          console.error(`\n💳 CRÉDITS ÉPUISÉS (Gemini) — ${e instanceof Error ? e.message : e}`);
          console.error(`[audit-attrs] Arrêt — ${grandTotal} attrs déjà persistés (rien perdu), recharge puis relance la même commande pour reprendre.`);
          process.exit(3);
        }
        if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
      }
    }
    return null;
  };

  for (const cat of cats) {
    const schema = getSchemaV3(schemaForCategory(cat));
    const enumKeys = schema.filter((a) => a.type === "enum").map((a) => a.key);
    const prompt = buildExtractionPrompt(schema);

    for (const merchant of merchants) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[] = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data } = await sb.from("partner_products")
          .select("id, name, primary_image_url, product_url, metadata")
          .eq("merchant", merchant).eq("category", cat).order("id").range(from, from + PAGE - 1);
        const page = data ?? [];
        rows.push(...page);
        if (page.length < PAGE) break;
      }
      if (rows.length === 0) continue;

      let done = 0, skipped = 0, fail = 0;
      const naCount: Record<string, number> = {};
      for (const p of rows) {
        if (p.metadata?.attrs_model) { skipped++; continue; }
        const attrs = await extract(prompt, p.primary_image_url);
        if (!attrs) { fail++; grandFail++; console.log(`  ✗ extraction échouée — ${merchant}/${cat} — ${p.name}`); continue; }

        for (const [k, v] of Object.entries(coerce)) if (String(attrs[k]).toLowerCase() === "unknown") attrs[k] = v;
        const unknowns = enumKeys.filter((k) => String(attrs[k]).toLowerCase() === "unknown" && !accept.has(k));
        for (const k of enumKeys) if (String(attrs[k]).toLowerCase() === "n/a") naCount[k] = (naCount[k] ?? 0) + 1;

        if (unknowns.length > 0) {
          console.log(`\n🛑 UNKNOWN — ${grandTotal} déjà persistés au total (${done} sur ${merchant}/${cat})`);
          console.log(`   Marchand/Cat : ${merchant} / ${cat}`);
          console.log(`   Produit      : ${p.name}`);
          console.log(`   Image        : ${p.primary_image_url}`);
          console.log(`   URL          : ${p.product_url}`);
          console.log(`   Attrs        : ${JSON.stringify(attrs)}`);
          console.log(`   ⚠️  unknown sur : ${unknowns.join(", ")}`);
          console.log(`   (n/a cumulés sur cette catégorie : ${JSON.stringify(naCount)})`);
          console.log(`   → enrichir attributeSchemaV3.ts (vocab manquant) puis RELANCER la même commande (reprend sans perte).`);
          process.exit(2);
        }

        const merged = { ...(p.metadata?.attrs ?? {}), ...attrs };
        await sb.from("partner_products").update({ metadata: { ...(p.metadata ?? {}), attrs: merged, attrs_model: MODEL } }).eq("id", p.id);
        done++; grandTotal++;
        if (done % 50 === 0) console.log(`  ${merchant}/${cat}: ${done}/${rows.length} (total global: ${grandTotal})`);
      }
      console.log(`✓ ${merchant.padEnd(16)} ${cat.padEnd(15)} ${done} extraits · ${skipped} déjà faits · ${fail} échecs`);
    }
  }

  console.log(`\n[audit-attrs] TERMINÉ ${new Date().toISOString()} — ${grandTotal} attrs extraits au total, ${grandFail} échecs, coût: voir ai_calls (request_payload->>'purpose'='attrs_extraction').`);
  process.exit(0);
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
