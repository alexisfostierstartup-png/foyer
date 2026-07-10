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
    const exactMatch: ProductMatch | null = piece.match
      ? { ...piece.match, similarity: 1 }
      : piece.imageUrl
        ? { id: `custom-${piece.category}`, name: piece.name, category: piece.category, merchant: "custom",
            source_type: "custom", price: null, primary_image_url: piece.imageUrl, product_url: null, similarity: 1 }
        : null;
    if (idx >= 0) {
      const it = { ...out[idx], integrated: true };
      if (exactMatch) it.matches = [exactMatch, ...(it.matches ?? []).filter((m) => m.id !== exactMatch.id)];
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
