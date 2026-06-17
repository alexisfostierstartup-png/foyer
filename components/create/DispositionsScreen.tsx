"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaywallModal, type PaywallTrigger } from "@/components/paywalls/PaywallModal";

export function DispositionsScreen({
  projectId,
  initialUrls,
}: {
  projectId: string;
  initialUrls?: string[];
}) {
  const router = useRouter();
  const [urls, setUrls] = useState<string[]>(initialUrls ?? []);
  const [loading, setLoading] = useState(!initialUrls?.length);
  const [failed, setFailed] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [paywallTrigger, setPaywallTrigger] = useState<PaywallTrigger | null>(null);
  const startedRef = useRef(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    setPaywallTrigger(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/generate-dispositions`, { method: "POST" });
      if (res.status === 402) {
        const data = (await res.json().catch(() => null)) as { paywall?: PaywallTrigger } | null;
        setPaywallTrigger(data?.paywall ?? "second_project");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? "La génération a échoué. Réessayez.");
        setFailed(true);
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { urls?: string[] };
      setUrls(data.urls ?? []);
      setLoading(false);
    } catch {
      toast.error("La génération a échoué. Réessayez.");
      setFailed(true);
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (initialUrls?.length) return;
    if (startedRef.current) return;
    startedRef.current = true;
    generate();
  }, [generate, initialUrls]);

  async function choose(url: string) {
    setSelecting(url);
    try {
      const res = await fetch(`/api/projects/${projectId}/select-disposition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error();
      router.push(`/create/${projectId}`);
    } catch {
      toast.error("La sélection a échoué. Réessayez.");
      setSelecting(null);
    }
  }

  return (
    <>
      {paywallTrigger && (
        <PaywallModal trigger={paywallTrigger} onClose={() => { setPaywallTrigger(null); setFailed(true); }} />
      )}
      <div className="min-h-screen bg-foyer-cream">
        <div className="mx-auto w-full max-w-xl px-4 py-8">
          <h1 className="font-serif text-2xl text-foyer-ink mb-1">3 dispositions</h1>
          <p className="text-sm text-foyer-muted mb-6">
            Trois agencements de votre pièce. Choisissez celui que vous préférez.
          </p>

          {loading && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-foyer-border bg-white py-20">
              <Loader2 className="size-6 animate-spin text-foyer-terra" />
              <p className="text-sm text-foyer-muted">On compose 3 agencements…</p>
            </div>
          )}

          {!loading && failed && (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-foyer-border bg-white py-16">
              <p className="text-sm text-foyer-ink">La génération n&apos;a pas abouti.</p>
              <Button onClick={generate} className="h-11 bg-foyer-ink text-white hover:bg-foyer-ink/90">
                Réessayer
              </Button>
            </div>
          )}

          {!loading && urls.length > 0 && (
            <div className="flex flex-col gap-6">
              {urls.map((url, i) => (
                <div key={url} className="overflow-hidden rounded-2xl border border-foyer-border bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Disposition ${i + 1}`} className="w-full" />
                  <div className="flex items-center justify-between gap-3 p-3">
                    <span className="text-sm font-medium text-foyer-ink">Disposition {i + 1}</span>
                    <Button
                      onClick={() => choose(url)}
                      disabled={selecting !== null}
                      className="h-10 bg-foyer-ink text-white hover:bg-foyer-ink/90"
                    >
                      {selecting === url ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="mr-1.5 size-4" />
                          Choisir
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
