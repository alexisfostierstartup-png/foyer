"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Style } from "@/lib/types";

type StyleCardProps = {
  style: Style;
  selected: boolean;
  onSelect: () => void;
};

export function StyleCard({ style, selected, onSelect }: StyleCardProps) {
  const photos = style.images.length ? style.images : [style.moodboardUrl];
  const [i, setI] = useState(0);

  // Modulo positif : (-1 % 3) vaut -1 en JS, ce qui sortirait du tableau au premier
  // clic vers la gauche.
  const aller = (pas: number, e: React.MouseEvent) => {
    // Sans ça, feuilleter les photos SÉLECTIONNERAIT le style : la carte entière est
    // un bouton radio.
    e.stopPropagation();
    e.preventDefault();
    setI((k) => (((k + pas) % photos.length) + photos.length) % photos.length);
  };

  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white text-left transition-all duration-150",
        "hover:scale-[1.02] active:scale-100",
        selected ? "border-2 border-foyer-sage ring-2 ring-foyer-sage/20" : "border-foyer-border",
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-foyer-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[i]}
          alt={`${style.name} — vue ${i + 1} sur ${photos.length}`}
          className="size-full object-cover"
        />

        {/* Feuilleter les photos du style. L'ancienne carte affichait au survol un pavé
            de texte décrivant le style : beaucoup de mots pour ce qu'une deuxième photo
            montre mieux — et invisible au doigt, sur téléphone. */}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label={`Photo précédente de ${style.name}`}
              onClick={(e) => aller(-1, e)}
              className="absolute left-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-foyer-ink/45 text-white backdrop-blur-sm transition-colors hover:bg-foyer-ink/75"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`Photo suivante de ${style.name}`}
              onClick={(e) => aller(1, e)}
              className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-foyer-ink/45 text-white backdrop-blur-sm transition-colors hover:bg-foyer-ink/75"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>

            <div className="pointer-events-none absolute inset-x-0 bottom-1.5 flex justify-center gap-1">
              {photos.map((p, k) => (
                <span
                  key={p}
                  className={cn(
                    "size-1.5 rounded-full transition-colors",
                    k === i ? "bg-white" : "bg-white/45",
                  )}
                />
              ))}
            </div>
          </>
        )}

        {selected && (
          <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-foyer-sage text-white shadow-sm">
            <Check className="size-4" aria-hidden />
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <span className="font-serif text-[18px] leading-tight text-foyer-ink">{style.name}</span>
        <p className="line-clamp-2 text-[12px] leading-snug text-foyer-muted">
          {style.description}
        </p>
        <div className="mt-auto flex gap-1.5 pt-1">
          {style.paletteHex.slice(0, 3).map((hex) => (
            <span
              key={hex}
              className="size-4 rounded-full border border-black/5"
              style={{ backgroundColor: hex }}
              aria-hidden
            />
          ))}
        </div>
      </div>
    </div>
  );
}
