"use client";

import { useRef, useState } from "react";
import { X, Play, Loader2, AlertCircle, ImageIcon, ChevronDown, CheckCircle2 } from "lucide-react";

const IMAGE_PROVIDERS = ["nano_banana", "flux_kontext"];

const CONTEXT_DEFAULTS: Record<string, string> = {
  generation: JSON.stringify({ styleId: "doux", roomType: "salon" }, null, 2),
  iteration: JSON.stringify(
    { styleId: "doux", roomType: "salon", userRequest: "Add more plants" },
    null,
    2,
  ),
  vision: "{}",
  detection: "{}",
  audit: "{}",
};

type UploadedImage = { dataUrl: string; base64: string; mimeType: string; name: string };

type TestResult =
  | { type: "image"; dataUrl: string; durationMs: number; bytes: number; resolvedTemplate: string; missing: string[] }
  | { type: "vision"; text: string; parsed: unknown; durationMs: number; resolvedTemplate: string; missing: string[] };

type Props = {
  open: boolean;
  onClose: () => void;
  template: string;
  provider: string;
  purpose: string;
};

export function TestDrawer({ open, onClose, template, provider, purpose }: Props) {
  const [contextJson, setContextJson] = useState(() => CONTEXT_DEFAULTS[purpose] ?? "{}");
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [dragging, setDragging] = useState(false);
  const [visionJson, setVisionJson] = useState(""); // persists across image changes
  const [visionJsonOpen, setVisionJsonOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setUploadedImage({
        dataUrl,
        base64: dataUrl.split(",")[1],
        mimeType: file.type,
        name: file.name,
      });
      setResult(null);
      // visionJson intentionally NOT cleared
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function runTest() {
    setLoading(true);
    setError(null);
    setResult(null);

    let context: Record<string, unknown> = {};
    try {
      context = JSON.parse(contextJson || "{}");
    } catch {
      setError("Contexte JSON invalide.");
      setLoading(false);
      return;
    }

    // Inject visionJson into context if present
    if (visionJson.trim()) {
      try {
        context.visionJsonOverride = JSON.parse(visionJson);
      } catch {
        context.visionJsonOverride = visionJson; // keep as string if not valid JSON
      }
    }

    try {
      const res = await fetch("/api/admin/prompts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptTemplate: template,
          provider,
          purpose,
          context,
          sourceImage: uploadedImage
            ? { base64: uploadedImage.base64, mimeType: uploadedImage.mimeType }
            : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error ?? "Erreur inconnue.");
      } else {
        const r = data as TestResult;
        setResult(r);
        // Auto-fill visionJson if this was a vision result
        if (r.type === "vision" && r.parsed !== undefined) {
          const pretty = JSON.stringify(r.parsed, null, 2);
          setVisionJson(pretty);
          setVisionJsonOpen(true);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  const hasVisionJson = visionJson.trim().length > 0;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-foyer-ink/10" onClick={onClose} />
      )}

      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-lg bg-foyer-cream border-l border-foyer-border shadow-xl transition-transform duration-300 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-foyer-border shrink-0">
          <h2 className="font-medium text-sm text-foyer-ink">Tester le prompt</h2>
          <button onClick={onClose} className="text-foyer-muted hover:text-foyer-ink transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Context JSON */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foyer-muted uppercase tracking-wide">
              Contexte
            </label>
            <textarea
              value={contextJson}
              onChange={(e) => setContextJson(e.target.value)}
              rows={5}
              spellCheck={false}
              className="w-full rounded-lg border border-foyer-border bg-white px-3.5 py-3 text-xs font-mono text-foyer-ink outline-none focus:border-foyer-ink resize-y"
            />
          </div>

          {/* Vision JSON — persists across image changes */}
          <div className="rounded-lg border border-foyer-border overflow-hidden">
            <button
              type="button"
              onClick={() => setVisionJsonOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-foyer-border/20 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-foyer-ink">Vision JSON</span>
                {hasVisionJson && (
                  <CheckCircle2 size={14} className="text-foyer-sage" />
                )}
              </div>
              <div className="flex items-center gap-2">
                {hasVisionJson && (
                  <span className="text-xs text-foyer-muted">
                    injecté dans le contexte
                  </span>
                )}
                <ChevronDown
                  size={14}
                  className={`text-foyer-muted transition-transform ${visionJsonOpen ? "rotate-180" : ""}`}
                />
              </div>
            </button>

            {visionJsonOpen && (
              <div className="border-t border-foyer-border p-4 space-y-2">
                <p className="text-xs text-foyer-muted">
                  Auto-rempli après un test vision. Injecté comme{" "}
                  <code className="font-mono bg-foyer-border px-1 rounded">visionJsonOverride</code>{" "}
                  dans le contexte. Persiste même si tu changes l'image.
                </p>
                <textarea
                  value={visionJson}
                  onChange={(e) => setVisionJson(e.target.value)}
                  rows={6}
                  spellCheck={false}
                  placeholder='{"furniture": [...], "floor": {...}, ...}'
                  className="w-full rounded-lg border border-foyer-border bg-white px-3.5 py-3 text-xs font-mono text-foyer-ink outline-none focus:border-foyer-ink resize-y"
                />
                {hasVisionJson && (
                  <button
                    type="button"
                    onClick={() => setVisionJson("")}
                    className="text-xs text-foyer-terra hover:underline"
                  >
                    Effacer
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Image upload */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-foyer-muted uppercase tracking-wide">
              Image source
            </label>

            {uploadedImage ? (
              <div className="relative rounded-lg border border-foyer-border overflow-hidden">
                <img
                  src={uploadedImage.dataUrl}
                  alt={uploadedImage.name}
                  className="w-full max-h-48 object-cover"
                />
                <button
                  onClick={() => setUploadedImage(null)}
                  className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-foyer-ink/70 text-white hover:bg-foyer-ink transition-colors"
                >
                  <X size={12} />
                </button>
                <p className="absolute bottom-2 left-3 text-xs text-white/80 drop-shadow">
                  {uploadedImage.name}
                </p>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-7 cursor-pointer transition-colors ${
                  dragging
                    ? "border-foyer-sage bg-foyer-sage/5"
                    : "border-foyer-border hover:border-foyer-ink/30 hover:bg-foyer-border/20"
                }`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foyer-border">
                  <ImageIcon size={16} className="text-foyer-muted" />
                </div>
                <p className="text-sm text-foyer-muted text-center">
                  Glisse une image ou{" "}
                  <span className="text-foyer-ink underline">parcourir</span>
                </p>
                <p className="text-xs text-foyer-muted">JPG, PNG, WEBP</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
          </div>

          {/* Run */}
          <button
            type="button"
            onClick={runTest}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-foyer-sage text-white px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {loading ? "Génération…" : "Lancer le test"}
          </button>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-foyer-terra/10 border border-foyer-terra/30 px-4 py-3">
              <AlertCircle size={16} className="text-foyer-terra shrink-0 mt-0.5" />
              <p className="text-sm text-foyer-terra">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-xs text-foyer-muted">
                <span>{result.durationMs}ms</span>
                {result.type === "image" && (
                  <span>{Math.round(result.bytes / 1024)}ko</span>
                )}
                {result.missing.length > 0 && (
                  <span className="text-foyer-ochre">
                    Manquants : {result.missing.join(", ")}
                  </span>
                )}
              </div>

              {result.type === "image" && (
                <img
                  src={result.dataUrl}
                  alt="Résultat généré"
                  className="w-full rounded-lg border border-foyer-border"
                />
              )}

              {result.type === "vision" && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-foyer-border bg-white p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-foyer-muted">JSON parsé</p>
                      <span className="text-xs text-foyer-sage">
                        ↑ injecté dans Vision JSON
                      </span>
                    </div>
                    <pre className="text-xs font-mono text-foyer-ink overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(result.parsed, null, 2)}
                    </pre>
                  </div>
                  <details className="text-xs">
                    <summary className="text-foyer-muted cursor-pointer">Texte brut</summary>
                    <pre className="mt-2 p-3 bg-white border border-foyer-border rounded font-mono text-foyer-ink whitespace-pre-wrap">
                      {result.text}
                    </pre>
                  </details>
                </div>
              )}

              <details className="text-xs">
                <summary className="text-foyer-muted cursor-pointer">Template résolu</summary>
                <pre className="mt-2 p-3 bg-white border border-foyer-border rounded font-mono text-foyer-ink whitespace-pre-wrap">
                  {result.resolvedTemplate}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
