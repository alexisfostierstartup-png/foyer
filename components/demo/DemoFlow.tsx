"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  ImagePlus,
  RotateCcw,
  ArrowRight,
  Sparkles,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BeforeAfterSlider } from "@/components/landing/BeforeAfterSlider";
import { ProductCard } from "@/components/demo/ProductCard";
import { demoProducts } from "@/lib/demo-products";
import stylesData from "@/data/styles.json";
import { cn } from "@/lib/utils";
import type { Style } from "@/lib/types";

const STYLES = stylesData as Style[];

type Step =
  | "upload"
  | "style"
  | "generating"
  | "render"
  | "iterate"
  | "retouching"
  | "final";

const ITERATION_CHIPS = [
  "Sol plus clair",
  "Ajouter un fauteuil",
  "Murs plus chauds",
  "Plus de lumière",
];

// ---------- shared helpers ----------

function DemoImage({
  src,
  alt,
  label,
  className,
}: {
  src: string;
  alt: string;
  label: string;
  className?: string;
}) {
  const [ok, setOk] = useState(true);
  return (
    <div
      className={cn(
        "relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-foyer-border bg-foyer-cream",
        className,
      )}
    >
      {ok ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          onError={() => setOk(false)}
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          <span className="rounded-full border border-foyer-border bg-white/70 px-3 py-1 text-xs text-foyer-muted">
            {label}
          </span>
        </div>
      )}
    </div>
  );
}

function FakeLoader({
  messages,
  totalMs,
  onDone,
}: {
  messages: string[];
  totalMs: number;
  onDone: () => void;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const stepMs = totalMs / messages.length;
    const interval = setInterval(() => {
      setI((prev) => Math.min(prev + 1, messages.length - 1));
    }, stepMs);
    const done = setTimeout(onDone, totalMs);
    return () => {
      clearInterval(interval);
      clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-foyer-border bg-foyer-border/40">
        <div className="absolute inset-0 animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
      </div>
      <p className="mt-8 text-center font-serif text-xl text-foyer-ink">
        {messages[i]}
      </p>
    </div>
  );
}

// ---------- main flow ----------

export function DemoFlow() {
  const [step, setStep] = useState<Step>("upload");
  const [roomReady, setRoomReady] = useState(false);
  const [styleId, setStyleId] = useState("doux");

  function restart() {
    setStep("upload");
    setRoomReady(false);
    setStyleId("doux");
  }

  const selectedStyle = STYLES.find((s) => s.id === styleId) ?? STYLES[0];

  return (
    <div className="flex min-h-dvh flex-col bg-foyer-cream">
      <header className="flex items-center justify-between border-b border-foyer-border px-5 py-3">
        <span className="font-serif text-xl tracking-tight text-foyer-ink">
          Foyer
        </span>
        {step !== "upload" && (
          <button
            type="button"
            onClick={restart}
            className="flex items-center gap-1.5 text-[13px] text-foyer-muted hover:text-foyer-ink"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Recommencer
          </button>
        )}
      </header>

      <main
        key={step}
        className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-6 duration-300 animate-in fade-in"
      >
        {step === "upload" && (
          <UploadScreen
            roomReady={roomReady}
            onPick={() => setRoomReady(true)}
            onContinue={() => setStep("style")}
          />
        )}

        {step === "style" && (
          <StyleScreen
            styleId={styleId}
            onSelect={setStyleId}
            onGenerate={() => setStep("generating")}
          />
        )}

        {step === "generating" && (
          <FakeLoader
            totalMs={6000}
            onDone={() => setStep("render")}
            messages={[
              "On analyse votre pièce…",
              "On identifie ce qui est déjà en place…",
              `On applique l'ambiance ${selectedStyle.name}…`,
              "On finalise le rendu…",
            ]}
          />
        )}

        {step === "render" && (
          <RenderScreen
            onRefine={() => setStep("iterate")}
            onLove={() => setStep("final")}
          />
        )}

        {step === "iterate" && (
          <IterateScreen onApply={() => setStep("retouching")} />
        )}

        {step === "retouching" && (
          <FakeLoader
            totalMs={3000}
            onDone={() => setStep("final")}
            messages={["On retouche votre rendu…"]}
          />
        )}

        {step === "final" && <FinalScreen onRestart={restart} />}
      </main>
    </div>
  );
}

// ---------- screens ----------

function UploadScreen({
  roomReady,
  onPick,
  onContinue,
}: {
  roomReady: boolean;
  onPick: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <h1 className="font-serif text-[30px] font-medium leading-tight tracking-[-0.02em] text-foyer-ink">
        Votre pièce, transformée. Réellement.
      </h1>
      <p className="mt-3 text-[16px] leading-relaxed text-foyer-muted">
        Prenez une photo, on imagine le projet ET on vous dit où tout acheter.
      </p>

      {roomReady ? (
        <div className="mt-6 flex flex-1 flex-col">
          <DemoImage src="/demo/origin.png" alt="Votre pièce" label="origin" />
          <div className="mt-4 flex items-center gap-2">
            <span className="rounded-full bg-foyer-terra-deep px-3 py-1.5 text-sm font-medium text-white">
              Salon
            </span>
            <span className="text-sm text-foyer-muted">Pièce détectée</span>
          </div>
          <Button
            type="button"
            size="lg"
            onClick={onContinue}
            className="mt-auto h-12 w-full rounded-full bg-foyer-terra-deep text-white hover:bg-foyer-terra-deep/90"
          >
            Continuer
          </Button>
        </div>
      ) : (
        <div className="mt-6 flex flex-1 flex-col">
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-foyer-border px-6 py-12 text-center">
            <Camera
              className="mb-4 size-10 text-foyer-muted"
              strokeWidth={1.5}
              aria-hidden
            />
            <div className="flex w-full flex-col gap-3">
              <Button
                type="button"
                size="lg"
                onClick={onPick}
                className="h-12 w-full rounded-full bg-foyer-terra-deep text-white hover:bg-foyer-terra-deep/90"
              >
                <Camera className="size-5" aria-hidden />
                Prendre une photo
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={onPick}
                className="h-12 w-full rounded-full text-foyer-ink"
              >
                <ImagePlus className="size-5" aria-hidden />
                Importer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StyleScreen({
  styleId,
  onSelect,
  onGenerate,
}: {
  styleId: string;
  onSelect: (id: string) => void;
  onGenerate: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <h1 className="font-serif text-[28px] font-medium leading-tight tracking-[-0.02em] text-foyer-ink">
        Quelle ambiance ?
      </h1>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {STYLES.map((s) => {
          const selected = s.id === styleId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              className={cn(
                "relative overflow-hidden rounded-2xl border bg-white text-left transition-all",
                selected
                  ? "border-2 border-foyer-terra ring-2 ring-foyer-terra/20"
                  : "border-foyer-border",
              )}
            >
              <div
                className="aspect-[4/3] w-full"
                style={{
                  background: `linear-gradient(135deg, ${s.paletteHex.join(", ")})`,
                }}
              />
              {selected && (
                <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-foyer-terra text-white">
                  <Check className="size-3.5" aria-hidden />
                </span>
              )}
              <span className="block px-3 py-2 font-serif text-[15px] text-foyer-ink">
                {s.name}
              </span>
            </button>
          );
        })}
      </div>
      <Button
        type="button"
        size="lg"
        onClick={onGenerate}
        className="mt-auto h-12 w-full rounded-full bg-foyer-terra-deep text-white hover:bg-foyer-terra-deep/90"
      >
        Générer le rendu
      </Button>
    </div>
  );
}

function RenderScreen({
  onRefine,
  onLove,
}: {
  onRefine: () => void;
  onLove: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <h1 className="font-serif text-[28px] font-medium leading-tight tracking-[-0.02em] text-foyer-ink">
        Voilà votre salon.
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
      <div className="mt-6 flex flex-col gap-3">
        <Button
          type="button"
          size="lg"
          onClick={onLove}
          className="h-12 w-full rounded-full bg-foyer-terra-deep text-white hover:bg-foyer-terra-deep/90"
        >
          J&apos;adore, voir les meubles
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={onRefine}
          className="h-12 w-full rounded-full border border-foyer-border text-foyer-ink"
        >
          Affiner le rendu
        </Button>
      </div>
    </div>
  );
}

function IterateScreen({ onApply }: { onApply: () => void }) {
  const [active, setActive] = useState<string[]>([]);
  const [note, setNote] = useState("");

  function toggle(chip: string) {
    setActive((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip],
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="font-serif text-[28px] font-medium leading-tight tracking-[-0.02em] text-foyer-ink">
        Qu&apos;aimeriez-vous changer ?
      </h1>
      <div className="mt-5">
        <DemoImage src="/demo/render1.png" alt="Rendu actuel" label="render1" />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {ITERATION_CHIPS.map((chip) => {
          const on = active.includes(chip);
          return (
            <button
              key={chip}
              type="button"
              onClick={() => toggle(chip)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                on
                  ? "border-foyer-terra bg-foyer-terra/10 text-foyer-ink"
                  : "border-foyer-border text-foyer-muted hover:text-foyer-ink",
              )}
            >
              {chip}
            </button>
          );
        })}
      </div>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Autre chose ? Décrivez-le…"
        className="mt-3 w-full rounded-xl border border-foyer-border bg-white px-4 py-3 text-[15px] text-foyer-ink outline-none placeholder:text-foyer-muted focus:border-foyer-terra"
      />
      <Button
        type="button"
        size="lg"
        onClick={onApply}
        className="mt-auto h-12 w-full rounded-full bg-foyer-terra-deep text-white hover:bg-foyer-terra-deep/90"
      >
        <Sparkles className="size-5" aria-hidden />
        Appliquer
      </Button>
    </div>
  );
}

function FinalScreen({ onRestart }: { onRestart: () => void }) {
  const { secondhand, ecoNew, total } = useMemo(() => {
    let sh = 0;
    let en = 0;
    let sum = 0;
    for (const p of demoProducts) {
      if (p.source === "secondhand") sh += 1;
      else en += 1;
      sum += Number(p.price.replace(/[^\d]/g, ""));
    }
    return { secondhand: sh, ecoNew: en, total: sum };
  }, []);

  return (
    <div className="flex flex-1 flex-col">
      <div className="relative">
        <DemoImage src="/demo/final.png" alt="Votre projet" label="final" />
        <span className="absolute left-3 top-3 rounded-full bg-foyer-ink/70 px-2.5 py-1 text-xs font-medium text-foyer-cream">
          Votre projet
        </span>
      </div>

      <h2 className="mt-6 font-serif text-2xl font-medium text-foyer-ink">
        Tout ce qu&apos;on voit, vous pouvez l&apos;avoir.
      </h2>
      <p className="mt-2 text-[15px] text-foyer-muted">
        On privilégie la seconde main, puis le neuf responsable.
      </p>

      <ul className="mt-5 flex flex-col gap-3">
        {demoProducts.map((p) => (
          <li key={p.id}>
            <ProductCard product={p} />
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-2xl border border-foyer-border bg-white p-4">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-foyer-ink">
          Score Foyer
        </p>
        <p className="mt-2 text-[15px] text-foyer-muted">
          {secondhand} pièces chinées · {ecoNew} neuves responsables · ~48 kg
          CO₂ évités
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <span className="text-[15px] text-foyer-muted">Total du projet</span>
        <span className="font-serif text-2xl text-foyer-ink">~{total} €</span>
      </div>

      <Button
        type="button"
        size="lg"
        className="mt-5 h-12 w-full rounded-full bg-foyer-terra-deep text-white hover:bg-foyer-terra-deep/90"
      >
        Tout ouvrir
        <ArrowRight className="size-4" aria-hidden />
      </Button>

      <button
        type="button"
        onClick={onRestart}
        className="mx-auto mt-5 text-[13px] text-foyer-muted underline underline-offset-4 hover:text-foyer-ink"
      >
        Recommencer la démo
      </button>
    </div>
  );
}
