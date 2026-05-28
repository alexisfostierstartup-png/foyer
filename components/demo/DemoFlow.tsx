"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
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

export function DemoFlow() {
  const [step, setStep] = useState<Step>("home");
  const [choices, setChoices] = useState<UserChoices>(initialChoices);

  function restart() {
    setChoices(initialChoices);
    setStep("home");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-foyer-cream">
      <header className="flex items-center justify-between border-b border-foyer-border px-5 py-3">
        <span className="font-serif text-xl tracking-tight text-foyer-ink">
          Foyer
        </span>
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
