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

const WALL_COLORS_PROMPT = `Cette image contient DEUX photos CÔTE À CÔTE : moitié GAUCHE = AVANT (pièce d'origine), moitié DROITE = APRÈS (rendu). Identifie chaque MUR dont la COULEUR DE PEINTURE a CHANGÉ entre AVANT et APRÈS (mur repeint d'une couleur différente). Pour CHAQUE mur repeint, donne sa couleur dans l'APRÈS (DROITE) : son hex (échantillon en MI-TON, sans reflet ni ombre) + un court label (ex. "mur d'accent", "mur du fond"). ⚠️ NE LISTE PAS les murs restés de la même couleur (non repeints). Un mur qui reste blanc/crème/clair — même légèrement plus clair, plus chaud ou plus lumineux dans le rendu — n'est PAS repeint (c'est un simple artefact de rendu) : NE LE LISTE PAS. Ne liste un mur QUE si sa couleur a CLAIREMENT changé : teinte franchement différente, OU nuance nettement plus foncée/saturée. Ne fusionne jamais plusieurs murs de couleurs différentes. Sois fidèle à la teinte ET à la saturation. Ignore plafond, sol, meubles, rideaux, fenêtres. Réponds en JSON STRICT, rien d'autre : {"walls":[{"hex":"#RRGGBB","label":"..."}]}. Si aucun mur n'a changé de couleur : {"walls":[]}.`;

const norm = (h: string) => `#${h.trim().replace(/^#/, "").toLowerCase()}`;

export type WallColor = { hex: string; label: string };

// Compare AVANT|APRÈS (composite) → 1 couleur par mur REPEINT (les murs inchangés sont
// exclus). Pas de moyenne globale entre murs de couleurs différentes.
export async function getChangedWallColors(composite: ImageInput): Promise<WallColor[]> {
  try {
    const res = await getVisionProvider("gemini_vision").analyze(WALL_COLORS_PROMPT, [composite], {
      model: "gemini-2.5-flash",
    });
    const walls = (res.parsed as { walls?: Array<{ hex?: string; label?: string }> } | null)?.walls ?? [];
    const out: WallColor[] = [];
    const seen = new Set<string>();
    for (const w of walls) {
      if (!w.hex || !/^#?[0-9a-fA-F]{6}$/.test(w.hex.trim())) continue;
      const hex = norm(w.hex);
      if (seen.has(hex)) continue;
      seen.add(hex);
      out.push({ hex, label: (w.label ?? "mur").trim() || "mur" });
    }
    return out;
  } catch (e) {
    console.warn("[paintMatch] couleurs murs:", e instanceof Error ? e.message : e);
    return [];
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

  // Seuil de distance couleur : au-delà, ce n'est plus la même famille (ex. mur jaune
  // vs peinture marron) → "À sourcer" plutôt qu'un faux match. ΔE 24 (CIE76) tolère une
  // teinte proche mais moins saturée/claire (ex. mur or/miel #d9b15c → peinture or #E0B22C,
  // ΔE 20.6) tout en rejetant les vraies autres couleurs (ΔE ~30+).
  const MAX_DELTA_E = 24;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scored = (data ?? [])
    .map((r: any) => {
      const lab = hexToLab(r.metadata?.color_hex);
      return { r, dE: lab ? deltaE(targetLab, lab) : Infinity };
    })
    .filter((x: { dE: number }) => x.dE <= MAX_DELTA_E)
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
    // ΔE → score perceptuel. Repères CIE76 : ΔE~2.3 = différence à peine perceptible
    // (JND), ~5 proche, ~15 visible. Courbe choisie pour qu'un BON match (ΔE≤4) lise
    // ~93-96%, un match correct (ΔE~12) ~78%, et descende ensuite.
    similarity: Math.round(Math.max(0, 1 - dE / 55) * 1000) / 1000,
  }));
}
