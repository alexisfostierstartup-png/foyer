import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Style } from "@/lib/types";

type StyleCardProps = {
  style: Style;
  selected: boolean;
  onSelect: () => void;
};

export function StyleCard({ style, selected, onSelect }: StyleCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-white text-left transition-all duration-150",
        "hover:scale-[1.02] active:scale-100 active:ring-2 active:ring-foyer-sage/40",
        selected
          ? "border-2 border-foyer-sage ring-2 ring-foyer-sage/20"
          : "border-foyer-border",
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-foyer-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={style.moodboardUrl}
          alt={`Ambiance ${style.name}`}
          className="size-full object-cover"
        />
        {/* Infobulle : description longue au survol (desktop — Tailwind v4 gate
            hover: sur les devices qui le supportent, pas de conflit tactile). */}
        {style.longDescription && (
          <div
            role="tooltip"
            className="pointer-events-none absolute inset-0 flex items-center bg-foyer-ink/85 p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          >
            <p className="text-[11.5px] leading-snug text-white/95">
              {style.longDescription}
            </p>
          </div>
        )}
        {selected && (
          <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-foyer-sage text-white shadow-sm">
            <Check className="size-4" aria-hidden />
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <span className="font-serif text-[18px] leading-tight text-foyer-ink">
          {style.name}
        </span>
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
    </button>
  );
}
