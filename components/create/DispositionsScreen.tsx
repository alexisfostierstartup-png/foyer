"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaywallModal, type PaywallTrigger } from "@/components/paywalls/PaywallModal";

export function DispositionsScreen({
  projectId,
  initialUrl,
}: {
  projectId: string;
  initialUrl?: string;
}) {
  const router = useRouter();
  const [url, setUrl] = useState<string | undefined>(initialUrl);
  const [loading, setLoading] = useState(!initialUrl);
  const [failed, setFailed] = useState(false);
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
      const data = (await res.json()) as { url?: string };
      setUrl(data.url);
      setLoading(false);
    } catch {
      toast.error("La génération a échoué. Réessayez.");
      setFailed(true);
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (initialUrl) return;
    if (startedRef.current) return;
    startedRef.current = true;
    generate();
  }, [generate, initialUrl]);

  return (
    <>
      {paywallTrigger && (
        <PaywallModal trigger={paywallTrigger} onClose={() => { setPaywallTrigger(null); setFailed(true); }} />
      )}
      <div className="min-h-screen bg-foyer-cream">
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          <h1 className="font-serif text-2xl text-foyer-ink mb-1">3 dispositions</h1>
          <p className="text-sm text-foyer-muted mb-6">
            Trois agencements possibles de votre pièce, dans le même style.
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

          {!loading && url && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="3 dispositions"
                className="w-full rounded-2xl border border-foyer-border"
              />
              <div className="mt-6 flex flex-col gap-2.5">
                <Button
                  onClick={() => router.push(`/create/generating?projectId=${projectId}`)}
                  className="h-12 w-full bg-foyer-ink text-white hover:bg-foyer-ink/90"
                >
                  Lancer un rendu détaillé
                </Button>
                <button
                  onClick={() => router.push(`/create/${projectId}/review`)}
                  className="w-full py-2.5 text-sm text-foyer-muted hover:text-foyer-ink transition-colors"
                >
                  Retour à l&apos;ajustement
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
