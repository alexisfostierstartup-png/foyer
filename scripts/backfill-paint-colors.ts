#!/usr/bin/env npx tsx
/**
 * Backfill metadata.color_hex des produits PEINTURE : mappe le nom de teinte FR
 * (features.Couleur, ex. "Vert sauge") → hex via Gemini. Utilisé par le matching
 * peinture par couleur (ΔE). Idempotent (ne touche que ceux sans color_hex).
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
  const colorOf = (p: any): string | null =>
    p.metadata?.features?.Couleur || p.metadata?.features?.["Couleur"] || null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const todo = (rows ?? []).filter((p: any) => !p.metadata?.color_hex && colorOf(p));
  console.log(`${todo.length} peintures à mapper (sur ${(rows ?? []).length}).`);
  if (todo.length === 0) process.exit(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const names = [...new Set(todo.map(colorOf).filter(Boolean))] as string[];
  const prompt = `Tu es coloriste. Donne le code hexadécimal approximatif de chaque teinte de peinture d'intérieur (noms FR). Réponds en JSON STRICT, uniquement un objet {"<nom exact>":"#RRGGBB"}. Teintes : ${JSON.stringify(names)}`;

  const model = getGeminiClient().getGenerativeModel({ model: "gemini-2.5-flash-lite" });
  const res = await model.generateContent(prompt);
  const map = JSON.parse(stripFences(res.response.text())) as Record<string, string>;
  console.log("Hex obtenus :", map);

  let done = 0;
  for (const p of todo) {
    const name = colorOf(p);
    const hex = name ? map[name] : null;
    if (!hex || !/^#?[0-9a-fA-F]{6}$/.test(hex)) continue;
    await supabase
      .from("partner_products")
      .update({ metadata: { ...p.metadata, color_hex: `#${hex.replace(/^#/, "")}` } })
      .eq("id", p.id);
    done++;
  }
  console.log(`✅ color_hex écrit sur ${done} peintures.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
