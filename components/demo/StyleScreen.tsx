"use client";

import { type Dispatch, type SetStateAction } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SectionLabel,
  PrimaryButton,
  DemoImage,
} from "@/components/demo/primitives";
import type { UserChoices } from "@/components/demo/demo-types";

// Sous-ensemble des ambiances canoniques (data/styles.json) pour la démo.
const AMBIANCES = [
  { id: "scandinave", name: "Scandinave", palette: ["#F3EFE6", "#D3AE7C", "#C9BCA8"] },
  { id: "japandi", name: "Japandi", palette: ["#DDD3C2", "#6C4E32", "#2E2A26"] },
  { id: "boheme", name: "Bohème", palette: ["#C9A97E", "#B4602F", "#F0E3D2"] },
  { id: "mid-century", name: "Mid-century", palette: ["#6B4226", "#D9A23B", "#C65D2E"] },
  { id: "mediterraneen", name: "Méditerranéen", palette: ["#F5F1E8", "#2C5BA8", "#B96A3E"] },
  { id: "haussmannien", name: "Haussmannien", palette: ["#F4F1E9", "#C89B5F", "#14513B"] },
];

export function StyleScreen({
  choices,
  setChoices,
  onGenerate,
}: {
  choices: UserChoices;
  setChoices: Dispatch<SetStateAction<UserChoices>>;
  onGenerate: () => void;
}) {
  const roomLabel = choices.roomType === "chambre" ? "chambre" : "salon";

  return (
    <div className="flex flex-1 flex-col pb-24">
      <SectionLabel>Style</SectionLabel>
      <h2 className="mt-1 font-serif text-[26px] font-medium leading-tight text-foyer-ink">
        Quelle ambiance ?
      </h2>

      <div className="mt-4 flex items-center gap-3">
        <DemoImage
          src="/demo/origin.png"
          alt="Votre pièce"
          label="origin"
          ratio="aspect-square"
          className="size-16 shrink-0 rounded-xl"
        />
        <span className="text-sm text-foyer-muted">Votre {roomLabel}</span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {AMBIANCES.map((a: { id: string; name: string; palette: string[] }) => {
          const selected = choices.ambiance === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setChoices((c) => ({ ...c, ambiance: a.id }))}
              className={cn(
                "relative flex h-[110px] flex-col items-center justify-center rounded-2xl bg-white transition-all",
                selected
                  ? "border-2 border-foyer-ink ring-2 ring-foyer-ink/10"
                  : "border border-foyer-border",
              )}
            >
              {selected && (
                <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-foyer-ink text-white">
                  <Check className="size-3" aria-hidden />
                </span>
              )}
              <span className="font-serif text-[17px] text-foyer-ink">{a.name}</span>
              <div className="absolute bottom-3 flex gap-1.5">
                {a.palette.map((hex) => (
                  <span
                    key={hex}
                    className="size-3 rounded-full border border-black/5"
                    style={{ backgroundColor: hex }}
                    aria-hidden
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="sticky bottom-0 mt-6 -mx-5 border-t border-foyer-border bg-foyer-cream/95 px-5 py-3 backdrop-blur">
        <PrimaryButton onClick={onGenerate}>Générer le rendu</PrimaryButton>
      </div>
    </div>
  );
}
