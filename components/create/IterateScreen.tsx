"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, ChevronDown, Loader2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressBar } from "@/components/create/ProgressBar";

const STEPS = ["Photo", "Style", "Mobilier", "Rendu", "Projet"];

type Category = { id: string; label: string; options: string[] };

const CATEGORIES: Category[] = [
  {
    id: "meubles",
    label: "Meubles",
    options: ["Ajouter un fauteuil", "Enlever un meuble", "Canapé plus grand"],
  },
  {
    id: "sol",
    label: "Sol",
    options: ["Plus clair", "Plus foncé", "Changer le revêtement"],
  },
  {
    id: "murs",
    label: "Murs",
    options: ["Plus chauds", "Plus clairs", "Ajouter des moulures"],
  },
  {
    id: "plafond",
    label: "Plafond",
    options: ["Plus lumineux", "Poutres apparentes", "Blanc pur"],
  },
  {
    id: "eclairage",
    label: "Éclairage",
    options: ["Plus chaleureux", "Ajouter une lampe", "Lumière naturelle"],
  },
  {
    id: "accessoires",
    label: "Accessoires",
    options: ["Plus de plantes", "Moins chargé", "Ajouter des coussins"],
  },
];

function buildUserRequest(
  selections: Record<string, string[]>,
  notes: Record<string, string>,
): string {
  const parts: string[] = [];
  for (const cat of CATEGORIES) {
    const chips = selections[cat.id] ?? [];
    const note = notes[cat.id]?.trim() ?? "";
    if (chips.length === 0 && !note) continue;
    const line = [chips.join(", "), note].filter(Boolean).join(". ");
    parts.push(`${cat.label}: ${line}`);
  }
  return parts.join(". ");
}

type Props = {
  projectId: string;
  currentRenderUrl: string;
  // Tap-to-target : meuble désigné au doigt sur le rendu (/final) → mode ciblé.
  target?: { elementId: string; label: string } | null;
  /** Modifications déjà jouées. 0 = celle-ci est la modification offerte. */
  iterationCount?: number;
};

// Suggestions du mode ciblé (un meuble précis désigné).
const TARGET_SUGGESTIONS = ["Remplacer par un autre modèle", "Changer la couleur", "Plus grand", "Plus petit", "Enlever ce meuble"];

export function IterateScreen({
  projectId,
  currentRenderUrl,
  target = null,
  iterationCount = 0,
}: Props) {
  const router = useRouter();
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [targetOn, setTargetOn] = useState(Boolean(target));
  const [targetNote, setTargetNote] = useState("");
  const targeting = targetOn && target != null;

  function toggleOption(catId: string, option: string) {
    setSelections((prev) => {
      const cur = prev[catId] ?? [];
      const next = cur.includes(option)
        ? cur.filter((o) => o !== option)
        : [...cur, option];
      return { ...prev, [catId]: next };
    });
  }

  const userRequest = targeting ? targetNote.trim() : buildUserRequest(selections, notes);
  const hasChanges = userRequest.length > 0;

  async function handleApply() {
    if (!hasChanges) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/iterate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          targeting
            ? { userRequest, targetElementIds: [target.elementId], targetLabel: target.label }
            : { userRequest },
        ),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? "L'itération a échoué. Réessayez.");
        setLoading(false);
        return;
      }
      // Retour à l'écran du rendu : l'utilisateur VOIT ce que sa demande a donné et
      // tranche lui-même (valider → liste de courses, ou modifier à nouveau → crédits).
      // On l'envoyait droit sur /final, sans lui laisser regarder le résultat.
      // Expert : /create/[id] redirige de lui-même vers /final (écran terminal du flux
      // expert, qui affiche le rendu à jour) — parcours inchangé.
      router.push(`/create/${projectId}`);
    } catch {
      toast.error("L'itération a échoué. Réessayez.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <ProgressBar currentStep={4} labels={STEPS} />

      <main className="mx-auto w-full max-w-[480px] lg:max-w-[960px] flex-1 px-5 pb-28 pt-6">
        <h1 className="font-serif text-[26px] font-medium leading-tight tracking-[-0.02em] text-foyer-ink">
          Qu&apos;aimeriez-vous changer&nbsp;?
        </h1>

        {/* L'avertissement vit ICI, au moment où l'utilisateur formule sa demande — c'est
            là qu'il peut encore la compléter. Sur l'écran précédent, il arrivait trop tôt :
            rien n'était engagé. Et seulement pour la modification OFFERTE : au-delà, il a
            payé des crédits, lui reparler de la limite du gratuit n'a plus de sens. */}
        {iterationCount === 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-foyer-ochre/40 bg-foyer-ochre/10 px-4 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-foyer-ochre" aria-hidden />
          <p className="text-[13px] leading-relaxed text-foyer-ink">
            {/* {" "} explicite : JSX avale l'espace entre </b> et le texte qui suit. */}
            <b>
              Vous ne pourrez modifier ce rendu qu&apos;une seule fois avec l&apos;offre
              gratuite.
            </b>{" "}
            Donc assurez-vous d&apos;effectuer tous vos changements.
            <br />
            Mais pas d&apos;inquiétude&nbsp;: si vous n&apos;êtes pas encore satisfait, vous
            pourrez continuer à modifier votre rendu en achetant des crédits, à partir de
            5&nbsp;euros, sans aucun abonnement.
          </p>
        </div>
        )}

        <div className="mt-5 overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentRenderUrl}
            alt="Rendu actuel"
            className="w-full object-cover"
          />
        </div>

        {/* Mode ciblé (tap-to-target) : un meuble précis, une consigne libre. */}
        {targeting && (
          <div className="mt-5 rounded-2xl border border-foyer-sage/40 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 rounded-full bg-foyer-sage/15 px-3 py-1 text-[13px] font-medium text-foyer-sage">
                Cible : {target.label}
              </span>
              <button
                type="button"
                onClick={() => setTargetOn(false)}
                className="text-[13px] text-foyer-muted underline underline-offset-2 hover:text-foyer-ink"
              >
                Retirer la cible
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {TARGET_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTargetNote(s)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm transition-colors",
                    targetNote === s
                      ? "border-2 border-foyer-ink bg-foyer-ink/5 text-foyer-ink"
                      : "border border-foyer-border text-foyer-muted hover:text-foyer-ink",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <textarea
              value={targetNote}
              onChange={(e) => setTargetNote(e.target.value)}
              placeholder={`Que faire de « ${target.label} » ?`}
              rows={2}
              className="mt-3 w-full resize-none rounded-xl border border-foyer-border bg-foyer-cream px-3 py-2.5 text-sm text-foyer-ink outline-none placeholder:text-foyer-muted focus:border-foyer-ink"
            />
          </div>
        )}

        {!targeting && (
        <div className="mt-5 divide-y divide-foyer-border overflow-hidden rounded-2xl border border-foyer-border bg-white">
          {CATEGORIES.map((cat) => {
            const open = openCat === cat.id;
            const count =
              (selections[cat.id]?.length ?? 0) +
              (notes[cat.id]?.trim() ? 1 : 0);
            return (
              <div key={cat.id}>
                <button
                  type="button"
                  onClick={() => setOpenCat(open ? null : cat.id)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between px-4 py-3.5 text-left"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-foyer-ink">{cat.label}</span>
                    {count > 0 && (
                      <span className="flex size-5 items-center justify-center rounded-full bg-foyer-sage text-[11px] font-medium text-white">
                        {count}
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 text-foyer-muted transition-transform",
                      open && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>

                {open && (
                  <div className="px-4 pb-4">
                    <div className="flex flex-wrap gap-2">
                      {cat.options.map((opt) => {
                        const on = selections[cat.id]?.includes(opt) ?? false;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => toggleOption(cat.id, opt)}
                            className={cn(
                              "rounded-full px-3 py-1.5 text-sm transition-colors",
                              on
                                ? "border-2 border-foyer-ink bg-foyer-ink/5 text-foyer-ink"
                                : "border border-foyer-border text-foyer-muted hover:text-foyer-ink",
                            )}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    <textarea
                      value={notes[cat.id] ?? ""}
                      onChange={(e) =>
                        setNotes((prev) => ({ ...prev, [cat.id]: e.target.value }))
                      }
                      placeholder={`Précisez pour ${cat.label.toLowerCase()}…`}
                      rows={2}
                      className="mt-3 w-full resize-none rounded-xl border border-foyer-border bg-foyer-cream px-3 py-2.5 text-sm text-foyer-ink outline-none placeholder:text-foyer-muted focus:border-foyer-ink"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-foyer-border bg-foyer-cream/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto max-w-[480px]">
          <button
            type="button"
            disabled={!hasChanges || loading}
            onClick={handleApply}
            className={cn(
              "flex h-[52px] w-full items-center justify-center gap-2 rounded-full font-medium transition-all",
              !hasChanges || loading
                ? "bg-foyer-border text-foyer-muted"
                : "bg-foyer-sage text-white shadow-[0_2px_8px_rgba(107,142,111,0.35)] hover:-translate-y-0.5",
            )}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Retouche en cours…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Appliquer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
