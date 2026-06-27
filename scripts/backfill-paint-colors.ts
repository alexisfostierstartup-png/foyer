#!/usr/bin/env npx tsx
/**
 * Backfill metadata.color_hex des produits PEINTURE : déduit le hex de la couleur de
 * chaque peinture (depuis features.Couleur ET/OU le nom) via Gemini. Utilisé par le
 * matching peinture par couleur (ΔE). Idempotent (ne touche que ceux sans color_hex).
 *
 * Usage : npx tsx scripts/backfill-paint-colors.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

function stripFences(t: string): string {
  return t.replace(/```json/gi, "").replace(/```/g, "").trim();
}

async function main() {
  const { createSupabaseAdmin } = await import("../lib/supabase/server");
  const { getGeminiClient } = await import("../lib/ai/gemini");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAdmin() as any;

  const { data: rows, error } = await supabase
    .from("partner_products")
    .select("id, name, metadata")
    .eq("category", "paint");
  if (error) {
    console.error("query:", error.message);
    process.exit(1);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const todo = (rows ?? []).filter((p: any) => !p.metadata?.color_hex);
  console.log(`${todo.length} peintures à mapper (sur ${(rows ?? []).length}).`);
  if (todo.length === 0) process.exit(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = todo.map((p: any) => ({
    id: p.id,
    nom: p.name,
    couleur: p.metadata?.features?.Couleur ?? null,
  }));
  const prompt = `Tu es coloriste. Pour chaque peinture d'intérieur ci-dessous, donne le code hexadécimal de SA couleur (déduis-la du champ "couleur" si présent, sinon du nom — ex. "ocre nubie", "vert cardo", "fossil", "greige"). Sois fidèle à la teinte ET la saturation. Réponds en JSON STRICT, uniquement {"<id>":"#RRGGBB"}. Produits : ${JSON.stringify(items)}`;

  const model = getGeminiClient().getGenerativeModel({ model: "gemini-2.5-flash" });
  const res = await model.generateContent(prompt);
  const map = JSON.parse(stripFences(res.response.text())) as Record<string, string>;

  let done = 0;
  for (const p of todo) {
    const hex = map[p.id];
    if (!hex || !/^#?[0-9a-fA-F]{6}$/.test(hex)) continue;
    await supabase
      .from("partner_products")
      .update({ metadata: { ...p.metadata, color_hex: `#${hex.replace(/^#/, "")}` } })
      .eq("id", p.id);
    done++;
  }
  console.log(`✅ color_hex écrit sur ${done}/${todo.length} peintures.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
