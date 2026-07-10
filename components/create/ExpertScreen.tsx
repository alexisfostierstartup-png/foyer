"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, ArrowLeft, ShoppingBag, Eye } from "lucide-react";

type ExpertProduct = { category: string; name: string; imageUrl: string };

type Props = {
  projectId: string;
  // Photo de base — affichée pendant la génération (jamais le fake par défaut).
  basePhotoUrl: string;
  // Rendu RÉEL (produits intégrés) — le livrable montré directement.
  initialExpertUrl?: string | null;
  // Rendu fictif IA (« fake ») — montré UNIQUEMENT au survol, pour voir la dérive.
  fakeUrl: string;
  products: ExpertProduct[];
};

export function ExpertScreen({ projectId, basePhotoUrl, initialExpertUrl, fakeUrl, products }: Props) {
  const router = useRouter();
  const [expertUrl, setExpertUrl] = useState<string | null>(initialExpertUrl ?? null);
  const [loading, setLoading] = useState(false);
  const [showFake, setShowFake] = useState(false);
  const startedRef = useRef(false);

  // Loop expert : dès l'arrivée, on génère le rendu réel (sauf si déjà fait ou
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
        toast.error(data.error ?? "Le rendu a échoué.");
        return;
      }
      setExpertUrl(data.expertRenderUrl);
    } catch {
      toast.error("Le rendu a échoué. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  // Image affichée : le rendu réel ; au survol/maintien → le rendu IA (dérive).
  // Tant que le rendu réel n'est pas prêt, on montre la photo de base (jamais le
  // fake par défaut — il n'est visible qu'au survol explicite).
  const mainSrc = expertUrl ? (showFake ? fakeUrl : expertUrl) : basePhotoUrl;

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
        <Sparkles className="size-3.5" aria-hidden /> Rendu réel
      </p>
      <h1 className="mt-1 font-serif text-[26px] font-medium leading-tight text-foyer-ink">
        Votre pièce, meublée pour de vrai
      </h1>
      <p className="mt-2 text-sm text-foyer-muted">
        Les vrais produits de votre liste, intégrés dans votre pièce.
      </p>

      <div className="relative mt-6 overflow-hidden rounded-2xl border border-foyer-border bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mainSrc} alt={showFake ? "Rendu IA d'origine" : "Rendu réel"} className="w-full" />

        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-foyer-cream/80 backdrop-blur-sm">
            <Loader2 className="size-6 animate-spin text-foyer-sage" aria-hidden />
            <p className="text-sm font-medium text-foyer-ink">Intégration des vrais meubles…</p>
          </div>
        )}

        {expertUrl && (
          <button
            type="button"
            // Clic pour basculer réel ↔ rendu IA (voir la dérive).
            onClick={() => setShowFake((v) => !v)}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-foyer-ink/75 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur transition-opacity hover:bg-foyer-ink"
          >
            <Eye className="size-3.5" aria-hidden />
            {showFake ? "Voir le rendu réel" : "Voir le rendu IA"}
          </button>
        )}
      </div>
      {expertUrl && (
        <p className="mt-2 text-center text-[12px] text-foyer-muted">
          Cliquez pour comparer avec le rendu IA d&apos;origine.
        </p>
      )}

      {products.length > 0 && (
        <>
          <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.12em] text-foyer-muted">
            {products.length} vrai{products.length > 1 ? "s" : ""} meuble{products.length > 1 ? "s" : ""} intégré{products.length > 1 ? "s" : ""}
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

      {/* Un seul chemin après le rendu réel : la liste de courses (l'itération a été
          retirée du parcours expert — scope resserré 2026-07-09). */}
      <div className="sticky bottom-0 mt-8 flex flex-col gap-2.5 border-t border-foyer-border bg-foyer-cream/95 py-3 backdrop-blur">
        <button
          type="button"
          disabled={loading}
          onClick={() => router.push(`/create/${projectId}/final`)}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-foyer-sage font-medium text-white shadow-[0_2px_8px_rgba(107,142,111,0.35)] transition-all hover:-translate-y-0.5 disabled:opacity-60"
        >
          <ShoppingBag className="size-5" aria-hidden /> Ma liste de courses
        </button>
      </div>
    </div>
  );
}
