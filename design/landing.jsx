// Foyer — Landing page (1:1 with Lovable source)
const { useState: useStateLP } = React;

function SiteHeader({ onCTA, onNav }) {
  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur" style={{ borderBottom: "1px solid rgba(229,221,208,0.7)" }}>
      <div className="mx-auto max-w-6xl px-5 h-14 flex items-center justify-between">
        <a href="#top" onClick={(e) => { e.preventDefault(); onNav("top"); }} className="flex items-center gap-2">
          <span className="grid place-items-center h-7 w-7 rounded-full bg-foreground text-cream font-display text-sm">F</span>
          <span className="font-display text-xl tracking-tight">Foyer</span>
        </a>
        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          <a href="#process" className="hover:text-foreground" onClick={(e) => { e.preventDefault(); onNav("process"); }}>Comment ça marche</a>
          <a href="#eco" className="hover:text-foreground" onClick={(e) => { e.preventDefault(); onNav("eco"); }}>Notre approche</a>
          <a href="#partners" className="hover:text-foreground" onClick={(e) => { e.preventDefault(); onNav("partners"); }}>Partenaires</a>
          <a href="#faq" className="hover:text-foreground" onClick={(e) => { e.preventDefault(); onNav("faq"); }}>FAQ</a>
        </nav>
        <button onClick={onCTA} className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90">
          Commencer
        </button>
      </div>
    </header>
  );
}

/* ─── Section 1 — Hero ─── */
function Hero({ onCTA, onNav }) {
  return (
    <section id="top" className="px-5 pt-10 pb-14 md:pt-20 md:pb-24">
      <div className="mx-auto max-w-6xl grid md:grid-cols-2 gap-10 md:gap-14 items-center">
        <div className="md:order-1" style={{ order: 2 }}>
          <p className="text-xs uppercase text-muted-foreground mb-5 tracking-[0.18em]">Conception, sourcing &amp; commandes</p>
          <h1 className="font-display text-[40px] sm:text-5xl md:text-[64px]" style={{ lineHeight: 1.02 }}>
            Votre pièce,<br/>transformée.<br/>
            <span className="italic text-primary">Réellement.</span>
          </h1>
          <p className="mt-6 text-base md:text-lg text-muted-foreground leading-relaxed" style={{ maxWidth: "28rem" }}>
            De la photo aux commandes prêtes, on pense le projet avec vous. On garde ce qui peut l'être, on chine le reste, on sélectionne le neuf qui dure.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button onClick={onCTA}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3.5 font-medium hover:opacity-90">
              Lancer ma transformation
            </button>
            <a href="#process" onClick={(e) => { e.preventDefault(); onNav("process"); }}
               className="inline-flex items-center justify-center gap-1 px-2 py-3.5 text-sm text-foreground/80"
               style={{ textDecoration: "underline", textUnderlineOffset: 4 }}>
              Voir comment ça marche
            </a>
          </div>
          <ul className="mt-7 flex flex-wrap text-sm text-muted-foreground" style={{ rowGap: 8, columnGap: 24 }}>
            <li className="flex items-center gap-1.5"><Icon name="check" size={16} className="text-sage"/> 1 premier rendu offert</li>
            <li className="flex items-center gap-1.5"><Icon name="check" size={16} className="text-sage"/> Sans abonnement</li>
            <li className="flex items-center gap-1.5"><Icon name="check" size={16} className="text-sage"/> Conçu en France</li>
          </ul>
        </div>
        <div className="md:order-2" style={{ order: 1 }}>
          <BeforeAfterSlider before={MOCK.heroPair.before} after={MOCK.heroPair.after}/>
          <p className="mt-3 text-xs text-muted-foreground text-center">
            Salon parisien — canapé recouvert, bibliothèque repeinte, accessoires chinés.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── Section 2 — Process ─── */
function Process() {
  const steps = [
    { n: "01", icon: "camera",   title: "Vous photographiez votre pièce",  desc: "Une photo suffit pour commencer. Pas besoin de mesurer." },
    { n: "02", icon: "sparkles", title: "On imagine le projet avec vous",  desc: "Choisissez un style, on génère plusieurs propositions, vous ajustez en temps réel." },
    { n: "03", icon: "ruler",    title: "On vérifie que tout rentre",      desc: "Une mesure rapide, et on adapte le projet à vos vraies dimensions." },
    { n: "04", icon: "package",  title: "On passe les commandes pour vous", desc: "Vous validez, on prépare les paniers sur les sites partenaires. Vous payez, vous recevez." },
  ];
  return (
    <section id="process" className="px-5 py-16 md:py-24 bg-card/40 border-y border-border/60">
      <div className="mx-auto max-w-6xl">
        <header style={{ maxWidth: "42rem" }}>
          <h2 className="font-display text-3xl md:text-5xl">On vous accompagne de la photo au montage.</h2>
          <p className="mt-4 text-muted-foreground">4 étapes simples. Pas de logiciel à maîtriser.</p>
        </header>
        <ol className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s) => (
            <li key={s.n} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs tracking-widest text-muted-foreground">{s.n}</span>
                <Icon name={s.icon} size={20} className="text-primary"/>
              </div>
              <h3 className="font-display text-xl leading-tight">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ─── Section 3 — Différence ─── */
function Difference() {
  const items = [
    { icon: "ruler",   title: "Des rendus réels",          desc: "Le rendu tient compte des dimensions de votre pièce. Chaque élément est sourcé et achetable." },
    { icon: "compass", title: "Une conception guidée",     desc: "Choix du style, ajustements, validation — vous n'êtes pas seul devant une page blanche." },
    { icon: "package", title: "Des commandes groupées",    desc: "On prépare les paniers sur les sites partenaires. Vous validez, vous payez, vous recevez." },
    { icon: "leaf",    title: "Une logique éco par défaut", desc: "On garde votre mobilier d'abord, on chine ensuite, on achète neuf en dernier." },
  ];
  return (
    <section className="px-5 py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        <header style={{ maxWidth: "42rem" }}>
          <h2 className="font-display text-3xl md:text-5xl">On ne fait pas que générer des rendus.</h2>
          <p className="mt-4 text-muted-foreground">Tout ce que vous voyez existe. Et on s'occupe du reste.</p>
        </header>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((it) => (
            <div key={it.title} className="rounded-2xl border border-border bg-card p-6">
              <div className="grid place-items-center h-11 w-11 rounded-xl bg-background border border-border mb-4">
                <Icon name={it.icon} size={20} className="text-foreground"/>
              </div>
              <h3 className="font-display text-xl">{it.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{it.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Section 4 — Before/After detail ─── */
function BeforeAfterDetail() {
  const items = [
    { dot: "ocre",  label: "Canapé — recouvert en lin oat, base conservée",   meta: "Housse Bemz",                price: "340 €" },
    { dot: "terre", label: "Table d'appoint rotin — seconde main",            meta: "Selency",                    price: "65 €"  },
    { dot: "sage",  label: "Bibliothèque — conservée, repeinte vert d'eau",   meta: "Existant + pot peinture",    price: "28 €"  },
    { dot: "terre", label: "Lampe céramique — neuf, fabrication française",   meta: "La Redoute Intérieurs",      price: "119 €" },
  ];
  const dotColor = { sage: "bg-sage", ocre: "bg-ocre", terre: "bg-terre" };
  return (
    <section className="px-5 py-16 md:py-24 bg-card/40 border-y border-border/60">
      <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-10 items-center">
        <BeforeAfterSlider before={MOCK.heroPair.before} after={MOCK.heroPair.after}/>
        <div>
          <p className="text-xs uppercase text-muted-foreground tracking-[0.18em]">Ce que vous voyez dans le rendu</p>
          <h2 className="mt-2 font-display text-3xl md:text-4xl">Sourcé, pièce par pièce.</h2>
          <ul className="mt-7 space-y-5">
            {items.map((it) => (
              <li key={it.label} className="flex gap-3">
                <span className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${dotColor[it.dot]}`}/>
                <div className="flex-1">
                  <p className="text-[15px] leading-snug">{it.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {it.meta} <span className="text-foreground">— {it.price}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-7 text-sm text-muted-foreground border-t border-border pt-5">
            Chaque élément est sourcé. Vous validez, on prépare les commandes.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── Section 5 — Eco manifesto ─── */
function EcoManifesto() {
  const steps = [
    { n: "01", title: "D'abord, on réutilise",          desc: "Homestaging et customisation de vos meubles. Un canapé peut être recouvert. Une commode peut être repeinte." },
    { n: "02", title: "Ensuite, on cherche d'occasion", desc: "Sourcing seconde main intégré, depuis les plateformes que vous utilisez déjà." },
    { n: "03", title: "En dernier, du neuf qui dure",   desc: "Conseil sur les matériaux et marques. On vous oriente vers ce qui tient dix ans, pas trois." },
  ];
  return (
    <section id="eco" className="px-5 py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        <header style={{ maxWidth: "48rem" }}>
          <h2 className="font-display text-3xl md:text-5xl">Avant de proposer du neuf, on regarde ce que vous avez déjà.</h2>
          <p className="mt-5 text-muted-foreground text-lg leading-relaxed">
            Un canapé peut être recouvert. Une commode peut être repeinte. Une table peut changer de pièce. Quand il faut acheter, on commence par la seconde main. Et si on doit prendre du neuf, on vous oriente vers ce qui dure.
          </p>
        </header>
        <ol className="mt-10 grid md:grid-cols-3 gap-4">
          {steps.map((s) => (
            <li key={s.n} className="rounded-2xl border border-border bg-card p-6">
              <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-sage"/> Étape {s.n}
              </p>
              <h3 className="mt-4 font-display text-2xl">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-xs text-muted-foreground" style={{ maxWidth: "48rem" }}>
          Score Foyer — chaque projet est mesuré selon sa part de mobilier conservé, occasion et neuf, et son équivalent CO₂ évité. Méthodologie sourcée ADEME.
        </p>
      </div>
    </section>
  );
}

/* ─── Section 6 — Transparence IA ─── */
function Transparency() {
  return (
    <section className="px-5 py-16 md:py-20 bg-foreground text-cream">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-display text-3xl md:text-4xl">On utilise l'IA. Mais ce n'est qu'un outil.</h2>
        <div className="mt-6 space-y-4 text-cream/80 leading-relaxed">
          <p>
            L'intelligence artificielle nous sert à générer des rendus de votre pièce transformée, et à retrouver des meubles d'occasion qui correspondent visuellement à ce qu'on vous propose. Le reste — la sélection des partenaires, le choix des matériaux, la préparation des paniers — est pensé par notre équipe.
          </p>
          <p className="italic font-display text-lg" style={{ color: "var(--cream)" }}>
            Notre angle : l'IA pour aller vite, l'humain pour aller juste.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── Section 7 — Partners ─── */
function Partners() {
  const cards = [
    { tag: "Enseignes fournitures",     title: "Captez le flux IA-design en France.",            desc: "Co-investissement, exclu catégorie, données agrégées.",    ex: "Leroy Merlin · Castorama · ManoMano" },
    { tag: "Marketplaces seconde main", title: "Donnez plus de visibilité à vos vendeurs.",       desc: "Acheteurs en projet déco qualifié, prêts à valider.",     ex: "Leboncoin · Vinted · Selency" },
    { tag: "Mobilier durable",          title: "Touchez ceux qui achètent moins, mais qui achètent mieux.", desc: "Une audience alignée sur des matériaux qui durent.",     ex: "Maisons du Monde · La Redoute Intérieurs · Tikamoon" },
  ];
  return (
    <section id="partners" className="px-5 py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        <header style={{ maxWidth: "48rem" }}>
          <p className="text-xs uppercase text-primary mb-3 tracking-[0.18em]">Partenaires</p>
          <h2 className="font-display text-3xl md:text-5xl">Et si Foyer devenait votre canal d'acquisition ?</h2>
          <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
            Foyer est un nouveau front-end IA pour les enseignes déco, fournitures et seconde main qui veulent capter le flux IA-design avant qu'il ne devienne le canal dominant.
          </p>
        </header>
        <div className="mt-10 grid md:grid-cols-3 gap-4">
          {cards.map((c) => (
            <article key={c.tag} className="rounded-2xl border border-border bg-card p-6 flex flex-col">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.tag}</p>
              <h3 className="mt-3 font-display text-2xl leading-tight">{c.title}</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed flex-1">{c.desc}</p>
              <p className="mt-5 pt-4 border-t border-border text-xs text-muted-foreground">{c.ex}</p>
            </article>
          ))}
        </div>
        <div className="mt-10">
          <a href="mailto:contact@foyer.app"
             className="inline-flex items-center gap-2 rounded-full bg-foreground text-cream px-6 py-3.5 font-medium hover:opacity-90">
            Discuter d'un partenariat <Icon name="arrow-right" size={16}/>
          </a>
        </div>
      </div>
    </section>
  );
}

/* ─── Section 8 — FAQ ─── */
function Faq() {
  const items = [
    { q: "Combien ça coûte ?",                                a: "Le premier rendu est offert. Ensuite, des crédits à partir de 4,99 € (3 crédits). Pas d'abonnement." },
    { q: "Est-ce que vous remplacez tout mon mobilier ?",     a: "Non, on vous propose systématiquement de garder ce qui peut l'être. C'est notre angle de départ." },
    { q: "Comment trouvez-vous les meubles d'occasion ?",     a: "On scanne Leboncoin et Vinted Maison, et on vous propose ce qui correspond visuellement au rendu." },
    { q: "Et si je ne suis pas content du rendu ?",           a: "Vous pouvez itérer (changer de style, ajuster les choix). Si vraiment ça ne va pas, on rembourse le crédit." },
    { q: "Comment fonctionne le passage de commande ?",       a: "On prépare les paniers sur les sites partenaires. Vous vérifiez, vous payez directement chez chaque partenaire. On suit la commande." },
    { q: "C'est dispo où ?",                                  a: "France pour le moment. Europe à venir." },
  ];
  const [open, setOpen] = useStateLP(0);
  return (
    <section id="faq" className="px-5 py-16 md:py-24 bg-card/40 border-t border-border/60">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-display text-3xl md:text-5xl">Questions fréquentes</h2>
        <ul className="mt-8 divide-y border-y border-border">
          {items.map((it, i) => (
            <li key={it.q}>
              <button onClick={() => setOpen(open === i ? -1 : i)}
                className="w-full flex items-center justify-between gap-4 py-5 text-left">
                <span className="font-display text-lg" style={{ fontSize: "clamp(18px, 2.5vw, 20px)" }}>{it.q}</span>
                <Icon name="chevron-down" size={20}
                  className={`text-muted-foreground transition-transform ${open === i ? "rotate-180" : ""}`}/>
              </button>
              {open === i && (
                <p className="pb-5 -mt-1 text-muted-foreground leading-relaxed pr-8">{it.a}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ─── Footer ─── */
function Footer() {
  return (
    <footer className="px-5 py-14 border-t border-border">
      <div className="mx-auto max-w-6xl grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid place-items-center h-8 w-8 rounded-full bg-foreground text-cream font-display">F</span>
            <span className="font-display text-2xl">Foyer</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground max-w-xs">Votre pièce, transformée. Réellement.</p>
          <p className="mt-6 text-xs text-muted-foreground">Made in France 🇫🇷</p>
        </div>
        <FooterCol title="Produit" links={["Comment ça marche", "Tarifs", "FAQ"]}/>
        <FooterCol title="Éco" links={["Méthodologie", "Partenaires", "Sources ADEME"]}/>
        <FooterCol title="Légal" links={["CGU", "Confidentialité", "Mentions légales"]}/>
      </div>
      <div className="mx-auto max-w-6xl mt-10 pt-6 border-t border-border flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Foyer</p>
        <div className="flex gap-5">
          <a href="#">Instagram</a><a href="#">TikTok</a><a href="#">LinkedIn</a>
        </div>
      </div>
    </footer>
  );
}
function FooterCol({ title, links }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "rgba(31,27,22,0.7)" }}>{title}</p>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {links.map((l) => <li key={l}><a href="#" className="hover:text-foreground">{l}</a></li>)}
      </ul>
    </div>
  );
}

function LandingPage({ onCTA }) {
  const onNav = (id) => {
    if (id === "top") window.scrollTo({ top: 0, behavior: "smooth" });
    else {
      const el = document.getElementById(id);
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 60;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    }
  };
  return (
    <div className="min-h-screen" data-screen-label="Landing">
      <SiteHeader onCTA={onCTA} onNav={onNav}/>
      <Hero onCTA={onCTA} onNav={onNav}/>
      <Process/>
      <Difference/>
      <BeforeAfterDetail/>
      <EcoManifesto/>
      <Transparency/>
      <Partners/>
      <Faq/>
      <Footer/>
    </div>
  );
}

window.LandingPage = LandingPage;
