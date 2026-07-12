import type { Project, ProductMatch } from "@/lib/types";

/**
 * TOP-1 d'une liste de courses, côté serveur.
 *
 * Rejoue EXACTEMENT ce que /final affiche (components/create/FinalScreen.tsx) :
 *  1. dédoublonnage par `id` (des données en cache ont déjà contenu des doublons) ;
 *  2. un produit imposé par l'utilisateur (`customProducts`, clé = elementId) PRIME sur le
 *     matching : c'est lui qui porte le prix, le match correspondant l'ayant perdu (il
 *     ressort avec merchant « custom » et price null) ;
 *  3. sinon le produit retenu est celui de `productPicks`, résolu par ID — jamais par
 *     indice (l'indice bougeait d'un recalcul à l'autre : le rendu montrait un produit, la
 *     liste en affichait un autre) ; repli sur `matches[0]` ;
 *  4. total = prix × quantité ; un article sans prix n'est PAS compté (il est « à
 *     sourcer ») mais reste visible dans la liste.
 *
 * Toute page qui affiche cette liste doit passer par ici, sinon elle annonce un total
 * différent de celui du parcours.
 */

export type TopPick = {
  id: string;
  elementId?: string;
  category: string;
  /** Ce que la vision a détecté dans le rendu (« canapé d'angle gris »). */
  detected: string;
  quantity: number;
  /** new | secondhand | diy */
  source: string;
  product: {
    name: string;
    price: number | null;
    merchant: string | null;
    imageUrl: string | null;
    url: string | null;
  } | null;
};

export type TopPicks = {
  items: TopPick[];
  /** Somme des prix × quantités, articles sans prix exclus. */
  total: number;
  /** Nombre d'articles sans prix (« à sourcer »). */
  sansPrix: number;
};

export function resolveTopPicks(project: Project): TopPicks {
  const list = project.shoppingList ?? [];
  const picks = (project.productPicks ?? {}) as Record<string, string>;
  const customs = project.customProducts ?? {};

  const seen = new Set<string>();
  const items: TopPick[] = [];

  for (const it of list) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);

    const custom = it.elementId ? customs[it.elementId] : undefined;

    const pickedId = it.elementId ? picks[it.elementId] : undefined;
    const m: ProductMatch | undefined =
      (pickedId ? it.matches?.find((x) => x.id === pickedId) : undefined) ?? it.matches?.[0];

    const product = custom
      ? {
          name: custom.name ?? it.name,
          price: custom.price ?? null,
          merchant: custom.merchant ?? null,
          imageUrl: custom.imageUrl ?? null,
          url: custom.url ?? null,
        }
      : m
        ? {
            name: m.name,
            price: m.price,
            merchant: m.merchant,
            imageUrl: m.primary_image_url,
            url: m.product_url,
          }
        : null;

    items.push({
      id: it.id,
      elementId: it.elementId,
      category: it.category,
      detected: it.name,
      quantity: it.quantity ?? 1,
      source: it.source,
      product,
    });
  }

  let total = 0;
  let sansPrix = 0;
  for (const i of items) {
    if (typeof i.product?.price === "number") total += i.product.price * i.quantity;
    else sansPrix += i.quantity;
  }

  return { items, total: Math.round(total), sansPrix };
}

/**
 * L'image réellement montrée à l'utilisateur : le rendu expert quand il existe, sinon le
 * rendu IA. Même règle que lib/shopping/hotspots.ts — les deux doivent rester d'accord,
 * sinon on épinglerait des produits sur une image qui n'est pas celle-là.
 */
export function displayedRenderUrl(project: Project): string | null {
  if (project.mode === "expert" && project.expertRenderUrl) return project.expertRenderUrl;
  return project.generatedRenderUrl ?? null;
}
