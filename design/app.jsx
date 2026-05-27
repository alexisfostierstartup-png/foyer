// Foyer — root app + simple router

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "startScreen": "landing",
  "primary": "#7FA08C"
}/*EDITMODE-END*/;

const PALETTE_OPTIONS = [
  "#8FA68A", // 1 · Sauge doux
  "#7FA08C", // 2 · Eucalyptus
  "#6E8B6B", // 3 · Mousse profond
  "#A5B8A0", // 4 · Vert d'eau
  "#8B9F6B", // 5 · Olive doré
];

const PALETTE_LABELS = {
  "#8FA68A": "Sauge doux",
  "#7FA08C": "Eucalyptus",
  "#6E8B6B": "Mousse profond",
  "#A5B8A0": "Vert d'eau",
  "#8B9F6B": "Olive doré",
};

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
function relLuma([r, g, b]) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ThemeApplier({ primary }) {
  React.useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty("--primary", primary);
    r.style.setProperty("--ring", primary);
    // Pick a readable foreground on the primary surface
    const lum = relLuma(hexToRgb(primary));
    const fg = lum > 0.55 ? "#1F1B16" : "#FAF6F0";
    r.style.setProperty("--primary-foreground", fg);
  }, [primary]);
  return null;
}

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = React.useState(tweaks.startScreen || "landing");

  const go = (s) => { setScreen(s); window.scrollTo({ top: 0 }); };
  const goHome = () => go("landing");

  return (
    <React.Fragment>
      <ThemeApplier primary={tweaks.primary}/>
      {screen === "landing"    && <LandingPage onCTA={() => go("upload")}/>}
      {screen === "upload"     && <UploadStep    goNext={() => go("style")}     goHome={goHome}/>}
      {screen === "style"      && <StyleStep     goNext={() => go("generating")} goBack={() => go("upload")}/>}
      {screen === "generating" && <Generating    goNext={() => go("render")}/>}
      {screen === "render"     && <RenderStep    goNext={() => go("checkout")}  goBack={() => go("style")}/>}
      {screen === "checkout"   && <CheckoutStep  goBack={() => go("render")}    goHome={goHome}/>}

      <TweaksPanel title="Tweaks">
        <TweakSection label={`Accent · ${PALETTE_LABELS[tweaks.primary] || "Personnalisé"}`}>
          <TweakColor
            label="Couleur principale"
            value={tweaks.primary}
            options={PALETTE_OPTIONS}
            onChange={(v) => setTweak("primary", v)}
          />
        </TweakSection>
        <TweakSection label="Navigation">
          <TweakButton label="Landing"    onClick={() => go("landing")}/>
          <TweakButton label="1 · Upload" onClick={() => go("upload")}/>
          <TweakButton label="2 · Style"  onClick={() => go("style")}/>
          <TweakButton label="3 · Génération" onClick={() => go("generating")}/>
          <TweakButton label="4 · Rendu"  onClick={() => go("render")}/>
          <TweakButton label="5 · Récap commandes" onClick={() => go("checkout")}/>
        </TweakSection>
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
