"use client";

import { useState, useRef } from "react";
import { Link2, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { CustomProduct } from "@/lib/types";

// « Indiquer votre référence » : URL → extraction produit ; si l'extraction échoue
// (site non lisible), on propose d'importer un JPEG directement (jamais de rendu
// bidon). Réutilisé à la liste de courses ET à l'upload (étape 1).
export function CustomRefInput({ onPicked }: { onPicked: (cp: CustomProduct) => void }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
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
        onPicked({ imageUrl: d.product.imageUrl, name: d.product.name, price: d.product.price, url: d.product.url, merchant: d.product.merchant });
        setUrl("");
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
