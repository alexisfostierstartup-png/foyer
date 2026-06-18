"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";

export function CatalogProductGallery({
  productId,
  images,
  initialPrimary,
}: {
  productId: string;
  images: string[];
  initialPrimary: string;
}) {
  const all = (images.length ? images : initialPrimary ? [initialPrimary] : []).filter(Boolean);
  const [display, setDisplay] = useState(initialPrimary || all[0] || "");
  const [primary, setPrimary] = useState(initialPrimary || all[0] || "");
  const [saving, setSaving] = useState(false);

  async function setAsPrimary(url: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/catalog/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primary_image_url: url }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(d?.error ?? "échec");
      }
      setPrimary(url);
      toast.success("Image 1 (cosine) mise à jour — embedding recalculé");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de la mise à jour");
    } finally {
      setSaving(false);
    }
  }

  if (all.length === 0) {
    return <div className="aspect-square w-full rounded-xl border border-foyer-border bg-foyer-cream" />;
  }

  const displayIsPrimary = display === primary;

  return (
    <div>
      {/* Grande image (= miniature cliquée) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={display}
        alt=""
        className="w-full rounded-xl border border-foyer-border bg-white object-contain"
      />

      <button
        onClick={() => setAsPrimary(display)}
        disabled={saving || displayIsPrimary}
        className="mt-2 flex items-center gap-1.5 rounded-lg bg-foyer-ink px-3 py-1.5 text-xs text-foyer-cream hover:bg-foyer-ink/90 disabled:opacity-40"
      >
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        {displayIsPrimary ? "Image 1 (cosine) actuelle" : "Définir comme image 1 (cosine)"}
      </button>

      {/* Miniatures : clic → grand. Badge "1" = image cosine. */}
      {all.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {all.map((u, i) => (
            <button
              key={i}
              onClick={() => setDisplay(u)}
              className={`relative rounded-md border-2 transition-colors ${
                u === display ? "border-foyer-ink" : "border-transparent hover:border-foyer-border"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="size-16 rounded object-cover" />
              {u === primary && (
                <span className="absolute -left-1 -top-1 flex size-4 items-center justify-center rounded-full bg-foyer-sage text-[9px] font-bold text-white">
                  1
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
