"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Bookmark, Share2, Check } from "lucide-react";
import { toast } from "sonner";
import { ProgressBar } from "@/components/create/ProgressBar";
import { BeforeAfterSlider } from "@/components/create/BeforeAfterSlider";
import { PaywallModal } from "@/components/paywalls/PaywallModal";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/auth/useUser";
import { saveProject } from "@/lib/auth/actions";
import type { RoomType } from "@/lib/types";

const STEPS = ["Photo", "Style", "Mobilier", "Rendu", "Projet"];

type Props = {
  projectId: string;
  beforeUrl: string;
  afterUrl: string;
  roomType: RoomType;
};

export function RenderScreen({ projectId, beforeUrl, afterUrl, roomType }: Props) {
  const router = useRouter();
  const { user, profile } = useUser();
  const [navigating, setNavigating] = useState<"final" | "iterate" | null>(null);
  const [saved, setSaved] = useState(false);
  const [showSavePaywall, setShowSavePaywall] = useState(false);

  function go(dest: "final" | "iterate") {
    setNavigating(dest);
    router.push(
      dest === "final"
        ? `/create/${projectId}/final`
        : `/create/${projectId}/iterate`,
    );
  }

  async function handleSave() {
    if (!user) {
      // Not authenticated: redirect to signup with next pointing back
      router.push(`/auth?tab=signup&next=/create/${projectId}`);
      return;
    }
    if (profile?.plan === "neophyte") {
      setShowSavePaywall(true);
      return;
    }
    // Expert or Pro: save directly
    const result = await saveProject(projectId, user.id);
    if (result.error) {
      toast.error("Erreur lors de la sauvegarde.");
    } else {
      setSaved(true);
      toast.success("Projet sauvegardé !");
    }
  }

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Lien copié !");
    } catch {
      toast.info("Copiez ce lien : " + window.location.href);
    }
  }

  const roomLabel = roomType === "chambre" ? "chambre" : "salon";

  return (
    <>
      <div className="flex flex-1 flex-col">
        <ProgressBar currentStep={4} labels={STEPS} />

        <main className="mx-auto w-full max-w-[480px] flex-1 px-5 pb-28 pt-6">
          <div className="flex items-start justify-between">
            <h1 className="font-serif text-[28px] font-medium leading-tight text-foyer-ink">
              Voilà votre {roomLabel}.
            </h1>
            <div className="flex shrink-0 items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSave}
                title={saved ? "Sauvegardé" : "Sauvegarder"}
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border transition-all",
                  saved
                    ? "border-foyer-sage bg-foyer-sage text-white"
                    : "border-foyer-border bg-white text-foyer-muted hover:border-foyer-sage hover:text-foyer-sage",
                )}
              >
                {saved ? <Check className="size-4" /> : <Bookmark className="size-4" />}
              </button>
              <button
                type="button"
                onClick={handleShare}
                title="Partager"
                className="flex size-9 items-center justify-center rounded-full border border-foyer-border bg-white text-foyer-muted transition-all hover:border-foyer-sage hover:text-foyer-sage"
              >
                <Share2 className="size-4" />
              </button>
            </div>
          </div>

          <div className="mt-5">
            <BeforeAfterSlider before={beforeUrl} after={afterUrl} />
          </div>

          <p className="mt-4 text-center text-[14px] text-foyer-muted">
            Pas tout à fait ça&nbsp;? Affinez.
          </p>
        </main>

        <div className="fixed bottom-0 inset-x-0 border-t border-foyer-border bg-foyer-cream/95 px-5 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-[480px] flex-col gap-2.5">
            <button
              type="button"
              disabled={navigating !== null}
              onClick={() => go("final")}
              className={cn(
                "flex h-[52px] w-full items-center justify-center gap-2 rounded-full font-medium transition-all",
                navigating !== null
                  ? "bg-foyer-border text-foyer-muted"
                  : "bg-foyer-sage text-white shadow-[0_2px_8px_rgba(107,142,111,0.35)] hover:-translate-y-0.5",
              )}
            >
              {navigating === "final" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "J'adore !"
              )}
            </button>

            <button
              type="button"
              disabled={navigating !== null}
              onClick={() => go("iterate")}
              className={cn(
                "flex h-[52px] w-full items-center justify-center gap-2 rounded-full border font-medium transition-colors",
                navigating !== null
                  ? "border-foyer-border text-foyer-muted"
                  : "border-foyer-border text-foyer-ink hover:bg-foyer-border/30",
              )}
            >
              {navigating === "iterate" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Affiner le rendu"
              )}
            </button>
          </div>
        </div>
      </div>

      {showSavePaywall && (
        <PaywallModal
          trigger="save_project"
          onClose={() => setShowSavePaywall(false)}
          onSuccess={() => {
            setShowSavePaywall(false);
            setSaved(true);
          }}
        />
      )}
    </>
  );
}
