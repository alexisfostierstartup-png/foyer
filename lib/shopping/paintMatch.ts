/**
 * Matching PEINTURE par COULEUR (pas par image — le cosine visuel est inutile pour
 * de la peinture). On lit la couleur dominante des murs dans le rendu (Gemini), et on
 * la compare en ΔE (CIELAB) à la couleur de chaque produit peinture (metadata.color_hex,
 * pré-calculée depuis features.Couleur). Le plus proche en teinte gagne.
 */
import { getVisionProvider } from "@/lib/ai/provider";
import type { ImageInput } from "@/lib/ai/types";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { hexToLab, deltaE } from "@/lib/color";
import type { ProductMatch } from "@/lib/types";

const WALL_COLOR_PROMPT = `Tu analyses la photo d'une pièce rénovée. Donne la couleur DOMINANTE des MURS peints (ignore le sol, le plafond, les meubles, les fenêtres). Réponds en JSON STRICT, rien d'autre : {"wall_hex":"#RRGGBB"}. Donne toujours un hex précis, même pour un mur blanc/neutre (ex. {"wall_hex":"#F2EFE9"}).`;

const norm = (h: string) => `#${h.trim().replace(/^#/, "").toLowerCase()}`;

export async function getWallColorFromRender(renderImage: ImageInput): Promise<string | null> {
  try {
    const res = await getVisionProvider("gemini_vision").analyze(WALL_COLOR_PROMPT, [renderImage], {
      model: "gemini-2.5-flash-lite",
    });
    const hex = (res.parsed as { wall_hex?: string } | null)?.wall_hex;
    return hex && /^#?[0-9a-fA-F]{6}$/.test(hex.trim()) ? norm(hex) : null;
  } catch (e) {
    console.warn("[paintMatch] couleur mur:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function matchPaintByColor(targetHex: string, topN = 4): Promise<ProductMatch[]> {
  const targetLab = hexToLab(targetHex);
  if (!targetLab) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAdmin() as any;
  const { data, error } = await supabase
    .from("partner_products")
    .select("id,name,category,merchant,source_type,price,primary_image_url,product_url,metadata")
    .eq("category", "paint")
    .eq("availability_status", "available")
    .not("metadata->>color_hex", "is", null);
  if (error) {
    console.warn("[paintMatch] requête:", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scored = (data ?? [])
    .map((r: any) => {
      const lab = hexToLab(r.metadata?.color_hex);
      return { r, dE: lab ? deltaE(targetLab, lab) : Infinity };
    })
    .filter((x: { dE: number }) => Number.isFinite(x.dE))
    .sort((a: { dE: number }, b: { dE: number }) => a.dE - b.dE)
    .slice(0, topN);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return scored.map(({ r, dE }: { r: any; dE: number }) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    merchant: r.merchant,
    source_type: r.source_type,
    price: r.price != null ? Number(r.price) : null,
    primary_image_url: r.primary_image_url ?? null,
    product_url: r.product_url ?? null,
    // ΔE → score lisible : 0 = identique, ~30 = très différent.
    similarity: Math.round(Math.max(0, 1 - dE / 30) * 1000) / 1000,
  }));
}
