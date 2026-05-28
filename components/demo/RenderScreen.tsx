"use client";

import { BeforeAfterSlider } from "@/components/landing/BeforeAfterSlider";
import { PrimaryButton } from "@/components/demo/primitives";
import type { RoomType } from "@/lib/types";

export function RenderScreen({
  roomType,
  onRefine,
}: {
  roomType: RoomType | null;
  onRefine: () => void;
}) {
  const roomLabel = roomType === "chambre" ? "chambre" : "salon";

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="font-serif text-[26px] font-medium leading-tight tracking-[-0.02em] text-foyer-ink">
        Voilà votre {roomLabel}.
      </h1>
      <div className="mt-5">
        <BeforeAfterSlider
          beforeUrl="/demo/origin.png"
          afterUrl="/demo/render1.png"
        />
      </div>
      <p className="mt-4 text-center text-sm text-foyer-muted">
        Pas tout à fait ça ? Affinez.
      </p>
      <div className="mt-6">
        <PrimaryButton onClick={onRefine}>Affiner le rendu</PrimaryButton>
      </div>
    </div>
  );
}
