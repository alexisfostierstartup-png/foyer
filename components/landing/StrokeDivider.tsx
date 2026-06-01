/**
 * Séparateur de section — trait sage ondulé, inspiré de adres.fr/YellowStrokeDivider.
 * Gradient de fond cream↔white pour lier les sections sans ligne droite ni fondu brutal.
 */

const CREAM = "#faf6f0";
const WHITE = "#ffffff";

export function StrokeDivider({
  dir,
}: {
  dir: "cream-to-white" | "white-to-cream";
}) {
  const from = dir === "cream-to-white" ? CREAM : WHITE;
  const to = dir === "cream-to-white" ? WHITE : CREAM;
  const id = `sd-grad-${dir}`;

  return (
    <div
      aria-hidden
      className="pointer-events-none w-full"
      style={{ height: 80, background: `linear-gradient(to bottom, ${from} 0%, ${to} 100%)` }}
    >
      <svg
        viewBox="0 0 1440 80"
        preserveAspectRatio="none"
        style={{ position: "absolute", width: "100%", height: 80, overflow: "visible" }}
      >
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6B8E6F" stopOpacity="0" />
            <stop offset="7%" stopColor="#6B8E6F" stopOpacity="1" />
            <stop offset="93%" stopColor="#6B8E6F" stopOpacity="1" />
            <stop offset="100%" stopColor="#6B8E6F" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Trait principal */}
        <path
          d="M 0 40 Q 240 12, 480 34 T 960 36 T 1440 26"
          stroke={`url(#${id})`}
          strokeWidth="18"
          fill="none"
          strokeLinecap="round"
          opacity="0.55"
        />
        {/* Trait secondaire fin */}
        <path
          d="M 60 52 Q 360 34, 640 48 T 1240 40"
          stroke="#6E8B6B"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          opacity="0.3"
        />
      </svg>
    </div>
  );
}
