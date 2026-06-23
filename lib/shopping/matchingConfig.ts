/**
 * Poids & seuils du matching blend, PAR CATÉGORIE et PAR SOURCE — config data-driven
 * (table assets, category='matching_weights'), pas de logique en dur par cas.
 *
 * - image_weight (w) : part du cosine IMAGE (crop↔produit) dans le score blend.
 *   Le reste (1−w) va au cosine TEXTE (description↔texte produit). Réglé par SOURCE :
 *   neuf = belles photos → image domine ; occasion = photos médiocres → vers le texte.
 * - min_score : seuil d'affichage. Sous ce seuil → "À sourcer" (pas de faux produit).
 *
 * Règle GÉNÉRALE = slug 'default'. Règle SPÉCIFIQUE par catégorie = slug = catégorie
 * (ex. 'floor' baisse w → le motif "chevron/point de hongrie" se joue dans la
 * description, où l'image discrimine mal). Ajouter une règle = insérer une ligne assets,
 * aucune modif de code.
 */
import { createSupabaseAdmin } from "@/lib/supabase/server";

export type SourceScalars = { eco_new: number; secondhand: number };
// color.weight = part du score couleur dans le re-ranking (0 = couleur ignorée).
// color.threshold = ΔE au-delà duquel la couleur ne rapporte plus rien (latitude perceptuelle).
export type MatchingWeights = {
  image_weight: SourceScalars;
  min_score: SourceScalars;
  color: { weight: number; threshold: number };
};

// Repli si la table assets est vide / injoignable (= comportement neuf-photo standard).
export const DEFAULT_WEIGHTS: MatchingWeights = {
  image_weight: { eco_new: 0.7, secondhand: 0.5 },
  min_score: { eco_new: 0.7, secondhand: 0.55 },
  color: { weight: 0.3, threshold: 28 },
};

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

// Tolère une config partielle : complète chaque champ manquant par le défaut.
function normalize(data: unknown): MatchingWeights {
  const d = (data ?? {}) as Record<string, unknown>;
  const iw = (d.image_weight ?? {}) as Record<string, unknown>;
  const ms = (d.min_score ?? {}) as Record<string, unknown>;
  const co = (d.color ?? {}) as Record<string, unknown>;
  return {
    image_weight: {
      eco_new: num(iw.eco_new, DEFAULT_WEIGHTS.image_weight.eco_new),
      secondhand: num(iw.secondhand, DEFAULT_WEIGHTS.image_weight.secondhand),
    },
    min_score: {
      eco_new: num(ms.eco_new, DEFAULT_WEIGHTS.min_score.eco_new),
      secondhand: num(ms.secondhand, DEFAULT_WEIGHTS.min_score.secondhand),
    },
    color: {
      weight: num(co.weight, DEFAULT_WEIGHTS.color.weight),
      threshold: num(co.threshold, DEFAULT_WEIGHTS.color.threshold),
    },
  };
}

let cache: Map<string, MatchingWeights> | null = null;

async function loadAll(): Promise<Map<string, MatchingWeights>> {
  if (cache) return cache;
  const m = new Map<string, MatchingWeights>();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createSupabaseAdmin() as any;
    const { data } = await supabase
      .from("assets")
      .select("slug, data")
      .eq("category", "matching_weights")
      .eq("is_active", true);
    for (const r of data ?? []) m.set(r.slug, normalize(r.data));
  } catch (e) {
    console.warn("[matchingConfig] lecture assets échouée, défauts:", e instanceof Error ? e.message : e);
  }
  if (!m.has("default")) m.set("default", DEFAULT_WEIGHTS);
  cache = m;
  return m;
}

/** Poids/seuils pour une catégorie catalogue : règle spécifique sinon 'default'. */
export async function getMatchingWeights(category: string): Promise<MatchingWeights> {
  const all = await loadAll();
  return all.get(category) ?? all.get("default") ?? DEFAULT_WEIGHTS;
}

/** Seuil d'affichage selon la source d'un produit donné. */
export function minScoreForSource(w: MatchingWeights, sourceType: string): number {
  return sourceType === "secondhand" ? w.min_score.secondhand : w.min_score.eco_new;
}
