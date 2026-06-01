"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { Camera, ImagePlus, Frame, Sun, UserRoundX } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PhoneCard,
  SectionLabel,
  PrimaryButton,
  DemoImage,
} from "@/components/demo/primitives";
import { ConstraintsAccordion } from "@/components/demo/ConstraintsAccordion";
import type { UserChoices } from "@/components/demo/demo-types";
import type { RoomType } from "@/lib/types";

const ROOMS: { value: RoomType; label: string }[] = [
  { value: "salon", label: "Salon" },
  { value: "chambre", label: "Chambre" },
];

const TIPS = [
  { icon: Frame, text: "Cadrez large (un mur entier visible)" },
  { icon: Sun, text: "Éclairage naturel idéalement" },
  { icon: UserRoundX, text: "Sans être dans la pièce vous-même" },
];

export function HomeScreen({
  choices,
  setChoices,
  onContinue,
}: {
  choices: UserChoices;
  setChoices: Dispatch<SetStateAction<UserChoices>>;
  onContinue: () => void;
}) {
  const [roomReady, setRoomReady] = useState(false);
  const canContinue = choices.roomType !== null && roomReady;

  return (
    <div className="flex flex-1 flex-col pb-24">
      {/* Bloc A */}
      <h1 className="font-serif text-[30px] font-medium leading-tight tracking-[-0.02em] text-foyer-ink">
        Votre pièce, transformée. Réellement.
      </h1>
      <p className="mt-3 text-[16px] leading-relaxed text-foyer-muted">
        Prenez une photo, on imagine le projet ET on vous dit où tout acheter.
      </p>

      {/* Bloc B — pièce */}
      <div className="mt-8">
        <SectionLabel>Quelle pièce ?</SectionLabel>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {ROOMS.map((r) => {
            const selected = choices.roomType === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() =>
                  setChoices((c) => ({ ...c, roomType: r.value }))
                }
                className={cn(
                  "h-16 rounded-2xl bg-white font-medium text-foyer-ink transition-all",
                  selected
                    ? "border-2 border-foyer-ink"
                    : "border border-foyer-border",
                )}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bloc C — upload (révélé après choix pièce) */}
      {choices.roomType && (
        <div className="mt-6 duration-300 animate-in fade-in">
          <SectionLabel>Votre pièce en photo</SectionLabel>
          <PhoneCard className="mt-2">
            {roomReady ? (
              <DemoImage src="/demo/origin.png" alt="Votre pièce" label="origin" />
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl border border-foyer-border bg-[#F0EBE2]">
                <span className="flex size-16 items-center justify-center rounded-full border-2 border-foyer-muted">
                  <span className="size-6 rounded-full border-2 border-foyer-muted" />
                </span>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-3">
              <label className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-foyer-sage font-medium text-white shadow-[0_2px_8px_rgba(107,142,111,0.35)] transition-all hover:-translate-y-0.5 hover:bg-foyer-sage/90 hover:shadow-[0_4px_14px_rgba(107,142,111,0.45)]">
                <Camera className="size-5" aria-hidden />
                Prendre une photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={() => setRoomReady(true)}
                />
              </label>
              <label className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-foyer-border font-medium text-foyer-ink hover:bg-white">
                <ImagePlus className="size-5" aria-hidden />
                Importer depuis la galerie
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={() => setRoomReady(true)}
                />
              </label>
            </div>

            <ul className="mt-4 space-y-2">
              {TIPS.map(({ icon: Icon, text }) => (
                <li
                  key={text}
                  className="flex items-center gap-2 text-[13px] text-foyer-muted"
                >
                  <Icon className="size-4 shrink-0 text-foyer-sage" strokeWidth={1.5} aria-hidden />
                  {text}
                </li>
              ))}
            </ul>
          </PhoneCard>
        </div>
      )}

      {/* Bloc D — contraintes (révélé après preview) */}
      {roomReady && (
        <div className="mt-6 duration-300 animate-in fade-in">
          <ConstraintsAccordion choices={choices} setChoices={setChoices} />
        </div>
      )}

      {/* Bloc E — continuer (sticky) */}
      <div className="sticky bottom-0 mt-6 -mx-5 border-t border-foyer-border bg-foyer-cream/95 px-5 py-3 backdrop-blur">
        <PrimaryButton onClick={onContinue} disabled={!canContinue}>
          Continuer
        </PrimaryButton>
      </div>
    </div>
  );
}
