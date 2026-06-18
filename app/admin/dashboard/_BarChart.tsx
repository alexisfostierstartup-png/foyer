"use client";

import type { DayCost } from "./_data";

export function BarChart({ data }: { data: DayCost[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-foyer-muted">
        Aucune donnée sur 30 jours
      </div>
    );
  }

  const maxCost = Math.max(...data.map((d) => d.cost));
  const H = 120; // bar area height px

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1 min-w-0" style={{ height: H + 32 }}>
        {data.map((d) => {
          const barH = maxCost > 0 ? Math.max(2, (d.cost / maxCost) * H) : 2;
          const label = d.day.slice(5); // "MM-DD"
          return (
            <div
              key={d.day}
              className="group relative flex flex-col items-center flex-1 min-w-[6px]"
              style={{ height: H + 32 }}
            >
              {/* Bar */}
              <div className="flex-1 flex items-end w-full px-px">
                <div
                  className="w-full rounded-t bg-foyer-ink/70 group-hover:bg-foyer-terra transition-colors"
                  style={{ height: barH }}
                />
              </div>
              {/* Label */}
              <span className="text-[9px] text-foyer-muted mt-1 rotate-45 origin-top-left translate-x-2">
                {label}
              </span>
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-foyer-ink text-foyer-cream text-xs rounded px-2 py-1 whitespace-nowrap z-10 pointer-events-none">
                {d.day} — {fmtCost(d.cost)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const USD_EUR = 0.92;

function fmtCost(usd: number) {
  const v = usd * USD_EUR;
  return v < 0.001 ? `${(v * 1000).toFixed(3)} m€` : `${v.toFixed(4)} €`;
}
