import type { ShoppingItem, ExpertIntegratedPiece, ProductMatch } from "@/lib/types";

/**
 * Garantit que chaque pièce RÉELLEMENT intégrée au rendu expert a sa ligne dans la
 * liste de courses, avec le produit EXACT en tête (similarity 1 = choix acté).
 * Idempotent. Appliqué (1) au swap expert (expert.ts), (2) à chaque reconstruction
 * de liste (buildMatchesAndScore) — c'est le verrou qui corrige le bug « meuble
 * visible dans le rendu expert mais absent de la liste de courses » : la liste ne
 * peut plus perdre ces lignes, quel que soit le re-gating vision du rendu fictif.
 * Module séparé pour éviter le cycle d'import pipeline ↔ expert.
 */
export function enforceExpertIntegratedPieces(
  items: ShoppingItem[],
  integrated: ExpertIntegratedPiece[] | null | undefined,
): ShoppingItem[] {
  if (!integrated?.length) return items;
  // Reset des épinglages d'un run précédent : seul le DERNIER swap fait foi (un
  // re-render peut retirer une pièce du swap — sa ligne ne doit plus être `integrated`).
  const out = items.map((it) => (it.integrated ? { ...it, integrated: undefined } : it));
  for (const piece of integrated) {
    const idx = out.findIndex(
      (it) => (piece.elementId && it.elementId === piece.elementId) || it.category === piece.category,
    );
    // La similarity du produit intégré n'est PAS forcée à 1. Elle l'était, et comme la
    // liste est persistée, chaque épinglage laissait derrière lui un produit figé à
    // 100 % : au bout de deux swaps, DEUX produits affichaient 100 % et le top-1
    // n'était plus celui du rendu (projet 51NekyJs0Qt, QA Alexis 2026-07-12). On se
    // contente de le remonter en tête — sa position DIT déjà qu'il est le choisi, et
    // le pourcentage reste une mesure honnête. (Un produit sur-mesure n'a pas de score
    // mesurable : 1 est alors légitime.)
    const exactMatch: ProductMatch | null = piece.match
      ? { ...piece.match }
      : piece.imageUrl
        ? { id: `custom-${piece.category}`, name: piece.name, category: piece.category, merchant: "custom",
            source_type: "custom", price: null, primary_image_url: piece.imageUrl, product_url: null, similarity: 1 }
        : null;
    if (idx >= 0) {
      const it = { ...out[idx], integrated: true };
      if (exactMatch) {
        // DÉPLACER en tête, pas empiler : si le produit est déjà dans matches, on garde
        // SA version (score d'origine) et on la remonte, au lieu d'insérer un doublon.
        const existing = (it.matches ?? []).find((m) => m.id === exactMatch.id);
        const head = existing ?? exactMatch;
        it.matches = [head, ...(it.matches ?? []).filter((m) => m.id !== exactMatch.id)];
      }
      out[idx] = it;
    } else {
      out.push({
        id: `expert-${piece.category}-${piece.elementId ?? "added"}`,
        name: piece.name,
        category: piece.category,
        detail: "",
        priceMin: piece.match?.price ?? 0,
        priceMax: piece.match?.price ?? 0,
        source: "new",
        merchants: [],
        imgUrl: piece.imageUrl,
        elementId: piece.elementId ?? undefined,
        integrated: true,
        matches: exactMatch ? [exactMatch] : [],
      } as ShoppingItem);
    }
  }
  return out;
}
