const SEGMENTS = [
  { value: 60, label: "conservé", color: "#6B8E6F", dot: "bg-foyer-sage" },
  { value: 15, label: "occasion", color: "#6E8B6B", dot: "bg-foyer-mousse" },
  { value: 25, label: "neuf durable", color: "#A5B8A0", dot: "bg-foyer-water" },
];

const CO2_KG = 42;

export function ScoreDonut() {
  // Circumference = 100 so each segment length == its percentage.
  let acc = 0;

  return (
    <div className="rounded-2xl border border-foyer-border bg-white p-4">
      <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-foyer-muted">
        Score Foyer
      </p>
      <div className="flex items-center gap-5">
        <div className="size-28 shrink-0">
          <svg viewBox="0 0 42 42" className="size-full">
            <circle
              cx="21"
              cy="21"
              r="15.9155"
              fill="none"
              stroke="#E5DDD0"
              strokeWidth="4"
            />
            <g transform="rotate(-90 21 21)">
              {SEGMENTS.map((s) => {
                const offset = -acc;
                acc += s.value;
                return (
                  <circle
                    key={s.label}
                    cx="21"
                    cy="21"
                    r="15.9155"
                    fill="none"
                    stroke={s.color}
                    strokeWidth="4"
                    strokeDasharray={`${s.value} ${100 - s.value}`}
                    strokeDashoffset={offset}
                  />
                );
              })}
            </g>
          </svg>
        </div>

        <div className="flex-1">
          <ul className="flex flex-col gap-1.5">
            {SEGMENTS.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-[15px]">
                <span className={`size-2.5 rounded-full ${s.dot}`} aria-hidden />
                <span className="text-foyer-ink">
                  {s.value}% {s.label}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 font-serif text-xl text-foyer-ink">
            {CO2_KG} kg CO<sub>2</sub>{" "}
            <span className="font-sans text-sm text-foyer-muted">évités</span>
          </p>
        </div>
      </div>

      <p className="mt-4 text-[12px] leading-relaxed text-foyer-muted">
        Base ADEME, calcul indicatif. {CO2_KG} kg CO₂ évités par rapport à un
        projet tout-neuf équivalent.
      </p>
    </div>
  );
}
