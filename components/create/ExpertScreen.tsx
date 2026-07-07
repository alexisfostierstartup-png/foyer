"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, ArrowLeft, ShoppingBag, RotateCcw } from "lucide-react";
import { BeforeAfterSlider } from "@/components/create/BeforeAfterSlider";

type ExpertProduct = { category: string; name: string; imageUrl: string };

type Props = {
  projectId: string;
  beforeUrl: string;
  initialExpertUrl?: string | null;
  products: ExpertProduct[];
};

export function ExpertScreen({ projectId, beforeUrl, initialExpertUrl, products }: Props) {
  const router = useRouter();
  const [expertUrl, setExpertUrl] = useState<string | null>(initialExpertUrl ?? null);
  const [loading, setLoading] = useState(false);
  const startedRef = useRef(false);

  // Loop expert : dès l'arrivée, on génère automatiquement (sauf si déjà fait ou
  // s'il n'y a aucun gros meuble à intégrer).
  useEffect(() => {
    if (startedRef.current || expertUrl || products.length === 0) return;
    startedRef.current = true;
    void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/expert-render`, { method: "POST" });
      const data = (await res.json()) as { expertRenderUrl?: string; error?: string };
      if (!res.ok || !data.expertRenderUrl) {
        toast.error(data.error ?? "Le rendu expert a échoué.");
        return;
      }
      setExpertUrl(data.expertRenderUrl);
      toast.success("Rendu expert généré ✨");
    } catch {
      toast.error("Le rendu expert a échoué. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-5 pb-28 pt-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-1.5 self-start text-sm text-foyer-muted transition-colors hover:text-foyer-ink"
      >
        <ArrowLeft className="size-4" aria-hidden /> Retour
      </button>

      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-foyer-sage">
        <Sparkles className="size-3.5" aria-hidden /> Expert
      </p>
      <h1 className="mt-1 font-serif text-[26px] font-medium leading-tight text-foyer-ink">
        Votre pièce avec les vrais meubles
      </h1>
      <p className="mt-2 text-sm text-foyer-muted">
        On vide votre pièce de son mobilier puis on l&apos;aménage avec les vrais gros meubles
        du catalogue — mêmes murs, fenêtres et sol que votre photo.
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-foyer-border bg-white">
        {expertUrl ? (
          <BeforeAfterSlider before={beforeUrl} after={expertUrl} alt="Rendu expert" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={beforeUrl} alt="Votre rendu" className="w-full" />
        )}
      </div>
      {expertUrl && (
        <p className="mt-2 text-center text-[12px] text-foyer-muted">
          Glissez pour comparer — à gauche votre pièce, à droite meublée avec les vrais produits.
        </p>
      )}

      {products.length > 0 && (
        <>
          <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.12em] text-foyer-muted">
            {products.length} gros meuble{products.length > 1 ? "s" : ""} intégré{products.length > 1 ? "s" : ""}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {products.map((p) => (
              <figure key={p.category} className="overflow-hidden rounded-xl border border-foyer-border bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl} alt={p.name} className="aspect-square w-full object-cover" />
                <figcaption className="truncate px-2 py-1.5 text-[11px] text-foyer-muted">{p.name}</figcaption>
              </figure>
            ))}
          </div>
        </>
      )}

      <div className="sticky bottom-0 mt-8 flex flex-col gap-2.5 border-t border-foyer-border bg-foyer-cream/95 py-3 backdrop-blur">
        {loading ? (
          <div className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-foyer-border font-medium text-foyer-muted">
            <Loader2 className="size-5 animate-spin" aria-hidden /> Génération du rendu…
          </div>
        ) : expertUrl ? (
          <>
            <button
              type="button"
              onClick={() => router.push(`/create/${projectId}/final`)}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-foyer-sage font-medium text-white shadow-[0_2px_8px_rgba(107,142,111,0.35)] transition-all hover:-translate-y-0.5"
            >
              <ShoppingBag className="size-5" aria-hidden /> Voir ma liste de courses
            </button>
            <button
              type="button"
              onClick={generate}
              className="flex h-11 w-full items-center justify-center gap-1.5 text-sm font-medium text-foyer-muted transition-colors hover:text-foyer-ink"
            >
              <RotateCcw className="size-4" aria-hidden /> Régénérer un autre agencement
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={generate}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-foyer-sage font-medium text-white shadow-[0_2px_8px_rgba(107,142,111,0.35)] transition-all hover:-translate-y-0.5"
          >
            Générer le rendu expert
          </button>
        )}
      </div>
    </div>
  );
}
