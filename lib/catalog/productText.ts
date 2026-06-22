/**
 * buildProductText — texte canonique d'un produit pour l'embedding TEXTE (jina-clip-v2).
 *
 * Réutilisé par le SYNC (lib/catalog/ingest.ts) ET le backfill
 * (scripts/backfill-text-embeddings.ts) → une seule source de vérité : si on enrichit
 * le texte ici, sync et backfill restent cohérents.
 *
 * Objectif : donner au terme TEXTE du matching de quoi rattraper l'image quand celle-ci
 * trompe (élément vu de dos, occlusion, photo médiocre). On concatène name + description
 * + les SPECS pertinentes (couleur, matière, dimensions, marque, style, finition, forme),
 * en restant AGNOSTIQUE du marchand : on scanne les objets de specs de n'importe quelle
 * source (cdiscount `specifications`, Leroy Merlin `features`, IKEA clés à plat) au lieu de
 * coder en dur le schéma de chacun.
 */

export type ProductTextInput = {
  name: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
};

// Clés de specs pertinentes pour le matching VISUEL/SÉMANTIQUE. On ignore tout le reste
// (garanties, EAN, mentions légales, montage, poids colis…) — bruit qui dilue l'embedding.
const SPEC_KEY =
  /couleur|color|coloris|mati[èe]re|material|composition|tissu|essence|\bbois\b|finition|forme|shape|style|dimension|taille|largeur|hauteur|profondeur|longueur|width|height|depth|diam|marque|brand|mod[èe]le|\bmodel\b/i;

// Valeurs à exclure même si la clé matche : réponses binaires / génériques sans signal visuel.
const NOISE_VAL = /^(non|oui|n\/a|-+|aucune?|adulte|enfant|int[ée]rieur|ext[ée]rieur|standard|néant)$/i;

const MAX_VALUE_LEN = 50; // au-delà = phrase/énumération → bruit, pas une spec.
const MAX_SPECS = 14; // garde-fou : on ne noie pas name+description sous 40 specs.

function stringifySpecValue(v: unknown): string | null {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  // ex. IKEA dimensions = { width: "80 cm", height: "202 cm", depth: "30 cm" }
  if (v && typeof v === "object") {
    const vals = Object.values(v as Record<string, unknown>)
      .map((x) => (typeof x === "string" || typeof x === "number" ? String(x).trim() : ""))
      .filter(Boolean);
    return vals.length ? vals.join(" × ") : null;
  }
  return null;
}

function collectSpecs(obj: unknown, out: string[]): void {
  if (!obj || typeof obj !== "object") return;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (!SPEC_KEY.test(k)) continue;
    const val = stringifySpecValue(v);
    if (!val || val.length > MAX_VALUE_LEN || NOISE_VAL.test(val)) continue;
    out.push(val);
  }
}

export function buildProductText(p: ProductTextInput): string {
  const parts: string[] = [];
  if (p.name?.trim()) parts.push(p.name.trim());
  if (p.description?.trim()) parts.push(p.description.trim());

  const md = (p.metadata ?? {}) as Record<string, unknown>;
  const specs: string[] = [];

  // Marque : présente à plat chez tous les marchands (brand).
  if (typeof md.brand === "string" && md.brand.trim() && !/^aucune?$/i.test(md.brand.trim())) {
    specs.push(md.brand.trim());
  }
  // Objets de specs structurés (selon le marchand) + clés à plat (IKEA: color, model, dimensions).
  collectSpecs(md.specifications, specs); // cdiscount
  collectSpecs(md.features, specs); // leroy_merlin
  collectSpecs(md, specs); // ikea (color/model/dimensions) + tout marchand à plat

  // Dédup insensible à la casse, en préservant l'ordre (name-proches d'abord).
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const s of specs) {
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(s);
    if (deduped.length >= MAX_SPECS) break;
  }
  if (deduped.length) parts.push(deduped.join(", "));

  return parts.join(". ").replace(/\s+/g, " ").trim();
}
