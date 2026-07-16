import { notFound, redirect } from "next/navigation";
import { getProject } from "@/lib/storage/projects";
import { OrderScreen, type OrderItem } from "@/components/create/OrderScreen";
import type { CustomProduct, ShoppingItem } from "@/lib/types";

export const dynamic = "force-dynamic";

// Libellé lisible d'une catégorie de ligne (fallback : slug aéré).
const CATEGORY_LABEL: Record<string, string> = {
  paint: "Peinture",
  floor: "Sol",
};

/**
 * COMMANDE CONSOLIDÉE — résout, ligne par ligne, le produit RÉELLEMENT choisi
 * (référence sur-mesure > produit choisi > meilleur match), exactement comme le
 * CTA « Commander » de /final : l'utilisateur commande ce qu'il voit.
 */
export default async function CommandePage(ctx: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await ctx.params;
  const project = await getProject(projectId);
  if (!project) notFound();
  const list = (project.shoppingList ?? []) as ShoppingItem[];
  if (!list.length) redirect(`/create/${projectId}/final`);

  const picks = (project.productPicks ?? {}) as Record<string, string>;
  const overrides = (project.productOverrides ?? {}) as Record<string, number>;
  const customs = (project.customProducts ?? {}) as Record<string, CustomProduct>;

  const items: OrderItem[] = list
    .map((it): OrderItem | null => {
      const custom = it.elementId ? customs[it.elementId] : undefined;
      const label =
        CATEGORY_LABEL[it.category] ??
        it.category.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
      if (custom?.url) {
        return {
          key: it.id,
          label,
          name: custom.name ?? it.name,
          price: custom.price ?? null,
          merchant: custom.merchant ?? "Référence personnelle",
          url: custom.url,
          imgUrl: custom.imageUrl ?? null,
          quantity: it.quantity ?? 1,
        };
      }
      const pickedId = it.elementId ? picks[it.elementId] : undefined;
      const byId = pickedId ? it.matches?.find((m) => m.id === pickedId) : undefined;
      const idx = (it.elementId ? overrides[it.elementId] : undefined) ?? 0;
      const match = byId ?? it.matches?.[idx] ?? it.matches?.[0];
      if (!match) return null; // ligne « à sourcer » : rien à commander
      return {
        key: it.id,
        label,
        name: match.name,
        price: match.price,
        merchant: match.merchant,
        url: match.product_url,
        imgUrl: match.primary_image_url,
        quantity: it.quantity ?? 1,
      };
    })
    .filter((x): x is OrderItem => x !== null);

  return <OrderScreen projectId={projectId} items={items} />;
}
