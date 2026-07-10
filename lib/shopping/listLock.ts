import { getElementCategories } from "@/lib/db/assets";
import type { ShoppingItem } from "@/lib/types";

/**
 * VERROU DE LISTE — une proposition déjà montrée à l'utilisateur ne doit jamais
 * être remplacée silencieusement par un recalcul (le re-matching n'est pas
 * reproductible : crops/attrs bougent à chaque analyse → « loterie du refresh »,
 * feedback Alexis 2026-07-10). À l'itération, seuls les items VISÉS par la demande
 * d'édition sont relâchés (« change le sol » ne rejoue pas le canapé).
 *
 * - Snapshot : runIterationPipeline pose lockedShoppingList + pendingReleaseRequests.
 * - Relâche : mapRequestsToCategories fait le lien demande → catégories, en
 *   s'appuyant sur la taxonomie (label_fr + slug + keywords des assets) — aucune
 *   liste de synonymes en dur à maintenir.
 * - Carry-over : carryOverLockedMatches réapplique les matches verrouillés et dit
 *   au pipeline quels items re-matcher.
 */

const norm = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Catégories d'éléments visées par ces demandes d'édition (match par mot entier). */
export async function mapRequestsToCategories(requests: string[]): Promise<Set<string>> {
  const released = new Set<string>();
  if (!requests.length) return released;
  const text = norm(requests.join(" \n "));
  const cats = await getElementCategories();
  for (const c of cats) {
    const terms = [c.label_fr, c.slug.replace(/_/g, " "), ...((c as { keywords?: string[] }).keywords ?? [])]
      .filter(Boolean)
      .map((t) => norm(String(t)));
    // Mot entier (le label "Sol" ne doit pas matcher "solide") ; les labels
    // multi-mots matchent en sous-chaîne ("table basse" dans la phrase).
    const hit = terms.some((t) =>
      t.includes(" ") ? text.includes(t) : new RegExp(`(^|[^a-z])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?([^a-z]|$)`).test(text),
    );
    if (hit) released.add(c.slug);
  }
  // La peinture des murs est re-dérivée à chaque analyse (diff couleur) : toujours
  // relâchée dès qu'on parle de mur/peinture/couleur (l'item paint n'est pas une
  // catégorie d'élément détecté).
  if (/(mur|peintur|peindre|couleur|repein)/.test(text)) {
    released.add("wall");
    released.add("paint");
  }
  return released;
}

/**
 * Applique le verrou au niveau de la COMPOSITION (feedback Alexis 2026-07-10 : un
 * refresh ne doit RIEN changer — ni les matches, ni les lignes elles-mêmes, pour
 * sortir de l'aléa de la vision) :
 *  1. les lignes verrouillées sont reprises TELLES QUELLES (nom, quantité, matches),
 *     sauf celles des catégories explicitement relâchées par une itération ;
 *  2. la nouvelle analyse ne peut qu'AJOUTER : les items des catégories relâchées
 *     (re-matchés) et ceux de catégories ABSENTES du verrou (vraie nouveauté) ;
 *  3. la peinture est toujours reprise de la nouvelle analyse (dérivée du diff
 *     couleur des murs, déterministe et bon marché).
 * Retourne la liste recomposée + les indexes à matcher.
 */
export function carryOverLockedMatches(
  newItems: ShoppingItem[],
  locked: ShoppingItem[] | null | undefined,
  releasedCategories: Set<string>,
  // Libération CIBLÉE par element_id (tap-to-target) : plus précise que la
  // catégorie — seule la ligne désignée est rejouée, ses sœurs restent verrouillées.
  releasedElementIds: Set<string> = new Set(),
): { items: ShoppingItem[]; toMatchIdx: number[] } {
  if (!locked?.length) return { items: newItems, toMatchIdx: newItems.map((_, i) => i) };
  const isReleased = (i: ShoppingItem) =>
    releasedCategories.has(i.category) || (i.elementId != null && releasedElementIds.has(i.elementId));
  const items: ShoppingItem[] = [];
  const toMatchIdx: number[] = [];
  // 1. Lignes verrouillées conservées (hors relâchées et hors peinture).
  for (const l of locked) {
    if (isReleased(l) || l.category === "paint") continue;
    items.push(l);
  }
  const lockedCats = new Set(locked.filter((l) => !isReleased(l)).map((l) => l.category));
  // 2. Apports de la nouvelle analyse.
  for (const it of newItems) {
    if (it.category === "paint" || isReleased(it) || !lockedCats.has(it.category)) {
      items.push(it);
      if (it.category !== "paint") toMatchIdx.push(items.length - 1); // la peinture a son propre matching
    }
  }
  return { items, toMatchIdx };
}
