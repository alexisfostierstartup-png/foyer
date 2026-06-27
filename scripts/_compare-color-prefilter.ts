#!/usr/bin/env npx tsx
/**
 * Comparaison A/B du pré-filtre couleur (v1 sans filtre ↔ v2 filtre par familles), rejoué
 * sur les items réels des derniers projets (LECTURE SEULE, aucune mutation). Pour chaque item
 * shoppable couleur-sensible : top-N v1 vs v2 côte à côte. v1 = même appel SANS colorHex
 * (→ pré-filtre désactivé, scoring attrs identique) ; v2 = AVEC colorHex.
 *
 * Usage : npx tsx scripts/_compare-color-prefilter.ts [projectId ...]   (défaut: 2 derniers)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

type Item = { category: string; description: string; colorHex?: string | null; attrs?: Record<string, unknown> | null };

async function main() {
  const argIds = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const { createSupabaseAdmin } = await import("../lib/supabase/server");
  const { matchPartnerProductsBlendBatch } = await import("../lib/shopping/partnerMatch");
  const { colorFamiliesQuery } = await import("../lib/color");
  const { getMatchingWeights } = await import("../lib/shopping/matchingConfig");
  const { MATCH_COLOR_FAMILY_MIN_WEIGHT } = await import("../lib/constants");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createSupabaseAdmin() as any;

  let ids = argIds;
  if (ids.length === 0) {
    const { data } = await sb.from("foyer_projects").select("id").order("updated_at", { ascending: false }).limit(2);
    ids = (data ?? []).map((r: { id: string }) => r.id);
  }
  console.log(`Projets comparés : ${ids.join(", ")}\n${"=".repeat(80)}`);

  for (const pid of ids) {
    const { data: proj } = await sb.from("foyer_projects").select("data").eq("id", pid).single();
    const room = proj?.data?.roomType ?? "?";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list: any[] = proj?.data?.shoppingList ?? [];
    const items: Item[] = list.map((it) => ({
      category: it.category,
      description: it.name ?? "",
      colorHex: it.elementAttrs?.color ?? null,
      attrs: it.elementAttrs ?? null,
    }));
    console.log(`\n### Projet ${pid} (${room}) — ${items.length} items\n`);

    // Lesquels seront RÉELLEMENT filtrés (cat couleur-sensible + hex présent) ?
    const flags = await Promise.all(items.map(async (it) => {
      const w = await getMatchingWeights(it.category).catch(() => null);
      return !!it.colorHex && !!w && w.color.weight >= MATCH_COLOR_FAMILY_MIN_WEIGHT;
    }));

    const v2 = await matchPartnerProductsBlendBatch(items, 5);                                   // avec colorHex → pré-filtre
    const v1 = await matchPartnerProductsBlendBatch(items.map(({ colorHex, ...r }) => r), 5);    // sans colorHex → v1

    items.forEach((it, i) => {
      const a = v1[i] ?? [], b = v2[i] ?? [];
      if (a.length === 0 && b.length === 0) return; // non shoppable / vide
      if (!flags[i]) { console.log(`— ${it.category}: pré-filtre INACTIF (cat forme-dominante ou couleur élément absente) → identique\n`); return; }
      const fams = colorFamiliesQuery(it.colorHex);
      const idsA = new Set(a.map((m) => m.id)), idsB = new Set(b.map((m) => m.id));
      const pruned = a.filter((m) => !idsB.has(m.id)).length;   // sortis par v2
      const promoted = b.filter((m) => !idsA.has(m.id)).length; // entrés via v2
      console.log(`▶ ${it.category}  «${it.description.slice(0, 40)}»  élément ${it.colorHex} → familles ${JSON.stringify(fams)}`);
      const row = (m: { similarity: number; colorHex?: string | null; name: string }) =>
        `    ${m.similarity.toFixed(3)}  ${(m.colorHex || "?").padEnd(8)} ${m.name.slice(0, 46)}`;
      console.log(`  v1 (sans pré-filtre):`);  a.forEach((m) => console.log(row(m)));
      console.log(`  v2 (pré-filtre couleur):`); b.forEach((m) => console.log(row(m)));
      console.log(`  Δ : ${pruned} sorti(s) par v2, ${promoted} promu(s)\n`);
    });
  }
  process.exit(0);
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
