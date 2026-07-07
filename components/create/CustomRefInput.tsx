"use client";

import { useState, useRef } from "react";
import { Link2, Upload, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import type { CustomProduct } from "@/lib/types";

// « Indiquer votre référence » : URL → extraction produit → APERÇU (l'user valide
// l'image récupérée, ou la rejette et importe un JPEG). Si l'extraction échoue → même
// fallback JPEG. On ne pousse JAMAIS une image non confirmée au rendu.
export function CustomRefInput({ onPicked }: { onPicked: (cp: CustomProduct) => void }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState<CustomProduct | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function extract() {
    const u = url.trim();
    if (!u || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch("/api/products/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u }),
      });
      const d = (await res.json()) as { ok?: boolean; product?: CustomProduct };
      if (d.ok && d.product?.imageUrl) {
        setPreview({ imageUrl: d.product.imageUrl, name: d.product.name, price: d.product.price, url: d.product.url, merchant: d.product.merchant });
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  async function uploadJpeg(file: File) {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/products/upload-image", { method: "POST", body: fd });
      const d = (await res.json()) as { ok?: boolean; imageUrl?: string; error?: string };
      if (d.ok && d.imageUrl) {
        onPicked({ imageUrl: d.imageUrl });
        setPreview(null);
        setFailed(false);
        setUrl("");
      } else {
        toast.error(d.error ?? "Import échoué.");
      }
    } catch {
      toast.error("Import échoué.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-foyer-border bg-foyer-cream/40 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-foyer-ink">
        <Link2 className="size-3.5 text-foyer-sage" aria-hidden /> Indiquer votre référence
      </p>

      {preview ? (
        // Aperçu de l'image récupérée : l'user confirme AVANT usage au rendu.
        <div>
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.imageUrl} alt="Aperçu du produit" className="size-20 shrink-0 rounded-lg border border-foyer-border bg-white object-contain" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[13px] font-medium text-foyer-ink">{preview.name ?? "Produit"}</p>
              <p className="mt-0.5 text-[12px] text-foyer-muted">C&apos;est bien cette image&nbsp;?</p>
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => { onPicked(preview); setPreview(null); setUrl(""); }}
              className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-foyer-sage text-[13px] font-medium text-white transition-colors hover:bg-foyer-sage/90"
            >
              <Check className="size-4" aria-hidden /> Utiliser cette image
            </button>
            <button
              type="button"
              onClick={() => { setPreview(null); fileRef.current?.click(); }}
              className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-foyer-border px-3 text-[13px] font-medium text-foyer-muted transition-colors hover:text-foyer-ink"
            >
              <Upload className="size-3.5" aria-hidden /> Pas la bonne → JPEG
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <input
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setFailed(false); }}
              onKeyDown={(e) => e.key === "Enter" && extract()}
              placeholder="www."
              className="min-w-0 flex-1 rounded-lg border border-foyer-border bg-white px-3 py-2 text-[13px] outline-none placeholder:text-foyer-muted focus:border-foyer-sage"
            />
            <button
              type="button"
              onClick={extract}
              disabled={loading || !url.trim()}
              className="flex h-[36px] shrink-0 items-center gap-1.5 rounded-lg bg-foyer-sage px-3 text-[13px] font-medium text-white transition-colors hover:bg-foyer-sage/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : "Ajouter"}
            </button>
          </div>
          {failed && (
            <div className="mt-2 rounded-lg bg-foyer-ochre/10 px-3 py-2 text-[12px] leading-relaxed text-foyer-ink">
              Impossible de récupérer le produit depuis ce lien.{" "}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1 font-medium text-foyer-sage underline"
              >
                <Upload className="size-3" aria-hidden /> Importez plutôt une photo (JPG)
              </button>
            </div>
          )}
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadJpeg(f); e.target.value = ""; }}
      />
    </div>
  );
}
