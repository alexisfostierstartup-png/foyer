"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Carte "écran téléphone" : fond blanc, coins très arrondis, poignée grise en haut. */
export function PhoneCard({
  children,
  className,
  withHandle = true,
}: {
  children: ReactNode;
  className?: string;
  withHandle?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative rounded-3xl border border-foyer-border bg-white p-5 shadow-sm",
        withHandle && "pt-7",
        className,
      )}
    >
      {withHandle && (
        <span
          className="absolute left-1/2 top-3 h-[5px] w-10 -translate-x-1/2 rounded-full bg-foyer-border"
          aria-hidden
        />
      )}
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-foyer-muted">
      {children}
    </p>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-[52px] w-full items-center justify-center gap-2 rounded-full font-medium transition-colors",
        disabled
          ? "cursor-not-allowed bg-foyer-border text-foyer-muted"
          : "bg-foyer-terra-deep text-white hover:bg-foyer-terra-deep/90",
      )}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full border border-foyer-border bg-transparent font-medium text-foyer-ink transition-colors hover:bg-white"
    >
      {children}
    </button>
  );
}

/** Image de la démo, avec fallback placeholder gris si le fichier manque. */
export function DemoImage({
  src,
  alt,
  label,
  className,
  ratio = "aspect-[4/3]",
}: {
  src: string;
  alt: string;
  label: string;
  className?: string;
  ratio?: string;
}) {
  const [ok, setOk] = useState(true);
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border border-foyer-border bg-foyer-cream",
        ratio,
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

/** Faux loader : skeleton shimmer + messages qui défilent, puis onDone. */
export function DemoLoader({
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
    <div className="flex flex-1 flex-col justify-center">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-foyer-border bg-foyer-border/40">
        <div className="absolute inset-0 animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
      </div>
      <ul className="mx-auto mt-8 flex w-full max-w-xs flex-col gap-3">
        {messages.map((m, idx) => {
          const state = idx < i ? "done" : idx === i ? "current" : "todo";
          return (
            <li key={m} className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border",
                  state === "done" && "border-foyer-sage bg-foyer-sage text-white",
                  state === "current" && "border-foyer-terra text-foyer-terra",
                  state === "todo" && "border-foyer-border text-foyer-border",
                )}
              >
                {state === "done" && <Check className="size-3" aria-hidden />}
                {state === "current" && (
                  <Loader2 className="size-3 animate-spin" aria-hidden />
                )}
              </span>
              <span
                className={cn(
                  "text-[15px]",
                  state === "todo" ? "text-foyer-muted/60" : "text-foyer-ink",
                  state === "current" && "font-medium",
                )}
              >
                {m}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
