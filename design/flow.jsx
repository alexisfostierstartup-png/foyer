// Foyer — Creation flow (5 screens) — mirrors Lovable source
const { useState: useStateF, useEffect: useEffectF, useRef: useRefF } = React;

/* ───── Shared chrome ───── */
function ProgressBar({ step, total = 5 }) {
  const pct = (step / total) * 100;
  return (
    <div className="px-5 pt-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span className="uppercase tracking-wide">Étape {step} sur {total}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary transition" style={{ width: `${pct}%` }}/>
      </div>
    </div>
  );
}

function BackBar({ label = "Quitter", onClick, right }) {
  return (
    <div className="px-5 h-12 flex items-center justify-between">
      <button onClick={onClick} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <Icon name="chevron-left" size={16}/> {label}
      </button>
      {right}
    </div>
  );
}

/* ───── Screen 1 — Upload ───── */
function UploadStep({ goNext, goHome }) {
  const [preview, setPreview] = useStateF(null);
  const camRef = useRefF(null);
  const galRef = useRefF(null);

  const handle = (f) => {
    if (!f) return;
    setPreview(URL.createObjectURL(f));
  };

  const useDemoPhoto = () => setPreview("assets/before-living.jpg");

  return (
    <div className="min-h-screen flex flex-col" data-screen-label="01 Upload">
      <BackBar label="Quitter" onClick={goHome}/>
      <ProgressBar step={1}/>
      <main className="flex-1 px-5 pt-6 pb-32 mx-auto w-full max-w-xl">
        <h1 className="font-display text-3xl md:text-4xl">Commencez par une photo</h1>
        <p className="mt-3 text-muted-foreground">
          Une photo de votre pièce suffit. Cadrage large, lumière naturelle de préférence.
        </p>

        <div className="mt-8">
          {preview ? (
            <div className="rounded-3xl overflow-hidden border border-border aspect-[4/3] relative">
              <img src={preview} alt="Aperçu" className="h-full w-full object-cover"/>
              <button onClick={() => setPreview(null)}
                className="rounded-full bg-cream/95 px-3 py-1.5 text-xs"
                style={{ position: "absolute", top: 12, right: 12 }}>
                Changer
              </button>
            </div>
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-border bg-card aspect-[4/3] grid place-items-center text-center px-6">
              <div>
                <Icon name="image" size={40} className="text-muted-foreground" style={{ margin: "0 auto" }}/>
                <p className="mt-3 text-sm text-muted-foreground">Aucune photo pour l'instant</p>
                <button onClick={useDemoPhoto} className="mt-4 text-xs text-primary" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>
                  Essayer avec la photo d'exemple
                </button>
              </div>
            </div>
          )}

          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handle(e.target.files?.[0])}/>
          <input ref={galRef} type="file" accept="image/*" hidden onChange={(e) => handle(e.target.files?.[0])}/>

          <div className="mt-5 grid gap-3">
            <button onClick={() => camRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground py-3.5 font-medium">
              <Icon name="camera" size={20}/> Prendre une photo
            </button>
            <button onClick={() => galRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-full border border-border bg-card py-3.5 font-medium">
              <Icon name="image" size={20}/> Importer depuis la galerie
            </button>
          </div>
        </div>

        <ul className="mt-10 space-y-3 text-sm">
          <Tip>Cadrez large (un mur entier visible)</Tip>
          <Tip>Éclairage naturel idéalement</Tip>
          <Tip>Sans être dans la pièce vous-même (évitez le selfie de pièce)</Tip>
        </ul>
      </main>

      <footer className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t border-border px-5 py-3.5">
        <div className="mx-auto max-w-xl">
          <button disabled={!preview} onClick={goNext}
            className="w-full rounded-full bg-primary text-primary-foreground py-3.5 font-medium disabled:opacity-40">
            Continuer
          </button>
        </div>
      </footer>
    </div>
  );
}

function Tip({ children }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 grid place-items-center h-5 w-5 rounded-full bg-sage/15 text-sage shrink-0">
        <Icon name="check" size={12}/>
      </span>
      <span className="text-foreground/80">{children}</span>
    </li>
  );
}

/* ───── Screen 2 — Style ───── */
function StyleStep({ goNext, goBack }) {
  const [room, setRoom] = useStateF("salon");
  const [selected, setSelected] = useStateF(null);

  return (
    <div className="min-h-screen flex flex-col" data-screen-label="02 Style">
      <BackBar label="Retour" onClick={goBack}/>
      <ProgressBar step={2}/>
      <main className="flex-1 px-5 pt-6 pb-32 mx-auto w-full max-w-3xl">
        <h1 className="font-display text-3xl md:text-4xl">Quelle ambiance pour cette pièce ?</h1>
        <p className="mt-3 text-muted-foreground">Choisissez l'ambiance qui vous parle. On affinera ensuite.</p>

        <div className="mt-6 inline-flex p-1 rounded-full bg-muted border border-border">
          {["salon", "chambre"].map((r) => (
            <button key={r} onClick={() => setRoom(r)}
              className={`px-5 py-1.5 rounded-full text-sm transition`}
              style={{
                background: room === r ? "var(--card)" : "transparent",
                boxShadow: room === r ? "0 1px 2px rgba(31,27,22,0.06)" : "none",
                color: room === r ? "var(--foreground)" : "var(--muted-foreground)",
                textTransform: "capitalize",
              }}>
              {r}
            </button>
          ))}
        </div>

        <div className="mt-7 grid grid-cols-2 md:grid-cols-3 gap-3">
          {MOCK.ambiances.map((a) => (
            <StyleCard key={a.id} ambiance={a} selected={selected === a.id} onSelect={() => setSelected(a.id)}/>
          ))}
        </div>
      </main>

      <footer className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t border-border px-5 py-3.5">
        <div className="mx-auto max-w-3xl">
          <button disabled={!selected} onClick={goNext}
            className="w-full rounded-full bg-primary text-primary-foreground py-3.5 font-medium disabled:opacity-40">
            Générer le rendu (1 crédit)
          </button>
        </div>
      </footer>
    </div>
  );
}

function StyleCard({ ambiance, selected, onSelect }) {
  return (
    <button type="button" onClick={onSelect}
      className="text-left rounded-2xl border bg-card overflow-hidden transition"
      style={{
        borderColor: selected ? "var(--primary)" : "var(--border)",
        boxShadow: selected ? "0 0 0 2px rgba(192,102,74,0.30)" : "none",
      }}>
      <div className="aspect-square w-full" style={{
        background: `linear-gradient(135deg, ${ambiance.colors[0]}, ${ambiance.colors[1]} 60%, ${ambiance.colors[2]})`,
      }}/>
      <div className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-lg leading-none">{ambiance.name}</h3>
          <div className="flex -space-x-1">
            {ambiance.colors.map((c) => (
              <span key={c} className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: c, border: "1px solid var(--cream)" }}/>
            ))}
          </div>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground leading-snug">{ambiance.desc}</p>
      </div>
    </button>
  );
}

/* ───── Screen 3 — Generating ───── */
function Generating({ goNext }) {
  const STEPS = [
    "On analyse votre pièce…",
    "On identifie le mobilier déjà en place…",
    "On applique l'ambiance choisie…",
    "On finalise le rendu…",
  ];
  const [i, setI] = useStateF(0);

  useEffectF(() => {
    const dur = 1400;
    const t = setInterval(() => setI((v) => v + 1), dur);
    const done = setTimeout(() => goNext(), dur * STEPS.length + 200);
    return () => { clearInterval(t); clearTimeout(done); };
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col" data-screen-label="03 Generating">
      <main className="flex-1 px-5 flex flex-col items-center justify-center mx-auto w-full max-w-xl">
        <div className="w-full aspect-[4/3] rounded-3xl border border-border bg-card overflow-hidden relative">
          <div className="absolute inset-0 shimmer"/>
        </div>
        <div className="mt-10 w-full text-center" style={{ minHeight: 80 }}>
          <p className="font-display text-2xl md:text-3xl transition-opacity">{STEPS[Math.min(i, STEPS.length - 1)]}</p>
          <div className="mt-6 flex justify-center gap-1.5">
            {STEPS.map((_, j) => (
              <span key={j} className="h-1.5 rounded-full transition" style={{ width: 32, background: j <= i ? "var(--primary)" : "var(--border)" }}/>
            ))}
          </div>
        </div>
      </main>
      <footer className="px-5 py-5 text-center text-xs text-muted-foreground">
        1 rendu utilisé · il vous reste 2 éditions gratuites
      </footer>
    </div>
  );
}

/* ───── Screen 4 — Render + marquage ───── */
function RenderStep({ goNext, goBack }) {
  const [tab, setTab] = useStateF("furniture");
  const [actions, setActions] = useStateF(() =>
    Object.fromEntries(MOCK.detectedFurniture.map((f) => [f.id, f.defaultAction]))
  );
  const totalCart = MOCK.cart.reduce((s, o) => s + o.items.reduce((a, i) => a + i.price, 0), 0);

  return (
    <div className="min-h-screen flex flex-col" data-screen-label="04 Render">
      <div className="px-5 h-12 flex items-center justify-between">
        <button onClick={goBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <Icon name="chevron-left" size={16}/> Retour
        </button>
        <div className="flex items-center gap-1">
          <IconBtn label="Itérer"><Icon name="refresh" size={16}/></IconBtn>
          <IconBtn label="Partager"><Icon name="share" size={16}/></IconBtn>
          <IconBtn label="Sauvegarder"><Icon name="bookmark" size={16}/></IconBtn>
        </div>
      </div>

      <div className="px-5 mt-2">
        <div className="mx-auto max-w-3xl">
          <BeforeAfterSlider before={MOCK.heroPair.before} after={MOCK.heroPair.after}/>
        </div>
      </div>

      <section className="mt-6 px-5 pb-36 mx-auto w-full max-w-3xl">
        <div className="rounded-3xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-3 border-b border-border text-sm">
            {[
              ["furniture", "Vos meubles"],
              ["cart", "Ce qu'on commande"],
              ["impact", "Impact"],
            ].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`py-3 font-medium transition ${tab === id ? "text-foreground tab-active -mb-px" : "text-muted-foreground"}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {tab === "furniture" && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Par défaut, on garde tout. Marquez ce que vous voulez changer.</p>
                {MOCK.detectedFurniture.map((f) => (
                  <FurnitureMarker key={f.id} item={f} value={actions[f.id]} onChange={(a) => setActions((s) => ({ ...s, [f.id]: a }))}/>
                ))}
              </div>
            )}

            {tab === "cart" && (
              <div>
                <Group color="bg-sage"  label="À conserver"  items={["Votre bibliothèque (repeinte)", "Votre tapis", "Votre lampadaire"]}/>
                <Group color="bg-ocre"  label="À customiser" items={["Canapé → housse Bemz lin oat — 340 €"]}/>
                <Group color="bg-terre" label="À acheter"    items={[
                  "Table rotin → Selency seconde main — 65 €",
                  "Lampe céramique → La Redoute Intérieurs — 119 €",
                  "Pot peinture vert d'eau → Leroy Merlin — 28 €",
                ]}/>
                <div className="mt-5 pt-4 border-t border-border flex justify-between items-baseline">
                  <span className="text-sm text-muted-foreground">Total estimé</span>
                  <span className="font-display text-2xl">{totalCart} €</span>
                </div>
              </div>
            )}

            {tab === "impact" && (
              <div className="py-2">
                <ScoreBadge kept={MOCK.projectStats.kept} secondHand={MOCK.projectStats.secondHand}
                  newDurable={MOCK.projectStats.newDurable} co2={MOCK.projectStats.co2Saved}/>
                <p className="mt-5 text-xs text-muted-foreground">
                  Base ADEME, calcul indicatif. {MOCK.projectStats.co2Saved} kg CO₂ évités par rapport à un projet tout-neuf équivalent.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t border-border px-5 py-3.5">
        <div className="mx-auto max-w-3xl">
          <button onClick={goNext}
            className="w-full rounded-full bg-primary text-primary-foreground py-3.5 font-medium">
            Préparer mes commandes
          </button>
        </div>
      </footer>
    </div>
  );
}

function IconBtn({ label, children }) {
  return (
    <button aria-label={label} className="grid place-items-center h-9 w-9 rounded-full hover:bg-muted text-muted-foreground">
      {children}
    </button>
  );
}

function Group({ color, label, items }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-2">
        <span className={`h-2 w-2 rounded-full ${color}`}/> {label}
      </p>
      <ul className="space-y-1.5 text-sm">
        {items.map((i) => <li key={i} className="text-foreground/85">• {i}</li>)}
      </ul>
    </div>
  );
}

function FurnitureMarker({ item, value, onChange }) {
  const options = [
    { id: "keep",    label: "Garder",     dot: "bg-sage"  },
    { id: "custom",  label: "Customiser", dot: "bg-ocre"  },
    { id: "replace", label: "Remplacer",  dot: "bg-terre" },
  ];
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <div className="grid place-items-center h-11 w-11 rounded-xl bg-muted shrink-0" style={{ fontSize: 20 }}>
        {item.thumb}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
        <div className="mt-1.5 flex gap-1">
          {options.map((o) => {
            const sel = value === o.id;
            return (
              <button key={o.id} onClick={() => onChange(o.id)}
                className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition"
                style={{
                  borderColor: sel ? "var(--foreground)" : "var(--border)",
                  background:  sel ? "var(--foreground)" : "transparent",
                  color:       sel ? "var(--cream)" : "var(--muted-foreground)",
                }}>
                <span className={`h-1.5 w-1.5 rounded-full ${o.dot}`}/> {o.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ScoreBadge({ kept, secondHand, newDurable, co2 }) {
  const total = kept + secondHand + newDurable;
  const k = (kept / total) * 360;
  const s = (secondHand / total) * 360;
  const bg = `conic-gradient(var(--sage) 0 ${k}deg, var(--ocre) ${k}deg ${k + s}deg, var(--terre) ${k + s}deg 360deg)`;
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-24 w-24 rounded-full shrink-0" style={{ background: bg }}>
        <div className="rounded-full bg-card grid place-items-center text-center"
          style={{ position: "absolute", inset: 8 }}>
          <div>
            <div className="font-display text-lg leading-none">{kept}<span className="text-xs">/{secondHand}/{newDurable}</span></div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">Score Foyer</div>
          </div>
        </div>
      </div>
      <div className="space-y-1.5 text-sm">
        <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-sage"/> {kept}% conservé</p>
        <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-ocre"/> {secondHand}% occasion</p>
        <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-terre"/> {newDurable}% neuf durable</p>
        <p className="pt-1 font-display text-lg">{co2} kg CO₂ <span className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-sans)" }}>évités</span></p>
      </div>
    </div>
  );
}

/* ───── Screen 5 — Checkout / recap ───── */
function CheckoutStep({ goBack, goHome }) {
  const total = MOCK.cart.reduce((s, o) => s + o.items.reduce((a, i) => a + i.price, 0), 0);
  return (
    <div className="min-h-screen flex flex-col" data-screen-label="05 Checkout">
      <BackBar label="Retour" onClick={goBack}/>
      <ProgressBar step={5}/>
      <main className="flex-1 px-5 pt-6 pb-40 mx-auto w-full max-w-2xl">
        <h1 className="font-display text-3xl md:text-4xl">Voici votre projet.</h1>
        <p className="mt-3 text-muted-foreground">
          On a préparé les paniers sur les sites partenaires. Vous vérifiez, vous validez, on passe les commandes pour vous.
        </p>

        <div className="mt-8 space-y-3">
          {MOCK.cart.map((o) => <PartnerCard key={o.partner} order={o}/>)}
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          Les prix indiqués sont ceux constatés au moment de la préparation du panier. Vous payez directement chez chaque partenaire.
        </p>
      </main>

      <footer className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t border-border px-5 pt-3 pb-4">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-baseline justify-between mb-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total estimé</p>
              <p className="font-display text-2xl">{total} €</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Score Foyer</p>
              <p className="text-sm">
                <span className="text-sage">{MOCK.projectStats.kept}</span>/<span className="text-ocre">{MOCK.projectStats.secondHand}</span>/<span className="text-terre">{MOCK.projectStats.newDurable}</span>
                <span className="text-muted-foreground"> · {MOCK.projectStats.co2Saved} kg CO₂ évités</span>
              </p>
            </div>
          </div>
          <button onClick={goHome} className="w-full rounded-full bg-primary text-primary-foreground py-3.5 font-medium">
            Valider et lancer les commandes
          </button>
          <p className="mt-2 text-center" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            Vous payez directement chez chaque partenaire.
          </p>
        </div>
      </footer>
    </div>
  );
}

function PartnerCard({ order }) {
  const total = order.items.reduce((s, i) => s + i.price, 0);
  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <header className="flex items-baseline justify-between gap-2 mb-3">
        <div>
          <h3 className="font-display text-lg leading-tight">{order.partner}</h3>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{order.partnerTag}</p>
        </div>
        <p className="font-display text-lg">{total} €</p>
      </header>
      <ul className="space-y-1.5 text-sm">
        {order.items.map((it) => (
          <li key={it.label} className="flex justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate">{it.label}</p>
              {it.meta && <p className="text-xs text-muted-foreground">{it.meta}</p>}
            </div>
            <span className="text-muted-foreground">{it.price} €</span>
          </li>
        ))}
      </ul>
      {order.delivery && <p className="mt-3 text-xs text-muted-foreground">{order.delivery}</p>}
      <button className="mt-4 w-full rounded-full border border-foreground/15 bg-background py-2.5 text-sm font-medium hover:bg-foreground hover:text-cream transition">
        {order.cta}
      </button>
    </article>
  );
}

Object.assign(window, {
  UploadStep, StyleStep, Generating, RenderStep, CheckoutStep,
});
