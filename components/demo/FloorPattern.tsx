import type { ReactNode } from "react";
import type { FloorPatternId } from "@/components/demo/demo-types";

const BG = "#F0EBE2";
const STROKE = "#6B645A";

function Frame({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 64 40"
      className="size-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <rect width="64" height="40" fill={BG} />
      <g stroke={STROKE} strokeWidth={1.2} fill="none">
        {children}
      </g>
    </svg>
  );
}

export function FloorPattern({ pattern }: { pattern: FloorPatternId }) {
  switch (pattern) {
    case "droit":
      return (
        <Frame>
          <line x1="0" y1="13.3" x2="64" y2="13.3" />
          <line x1="0" y1="26.6" x2="64" y2="26.6" />
          <line x1="32" y1="0" x2="32" y2="40" />
        </Frame>
      );
    case "anglaise":
      return (
        <Frame>
          <line x1="0" y1="13.3" x2="64" y2="13.3" />
          <line x1="0" y1="26.6" x2="64" y2="26.6" />
          <line x1="32" y1="0" x2="32" y2="13.3" />
          <line x1="16" y1="13.3" x2="16" y2="26.6" />
          <line x1="48" y1="13.3" x2="48" y2="26.6" />
          <line x1="32" y1="26.6" x2="32" y2="40" />
        </Frame>
      );
    case "chevron":
      return (
        <Frame>
          <polyline points="0,12 16,4 32,12 48,4 64,12" />
          <polyline points="0,26 16,18 32,26 48,18 64,26" />
          <polyline points="0,40 16,32 32,40 48,32 64,40" />
          <line x1="32" y1="0" x2="32" y2="40" strokeOpacity={0.35} />
        </Frame>
      );
    case "beton":
      return (
        <Frame>
          <line x1="-2" y1="28" x2="66" y2="16" strokeOpacity={0.2} />
          <line x1="-2" y1="36" x2="66" y2="26" strokeOpacity={0.12} />
        </Frame>
      );
    case "carrelage":
      return (
        <Frame>
          <line x1="16" y1="0" x2="16" y2="40" />
          <line x1="32" y1="0" x2="32" y2="40" />
          <line x1="48" y1="0" x2="48" y2="40" />
          <line x1="0" y1="13.3" x2="64" y2="13.3" />
          <line x1="0" y1="26.6" x2="64" y2="26.6" />
        </Frame>
      );
  }
}
