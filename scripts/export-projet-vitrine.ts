#!/usr/bin/env npx tsx
/**
 * Fige un projet en VITRINE publique (data/projets/<slug>.json).
 *
 * Pourquoi figer plutôt que lire la base : la vitrine ne doit pas bouger quand on
 * retouche le projet, et un rendu raté ne doit jamais s'afficher publiquement.
 * On ne garde que le TOP-1 de chaque ligne : la page est en lecture seule.
 *
 * Usage : npx tsx scripts/export-projet-vitrine.ts <projectId> <slug>
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

async function main() {
  const [projectId, slug] = process.argv.slice(2);
  if (!projectId || !slug) {
    console.error("Usage: npx tsx scripts/export-projet-vitrine.ts <projectId> <slug>");
    process.exit(1);
  }

  const { getProject } = await import("@/lib/storage/projects");
  const p = await getProject(projectId);
  if (!p) throw new Error("projet introuvable");

  const list = p.shoppingList ?? [];
  const picks = (p.productPicks ?? {}) as Record<string, string>;

  const items = list
    .map((it) => {
      const pickedId = it.elementId ? picks[it.elementId] : undefined;
      const m = (pickedId ? it.matches?.find((x) => x.id === pickedId) : undefined) ?? it.matches?.[0];
      if (!m) return null;
      return {
        category: it.category,
        detected: it.name,
        quantity: it.quantity ?? 1,
        source: it.source, // new | secondhand | diy
        product: {
          name: m.name,
          price: m.price,
          merchant: m.merchant,
          imageUrl: m.primary_image_url,
          url: m.product_url,
        },
      };
    })
    .filter(Boolean);

  const total = items.reduce(
    (s, i) => s + (typeof i!.product.price === "number" ? i!.product.price * i!.quantity : 0),
    0,
  );

  const out = {
    slug,
    projectId,
    // Images SERVIES DEPUIS public/ : les rendus en storage sont écrasés à chaque
    // nouveau swap (même chemin) — une vitrine ne peut pas dépendre de ça.
    beforeUrl: "/landing/test4.jpeg",
    afterUrl: "/landing/test4_apres.png",
    items,
    totalEstimated: Math.round(total),
    score: p.scoreFoyer ?? null,
  };

  const path = `data/projets/${slug}.json`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(out, null, 2));

  console.log(`✅ ${path}`);
  console.log(`   ${items.length} articles · total ${out.totalEstimated} €`);
  for (const i of items) {
    console.log(`   · ${String(i!.category).padEnd(15)} ${i!.product.name?.slice(0, 42).padEnd(44)} ${i!.product.price ?? "?"} €${i!.quantity > 1 ? ` ×${i!.quantity}` : ""}`);
  }
}
main().catch((e) => { console.error("erreur:", e); process.exit(1); });
