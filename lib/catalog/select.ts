/**
 * Sélection QUALITATIVE des candidats avant le 2e appel (détail produit).
 * On ne garde pas "les N premiers" : on filtre la pertinence + le prix, on dédupe,
 * on trie par best-seller (avis × note), et on plafonne par couleur pour la diversité.
 */

export type Candidate = {
  external_id: string;
  url: string;
  title: string;
  price: number | null;
  image: string | null;
  rating?: number | null;
  reviews_count?: number | null;
  is_sponsored?: boolean;
  seller?: string | null;
};

// Termes attendus (garde-fou pertinence) + fourchette de prix saine par catégorie.
const CATEGORY_CONFIG: Record<string, { terms: string[]; min: number; max: number }> = {
  sofa: { terms: ["canapé", "canape", "sofa"], min: 120, max: 2500 },
  armchair: { terms: ["fauteuil"], min: 50, max: 1200 },
  coffee_table: { terms: ["table basse"], min: 25, max: 800 },
  side_table: { terms: ["table d'appoint", "table d’appoint", "bout de canapé", "table d appoint"], min: 15, max: 500 },
  tv_stand: { terms: ["meuble tv", "meuble télé", "meuble tele"], min: 30, max: 900 },
  sideboard: { terms: ["buffet", "bahut", "enfilade"], min: 60, max: 1500 },
  bookshelf: { terms: ["bibliothèque", "bibliotheque", "étagère", "etagere"], min: 25, max: 900 },
  dining_table: { terms: ["table à manger", "table a manger", "table de salle à manger", "table repas"], min: 60, max: 1800 },
  chair: { terms: ["chaise"], min: 20, max: 600 },
  rug: { terms: ["tapis"], min: 15, max: 600 },
  floor_lamp: { terms: ["lampadaire", "lampe sur pied"], min: 20, max: 600 },
  dresser: { terms: ["commode"], min: 50, max: 1200 },
};

const COLORS = [
  "blanc", "noir", "gris", "anthracite", "beige", "taupe", "écru", "ecru", "crème", "creme",
  "marron", "chocolat", "bleu", "vert", "olive", "kaki", "rose", "rouge", "jaune", "orange",
  "terracotta", "moutarde", "chêne", "chene", "naturel", "bois clair", "noyer", "or", "doré", "dore",
];

function colorOf(title: string): string {
  const t = title.toLowerCase();
  return COLORS.find((c) => t.includes(c)) ?? "autre";
}

function bestSellerScore(c: Candidate): number {
  const reviews = c.reviews_count ?? 0;
  const rating = c.rating ?? 0;
  // avis pondérés par la note ; léger malus au sponsorisé pur (placement payé).
  return reviews * Math.max(rating, 0.5) * (c.is_sponsored ? 0.7 : 1);
}

export function selectCandidates(
  candidates: Candidate[],
  category: string,
  target: number,
  opts: { relevance?: boolean } = {},
): Candidate[] {
  const cfg = CATEGORY_CONFIG[category];
  const checkRelevance = opts.relevance !== false; // IKEA : search déjà ciblé → relevance:false

  // 1. Pertinence (titre contient un terme de la catégorie) + prix dans la fourchette.
  let pool = candidates.filter((c) => {
    if (!c.external_id || !c.url || !c.title) return false;
    if (!cfg) return true;
    const t = c.title.toLowerCase();
    const relevant = !checkRelevance || cfg.terms.some((term) => t.includes(term));
    const p = c.price ?? 0;
    return relevant && p >= cfg.min && p <= cfg.max;
  });

  // 2. Dédup quasi-doublons (même vendeur + même début de titre).
  const seen = new Set<string>();
  pool = pool.filter((c) => {
    const key = `${c.seller ?? ""}|${c.title.toLowerCase().split(/\s+/).slice(0, 6).join(" ")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 3. Tri best-seller (avis × note).
  pool.sort((a, b) => bestSellerScore(b) - bestSellerScore(a));

  // 4. Diversité : on prend dans l'ordre best-seller mais en plafonnant par couleur
  //    (évite 200 canapés gris), puis on complète si besoin.
  const colorCap = Math.max(6, Math.ceil(target * 0.28));
  const colorCount = new Map<string, number>();
  const picked: Candidate[] = [];
  const overflow: Candidate[] = [];
  for (const c of pool) {
    if (picked.length >= target) break;
    const col = colorOf(c.title);
    const n = colorCount.get(col) ?? 0;
    if (n < colorCap) {
      picked.push(c);
      colorCount.set(col, n + 1);
    } else {
      overflow.push(c);
    }
  }
  // Complète avec l'overflow (best-seller) si on n'a pas atteint la cible.
  for (const c of overflow) {
    if (picked.length >= target) break;
    picked.push(c);
  }
  return picked;
}
