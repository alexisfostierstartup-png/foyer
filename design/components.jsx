// Foyer — shared primitives (mirrors the Lovable build)
const { useState, useRef, useEffect, useCallback } = React;

/* Lucide-style line icons (subset used by Foyer) */
function Icon({ name, size = 18, stroke = 2, className = "", style }) {
  const common = {
    width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor",
    strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round",
    className, style,
  };
  switch (name) {
    case "camera":   return <svg {...common}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/></svg>;
    case "image":    return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>;
    case "sparkles": return <svg {...common}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>;
    case "ruler":    return <svg {...common}><path d="M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0L2.7 16.7a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4Z"/><path d="m7.5 10.5 2 2M10.5 7.5l2 2M13.5 4.5l2 2M4.5 13.5l2 2"/></svg>;
    case "package":  return <svg {...common}><path d="m7.5 4.27 9 5.15"/><path d="M21 8 12 13 3 8"/><path d="M3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8Z"/><path d="M12 22V13"/></svg>;
    case "compass":  return <svg {...common}><circle cx="12" cy="12" r="10"/><path d="m16 8-3.5 7.5L5 19l3.5-7.5L16 8Z"/></svg>;
    case "leaf":     return <svg {...common}><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2.5c1 1.5.5 7-1.5 11-1.5 3-4 6.5-7.7 6.5"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/></svg>;
    case "arrow-right": return <svg {...common}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>;
    case "check":    return <svg {...common}><path d="M20 6 9 17l-5-5"/></svg>;
    case "chevron-down": return <svg {...common}><path d="m6 9 6 6 6-6"/></svg>;
    case "chevron-left": return <svg {...common}><path d="m15 18-6-6 6-6"/></svg>;
    case "refresh":  return <svg {...common}><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>;
    case "share":    return <svg {...common}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>;
    case "bookmark": return <svg {...common}><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z"/></svg>;
    case "drag":     return <svg {...common}><path d="m8 7-4 5 4 5"/><path d="m16 7 4 5-4 5"/></svg>;
    default: return null;
  }
}

/* Before/After slider — uses real image paths */
function BeforeAfterSlider({ before, after, alt = "Avant / Après", className = "" }) {
  const [pos, setPos] = useState(52);
  const ref = useRef(null);
  const dragging = useRef(false);

  const move = (clientX) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, p)));
  };

  useEffect(() => {
    const up = () => { dragging.current = false; };
    const mm = (e) => { if (dragging.current) move(e.clientX); };
    const tm = (e) => { if (dragging.current && e.touches[0]) move(e.touches[0].clientX); };
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    window.addEventListener("mousemove", mm);
    window.addEventListener("touchmove", tm, { passive: true });
    return () => {
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("touchmove", tm);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`relative w-full aspect-[4/3] overflow-hidden rounded-3xl border border-border bg-muted select-none touch-none ${className}`}
    >
      <img src={after} alt={`${alt} — après`} className="absolute inset-0 h-full w-full object-cover" draggable="false"/>
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        <img
          src={before}
          alt={`${alt} — avant`}
          className="absolute inset-0 h-full object-cover"
          style={{ width: `${100 / (pos / 100)}%`, maxWidth: "none", height: "100%" }}
          draggable="false"
        />
      </div>
      <span style={{
        position: "absolute", left: 12, top: 12,
        background: "rgba(31,27,22,0.78)", color: "var(--cream)",
        padding: "5px 12px", borderRadius: 999,
        fontSize: 11, fontWeight: 500, letterSpacing: "0.08em",
      }}>AVANT</span>
      <span style={{
        position: "absolute", right: 12, top: 12,
        background: "rgba(250,246,240,0.92)", color: "var(--ink)",
        padding: "5px 12px", borderRadius: 999,
        fontSize: 11, fontWeight: 500, letterSpacing: "0.08em",
      }}>APRÈS</span>
      <div
        style={{
          position: "absolute", top: 0, bottom: 0,
          width: 1, left: `${pos}%`,
          background: "var(--cream)",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.1)",
        }}
      />
      <button
        type="button"
        aria-label="Glisser pour comparer"
        onMouseDown={(e) => { e.preventDefault(); dragging.current = true; }}
        onTouchStart={() => { dragging.current = true; }}
        className="grid place-items-center rounded-full bg-cream border border-border shadow-md cursor-ew-resize"
        style={{
          position: "absolute", top: "50%", left: `${pos}%`,
          transform: "translate(-50%, -50%)",
          width: 44, height: 44,
        }}
      >
        <Icon name="drag" size={18}/>
      </button>
    </div>
  );
}

Object.assign(window, { Icon, BeforeAfterSlider });
