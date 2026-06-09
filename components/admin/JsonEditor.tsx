"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

type Pair = { key: string; value: string };

type Props = {
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
  label?: string;
};

function toObject(pairs: Pair[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const { key, value } of pairs) {
    if (key.trim()) obj[key.trim()] = value;
  }
  return obj;
}

function toPairs(obj: Record<string, unknown>): Pair[] {
  return Object.entries(obj).map(([k, v]) => ({ key: k, value: String(v) }));
}

export function JsonEditor({ value, onChange, label }: Props) {
  const [pairs, setPairs] = useState<Pair[]>(() => toPairs(value));

  useEffect(() => {
    setPairs(toPairs(value));
  }, []);

  function update(idx: number, field: "key" | "value", val: string) {
    const next = pairs.map((p, i) => (i === idx ? { ...p, [field]: val } : p));
    setPairs(next);
    onChange(toObject(next));
  }

  function add() {
    const next = [...pairs, { key: "", value: "" }];
    setPairs(next);
    onChange(toObject(next));
  }

  function remove(idx: number) {
    const next = pairs.filter((_, i) => i !== idx);
    setPairs(next);
    onChange(toObject(next));
  }

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-xs font-medium text-foyer-muted uppercase tracking-wide">
          {label}
        </label>
      )}

      {pairs.length === 0 && (
        <p className="text-xs text-foyer-muted italic">
          Aucune condition — ce prompt matche toujours (fallback générique).
        </p>
      )}

      {pairs.map((pair, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            value={pair.key}
            onChange={(e) => update(idx, "key", e.target.value)}
            placeholder="clé"
            className="w-1/3 rounded border border-foyer-border bg-white px-2.5 py-1.5 text-xs font-mono text-foyer-ink outline-none focus:border-foyer-ink"
          />
          <span className="text-foyer-muted text-xs">=</span>
          <input
            value={pair.value}
            onChange={(e) => update(idx, "value", e.target.value)}
            placeholder="valeur"
            className="flex-1 rounded border border-foyer-border bg-white px-2.5 py-1.5 text-xs font-mono text-foyer-ink outline-none focus:border-foyer-ink"
          />
          <button
            type="button"
            onClick={() => remove(idx)}
            className="text-foyer-muted hover:text-foyer-terra transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1 text-xs text-foyer-sage hover:underline"
      >
        <Plus size={12} />
        Ajouter une condition
      </button>
    </div>
  );
}
