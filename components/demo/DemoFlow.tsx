"use client";

import { useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { DemoLoader } from "@/components/demo/primitives";
import { HomeScreen } from "@/components/demo/HomeScreen";
import { StyleScreen } from "@/components/demo/StyleScreen";
import { RenderScreen } from "@/components/demo/RenderScreen";
import { IterateScreen } from "@/components/demo/IterateScreen";
import { FinalScreen } from "@/components/demo/FinalScreen";
import { initialChoices, type UserChoices } from "@/components/demo/demo-types";

type Step =
  | "home"
  | "style"
  | "generating"
  | "render1"
  | "iterate"
  | "retouching"
  | "final";

const PROGRESS_LABELS = ["Photo", "Ambiance", "Rendu", "Affiner", "Projet"];

const STEP_TO_PROGRESS: Record<Step, number> = {
  home: 1,
  style: 2,
  generating: 2,
  render1: 3,
  iterate: 4,
  retouching: 4,
  final: 5,
};

function ProgressBar({ current }: { current: number }) {
  return (
    <div className="px-5 pb-3">
      <div className="flex items-center gap-1.5">
        {PROGRESS_LABELS.map((label, i) => {
          const n = i + 1;
          return (
            <span
              key={label}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                n === current && "bg-foyer-sage",
                n < current && "bg-foyer-mousse",
                n > current && "bg-foyer-border",
              )}
            />
          );
        })}
      </div>
      <p className="mt-1.5 text-[12px] text-foyer-muted">
        Étape {current} sur {PROGRESS_LABELS.length} —{" "}
        {PROGRESS_LABELS[current - 1]}
      </p>
    </div>
  );
}

export function DemoFlow() {
  const [step, setStep] = useState<Step>("home");
  const [choices, setChoices] = useState<UserChoices>(initialChoices);

  function restart() {
    setChoices(initialChoices);
    setStep("home");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-foyer-cream">
      <header className="sticky top-0 z-10 border-b border-foyer-border bg-foyer-cream/95 backdrop-blur">
        <div className="flex items-center justify-between px-5 py-3">
          <Link
            href="/"
            className="font-serif text-xl tracking-tight text-foyer-ink"
          >
            Foyer
          </Link>
          {step !== "home" && (
            <button
              type="button"
              onClick={restart}
              className="flex items-center gap-1.5 text-[13px] text-foyer-muted hover:text-foyer-ink"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Recommencer
            </button>
          )}
        </div>
        <ProgressBar current={STEP_TO_PROGRESS[step]} />
      </header>

      <main
        key={step}
        className="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-5 py-6 duration-300 animate-in fade-in"
      >
        {step === "home" && (
          <HomeScreen
            choices={choices}
            setChoices={setChoices}
            onContinue={() => setStep("style")}
          />
        )}

        {step === "style" && (
          <StyleScreen
            choices={choices}
            setChoices={setChoices}
            onGenerate={() => setStep("generating")}
          />
        )}

        {step === "generating" && (
          <DemoLoader
            totalMs={6000}
            onDone={() => setStep("render1")}
            messages={[
              "On analyse votre pièce…",
              "On identifie ce qui est déjà en place…",
              "On applique l'ambiance Doux…",
              "On finalise le rendu…",
            ]}
          />
        )}

        {step === "render1" && (
          <RenderScreen
            roomType={choices.roomType}
            onRefine={() => setStep("iterate")}
            onLove={() => setStep("final")}
          />
        )}

        {step === "iterate" && (
          <IterateScreen onApply={() => setStep("retouching")} />
        )}

        {step === "retouching" && (
          <DemoLoader
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
