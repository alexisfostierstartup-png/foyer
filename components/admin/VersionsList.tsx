"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export type PromptVersion = {
  id: string;
  version: number;
  saved_at: string;
  template: string;
  conditions: Record<string, unknown>;
  provider: string;
  notes: string | null;
};

type Props = {
  versions: PromptVersion[];
  onRestore: (v: PromptVersion) => void;
};

export function VersionsList({ versions, onRestore }: Props) {
  const [open, setOpen] = useState(false);

  if (versions.length === 0) return null;

  return (
    <div className="border border-foyer-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foyer-ink hover:bg-foyer-border/20 transition-colors"
      >
        <span>Historique des versions ({versions.length})</span>
        <ChevronDown
          size={16}
          className={`text-foyer-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-foyer-border divide-y divide-foyer-border">
          {versions.map((v) => (
            <div
              key={v.id}
              className="flex items-start justify-between gap-4 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-foyer-border px-1.5 py-0.5 rounded text-foyer-ink">
                    v{v.version}
                  </span>
                  <span className="text-xs text-foyer-muted">
                    {new Date(v.saved_at).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="text-xs text-foyer-muted">{v.provider}</span>
                </div>
                {v.notes && (
                  <p className="mt-1 text-xs text-foyer-muted truncate">
                    {v.notes}
                  </p>
                )}
                <p className="mt-1 text-xs text-foyer-muted font-mono truncate">
                  {v.template.slice(0, 100)}
                  {v.template.length > 100 ? "…" : ""}
                </p>
              </div>
              <button
                onClick={() => onRestore(v)}
                className="shrink-0 text-xs text-foyer-sage hover:underline"
              >
                Restaurer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
