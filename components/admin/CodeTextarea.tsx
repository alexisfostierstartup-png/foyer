"use client";

import { useState } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  rows?: number;
};

const VAR_REGEX = /\{\{(\w+)\}\}/g;

function renderPreview(template: string) {
  const parts: Array<{ text: string; isVar: boolean }> = [];
  let last = 0;
  let match;
  VAR_REGEX.lastIndex = 0;

  while ((match = VAR_REGEX.exec(template)) !== null) {
    if (match.index > last) {
      parts.push({ text: template.slice(last, match.index), isVar: false });
    }
    parts.push({ text: match[0], isVar: true });
    last = match.index + match[0].length;
  }

  if (last < template.length) {
    parts.push({ text: template.slice(last), isVar: false });
  }

  return parts;
}

export function CodeTextarea({ value, onChange, label, rows = 12 }: Props) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-medium text-foyer-muted uppercase tracking-wide">
          {label}
        </label>
      )}

      <div className="flex gap-0.5 mb-1">
        {(["edit", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              tab === t
                ? "bg-foyer-ink text-foyer-cream"
                : "text-foyer-muted hover:bg-foyer-border"
            }`}
          >
            {t === "edit" ? "Éditer" : "Aperçu"}
          </button>
        ))}
      </div>

      {tab === "edit" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          spellCheck={false}
          className="w-full rounded-lg border border-foyer-border bg-white px-3.5 py-3 text-xs font-mono text-foyer-ink outline-none focus:border-foyer-ink resize-y"
        />
      ) : (
        <div
          className="w-full rounded-lg border border-foyer-border bg-white px-3.5 py-3 text-xs font-mono text-foyer-ink whitespace-pre-wrap break-words overflow-y-auto"
          style={{ minHeight: `${rows * 1.5}rem` }}
        >
          {value
            ? renderPreview(value).map((part, i) =>
                part.isVar ? (
                  <mark
                    key={i}
                    className="bg-foyer-ochre/30 text-foyer-ink rounded px-0.5"
                  >
                    {part.text}
                  </mark>
                ) : (
                  <span key={i}>{part.text}</span>
                ),
              )
            : <span className="text-foyer-muted italic">Template vide.</span>}
        </div>
      )}
    </div>
  );
}
