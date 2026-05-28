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

const AMBIANCES = [
  { id: "doux", name: "Doux", palette: ["#F5EFE6", "#E5DCC3", "#A8957A"] },
  { id: "brut", name: "Brut", palette: ["#2B2723", "#5C4B3C", "#A18671"] },
  { id: "bois-clair", name: "Bois clair", palette: ["#FFFFFF", "#E8DFD0", "#C9B89A"] },
  { id: "vintage", name: "Vintage", palette: ["#C9853E", "#3D6B7C", "#F4E8D8"] },
  { id: "mediterraneen", name: "Méditerranéen", palette: ["#F4EDE0", "#C6855C", "#7A8B6F"] },
  { id: "bohemian", name: "Bohemian", palette: ["#C8703A", "#E8C896", "#5C4632"] },
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
        {AMBIANCES.map((a) => {
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
