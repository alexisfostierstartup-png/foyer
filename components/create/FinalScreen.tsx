"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Pencil, Link2, Star, RefreshCw, Loader2, Eye, MapPin, ShoppingBag, Download } from "lucide-react";
import { toast } from "sonner";
import { ProgressBar } from "@/components/create/ProgressBar";
import { BeforeAfterSlider } from "@/components/create/BeforeAfterSlider";
import { RenderHotspots } from "@/components/create/RenderHotspots";
import { ShoppingCard, useDebug } from "@/components/create/ShoppingCard";
import { ExpertOverridesProvider, useExpertOverrides } from "@/components/create/expertOverrides";

// Libellé lisible d'une référence custom (clé = catégorie ou elementId type "sofa_1").
const REF_LABELS: Record<string, string> = {
  sofa: "Canapé", armchair: "Fauteuil", coffee_table: "Table basse", dining_table: "Table à manger",
  chair: "Chaise", rug: "Tapis", tv_stand: "Meuble TV", sideboard: "Buffet", bookshelf: "Bibliothèque",
  bed: "Lit", nightstand: "Table de nuit", dresser: "Commode", side_table: "Table d'appoint",
};
function refLabel(key: string): string {
  const cat = key.replace(/_\d+$/, ""); // "sofa_1" → "sofa"
  return REF_LABELS[cat] ?? cat.replace(/_/g, " ");
}
import { PaywallModal } from "@/components/paywalls/PaywallModal";
import { cn } from "@/lib/utils";
import { PAYWALL_DISABLED } from "@/lib/constants";
import { useUser } from "@/lib/auth/useUser";
import type { ShoppingItem, ScoreFoyer, CustomProduct } from "@/lib/types";
import type { PaywallTrigger } from "@/components/paywalls/PaywallModal";

const STEPS = ["Photo", "Style", "Mobilier", "Rendu", "Projet"];
const TABS = ["Liste shopping", "Score Foyer"] as const;
type Tab = (typeof TABS)[number];

// ── Alteration shape ──────────────────────────────────────────────────────────
type Alteration = {
  element: string;
  action: string;
  category: string;
  detail?: string;
  shoppingImpact: "none" | "to_buy" | "to_buy_secondhand" | "diy_material";
};

// ── RSE eco-advice ────────────────────────────────────────────────────────────
const RSE_ADVICE: Record<string, string> = {
  floor_material:
    "Alternative durable : béton ciré sur chape existante = moins de déchets de chantier.",
  paint:
    "Optez pour une peinture à l'eau labellisée NF Environnement — VOC réduits, moins de pollution intérieure.",
  mouldings:
    "Les moulures en MDF recyclé sont plus légères et génèrent moins de déchets que le bois massif.",
};

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-foyer-muted">
      {children}
    </p>
  );
}

// ── Family grouping ───────────────────────────────────────────────────────────
type Family = "Mobilier" | "Décoration" | "Accessoires" | "Fournitures";

const FAMILIES: Family[] = ["Mobilier", "Décoration", "Accessoires", "Fournitures"];

const CATEGORY_FAMILY: Record<string, Family> = {
  // Mobilier
  sofa: "Mobilier", armchair: "Mobilier", chair: "Mobilier", dining_chair: "Mobilier",
  bench: "Mobilier", stool: "Mobilier", pouf: "Mobilier",
  coffee_table: "Mobilier", side_table: "Mobilier", dining_table: "Mobilier",
  console_table: "Mobilier", bar_table: "Mobilier", desk: "Mobilier",
  bookshelf: "Mobilier", shelf: "Mobilier", tv_stand: "Mobilier", dresser: "Mobilier",
  sideboard: "Mobilier", wardrobe: "Mobilier", cabinet: "Mobilier", nightstand: "Mobilier",
  bed: "Mobilier", headboard: "Mobilier", mattress: "Mobilier", television: "Mobilier",
  // Décoration
  rug: "Décoration", curtains: "Décoration",
  lamp: "Décoration", ceiling_light: "Décoration", wall_sconce: "Décoration",
  table_lamp: "Décoration", floor_lamp: "Décoration",
  mirror: "Décoration", frame: "Décoration", plant: "Décoration",
  // Accessoires
  cushion: "Accessoires", decor_object: "Accessoires", other: "Accessoires",
  // Fournitures (surfaces & matériaux)
  paint: "Fournitures", mouldings: "Fournitures", floor_material: "Fournitures",
  floor: "Fournitures", wall: "Fournitures", ceiling: "Fournitures",
};

function toFamily(category: string): Family {
  return CATEGORY_FAMILY[category] ?? "Accessoires";
}


// ── Tab: Score Foyer ──────────────────────────────────────────────────────────
function ScoreFoyerTab({
  score,
  shoppingList,
}: {
  score?: ScoreFoyer;
  shoppingList: ShoppingItem[];
}) {
  const kept = score?.kept ?? 0;
  const secondhand = score?.secondhand ?? 0;
  const ecoNew = score?.ecoNew ?? 0;
  const keptLabels = score?.keptLabels ?? [];
  // `|| 1` évitait une division par zéro, mais faisait afficher « 100 % conservé » sur une
  // pièce VIDE : 0/1 → 0 %, sauf que le premier segment ramassait tout le cercle. On ne
  // dessine plus de jauge quand il n'y a rien à répartir (QA Alexis 2026-07-13).
  const total = kept + secondhand + ecoNew;
  // Plus de repli sur l'ancienne formule (compte d'objets) : elle était fausse — un projet
  // tout-neuf y "économisait" du CO₂. Sans bilan calculé, on n'affiche rien plutôt qu'un chiffre inventé.
  const co2 = score?.co2SavedKg ?? 0;
  // Le budget vient des produits RÉELLEMENT matchés : priceMin/priceMax sont ceux du
  // catalogue mock, vide — ils valent 0 partout.
  const budgetListe = shoppingList.reduce((s, i) => {
    const p = i.matches?.[0]?.price;
    return s + (typeof p === "number" ? p : (i.priceMin + i.priceMax) / 2) * (i.quantity ?? 1);
  }, 0);
  // `?? ` ne suffit pas : les projets DÉJÀ calculés portent un totalEstimated à 0 (le bug),
  // et 0 n'est pas nullish — ils resteraient à « ~0 € » jusqu'à un recalcul. Un total nul
  // au-dessus d'une liste chiffrée est forcément faux : on recalcule sur la liste affichée.
  const budget = score?.totalEstimated && score.totalEstimated > 0 ? score.totalEstimated : budgetListe;

  const segments = total === 0 ? [] : [
    { value: Math.round((kept / total) * 100), label: "conservé", color: "#6B8E6F", dot: "bg-foyer-sage" },
    { value: Math.round((secondhand / total) * 100), label: "seconde main", color: "#A5B8A0", dot: "bg-foyer-water" },
    { value: Math.round((ecoNew / total) * 100), label: "neuf durable", color: "#C89B6A", dot: "bg-foyer-ochre" },
  ];

  let acc = 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-foyer-border bg-white p-5">
        <div className="flex items-center gap-6">
          <div className="size-32 shrink-0">
            <svg viewBox="0 0 42 42" className="size-full -rotate-90">
              <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#E5DDD0" strokeWidth="4" />
              {segments.map((s) => {
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
            </svg>
          </div>
          <div className="flex-1">
            <ul className="flex flex-col gap-1.5">
              {segments.map((s) => (
                <li key={s.label} className="flex items-center gap-2">
                  <span className={cn("size-2.5 shrink-0 rounded-full", s.dot)} aria-hidden />
                  <span className="text-[14px] text-foyer-ink">{s.value}% {s.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-4 border-t border-foyer-border pt-4">
          <p className="font-serif text-3xl text-foyer-ink">
            ~{co2}&nbsp;kg CO<sub>2</sub>
          </p>
          <p className="mt-0.5 text-[13px] text-foyer-muted">
            évités par rapport à un projet tout-neuf équivalent
          </p>
          {/* Ce qu'on ÉMET quand même : annoncer les kilos évités sans jamais dire ce que
              le projet coûte, ce serait du greenwashing. */}
          {typeof score?.co2EmittedKg === "number" && score.co2EmittedKg > 0 && (
            <p className="mt-2 text-[12px] text-foyer-muted">
              Le projet en émet ~{score.co2EmittedKg}&nbsp;kg — un projet tout-neuf en
              aurait émis ~{co2 + score.co2EmittedKg}&nbsp;kg.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-foyer-border bg-white px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-foyer-muted">
          Budget estimé
        </p>
        <p className="mt-1 font-serif text-2xl text-foyer-ink">
          ~{Math.round(budget)}&nbsp;€
        </p>
        <p className="mt-0.5 text-[12px] text-foyer-muted">
          Catalogue indicatif — les prix seconde main varient.
        </p>
      </div>

      <div className="rounded-2xl border border-foyer-border bg-white px-5 py-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-foyer-muted">
          Détail impact
        </p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="font-serif text-2xl text-foyer-ink">{kept}</p>
            <p className="text-[12px] text-foyer-muted">meuble{kept > 1 ? "s" : ""} conservé{kept > 1 ? "s" : ""}</p>
          </div>
          <div>
            <p className="font-serif text-2xl text-foyer-ink">{secondhand}</p>
            <p className="text-[12px] text-foyer-muted">seconde main</p>
          </div>
          <div>
            <p className="font-serif text-2xl text-foyer-ink">{ecoNew}</p>
            <p className="text-[12px] text-foyer-muted">neuf éco</p>
          </div>
        </div>

        {/* « 4 conservés » sans dire QUOI n'informe personne. On les nomme. */}
        {keptLabels.length > 0 && (
          <ul className="mt-4 border-t border-foyer-border pt-3 text-[13px] text-foyer-muted">
            {keptLabels.map((l) => (
              <li key={l} className="flex items-start gap-2 py-0.5">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foyer-sage" aria-hidden />
                <span className="text-foyer-ink">{l}</span>
              </li>
            ))}
          </ul>
        )}
        {kept === 0 && (
          <p className="mt-4 border-t border-foyer-border pt-3 text-[13px] leading-relaxed text-foyer-muted">
            Aucun meuble à conserver : votre pièce était vide. Les murs, le sol et les
            équipements fixes ne comptent pas — ils restent en place quoi qu’il arrive.
          </p>
        )}
      </div>

      <p className="text-center text-[11px] leading-relaxed text-foyer-muted">
        Base ADEME : 30 kg CO₂ / meuble conservé · 20 kg / occasion · 5 kg / neuf éco.
        Calcul indicatif.
      </p>
    </div>
  );
}

// ── Shopping item row with "Choisir un produit précis" button ──────────────────
function ShoppingItemRow({
  item,
  onProductUrl,
}: {
  item: ShoppingItem;
  onProductUrl: () => void;
}) {
  const advice = RSE_ADVICE[item.category];
  return (
    <li>
      <div className="relative">
        <ShoppingCard item={item} />
        <button
          type="button"
          onClick={onProductUrl}
          className="mt-1 flex w-full items-center gap-1.5 rounded-xl bg-white/80 px-3 py-1.5 text-[12px] text-foyer-muted transition-colors hover:text-foyer-sage"
        >
          <Link2 className="size-3.5 shrink-0" />
          Choisir un produit précis
        </button>
      </div>
      {advice && (
        <p className="mt-1.5 rounded-xl bg-foyer-sage/10 px-3 py-2 text-[12px] leading-relaxed text-foyer-sage">
          {advice}
        </p>
      )}
    </li>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
type Props = {
  projectId: string;
  beforeUrl: string;
  afterUrl: string;
  shoppingList: ShoppingItem[];
  scoreFoyer?: ScoreFoyer;
  visionOutput?: unknown;
  alterations?: unknown;
  liveEditsUsed?: number;
  // Liste en cours de calcul en fond : la page s'affiche immédiatement et
  // polle /shopping-status jusqu'à l'arrivée de la liste.
  pendingList?: boolean;
  // Projet en mode expert → active la « liste de courses alternative » : choix de
  // produits alternatifs (accumulés) + bouton « Nouveau rendu avec les (x) éléments ».
  expertMode?: boolean;
  // Projet flux DIY beta : badge « Customisation » sur les fournitures DIY —
  // par construction (reconciliation analyzeRender), une entrée DIY qui atteint
  // la liste est une customisation CONFIRMÉE sur le rendu.
  diyBeta?: boolean;
  productOverrides?: Record<string, number> | null;
  // elementId → ID du produit choisi. FAIT FOI sur productOverrides (un indice, qui
  // dérive dès que `matches` est réordonné).
  productPicks?: Record<string, string> | null;
  customProducts?: Record<string, CustomProduct> | null;
  // Expert : URL du rendu IA d'origine (fake) → bouton de comparaison sous le slider
  // (remplace l'ancien écran /expert supprimé du parcours).
  fakeRenderUrl?: string | null;
  // Hotspots : bbox par element_id sur le rendu affiché (null si analyse absente
  // ou périmée) → dots + popover matches + tap-to-target.
  bboxById?: Record<string, { x: number; y: number; w: number; h: number }> | null;
  // Point d’ancrage du pin, posé SUR l’objet (le centre d’une bbox en L tombe à côté).
  anchorById?: Record<string, { x: number; y: number }> | null;
  // Squelette d'items issu de l'ANALYSE (phase A) : les pins s'affichent dès que
  // l'analyse existe, sans attendre le matching catalogue (phase B) — popover
  // « Pas encore de propositions » en attendant la liste.
  analysisItems?: ShoppingItem[] | null;
};

export function FinalScreen({
  projectId,
  beforeUrl,
  afterUrl,
  shoppingList: initialShoppingList,
  scoreFoyer: initialScoreFoyer,
  alterations,
  liveEditsUsed = 0,
  pendingList = false,
  expertMode = false,
  diyBeta = false,
  productOverrides = null,
  productPicks = null,
  customProducts = null,
  fakeRenderUrl = null,
  bboxById = null,
  anchorById = null,
  analysisItems = null,
}: Props) {
  const [showFake, setShowFake] = useState(false);
  // Position du curseur avant/après : les pins passés SOUS la moitié « avant »
  // pointeraient un meuble qui n'existe pas dans la photo d'origine.
  const [sliderPos, setSliderPos] = useState(20);
  const [pinsOn, setPinsOn] = useState(true);
  const [hdLoading, setHdLoading] = useState(false);
  // Boîte « Nouveau rendu » : produits alternatifs ET/OU consigne libre.
  const [newRenderOpen, setNewRenderOpen] = useState(false);
  const [newRenderPrompt, setNewRenderPrompt] = useState("");
  const router = useRouter();
  const { user, profile, wallet } = useUser();
  const [tabIdx, setTabIdx] = useState(0);
  const [paywallTrigger, setPaywallTrigger] = useState<PaywallTrigger | null>(null);
  const [liveEditBanner, setLiveEditBanner] = useState(false);
  const [localLiveEditsUsed, setLocalLiveEditsUsed] = useState(liveEditsUsed);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(initialShoppingList);
  const [scoreFoyer, setScoreFoyer] = useState<ScoreFoyer | undefined>(initialScoreFoyer);
  const [refreshing, setRefreshing] = useState(false);
  const [listPending, setListPending] = useState(pendingList);
  // Bboxes + squelette d'items en ÉTAT (pas seulement props) : la page est servie
  // AVANT le calcul avec bboxById=null figé — le poll les met à jour dès que
  // l'analyse (phase A) existe → pins pendant le matching ET sans reload
  // (pins invisibles même liste prête, QA Alexis 2026-07-11).
  const [bboxState, setBboxState] = useState(bboxById);
  const [anchorState, setAnchorState] = useState(anchorById);
  const [skeletonItems, setSkeletonItems] = useState(analysisItems);

  // Mode « préparation » : la liste se calcule en fond (déclenchée par la page) —
  // on polle le statut jusqu'à son arrivée. Le statut relance lui-même un calcul
  // si le précédent est mort (bail expiré) → auto-réparant. Timeout ~2 min.
  useEffect(() => {
    if (!listPending) return;
    let stopped = false;
    let polls = 0;
    const interval = setInterval(async () => {
      polls += 1;
      try {
        const res = await fetch(`/api/projects/${projectId}/shopping-status`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as {
          ready: boolean;
          shoppingList?: ShoppingItem[];
          scoreFoyer?: ScoreFoyer;
          analysis?: {
            bboxById: Record<string, { x: number; y: number; w: number; h: number }>;
            anchorById?: Record<string, { x: number; y: number }> | null;
            items?: ShoppingItem[];
          } | null;
        };
        if (stopped) return;
        if (data.analysis) {
          setBboxState(data.analysis.bboxById);
          setAnchorState(data.analysis.anchorById ?? null);
          if (data.analysis.items?.length) setSkeletonItems(data.analysis.items);
        }
        if (data.ready && data.shoppingList) {
          stopped = true;
          clearInterval(interval);
          setShoppingList(data.shoppingList);
          if (data.scoreFoyer) setScoreFoyer(data.scoreFoyer);
          setListPending(false);
          return;
        }
      } catch {
        // transitoire : on retentera au tick suivant
      }
      if (polls >= 48 && !stopped) {
        stopped = true;
        clearInterval(interval);
        setListPending(false);
        toast.error("La liste met plus de temps que prévu — utilisez « Rafraichir la liste ».");
      }
    }, 2500);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [listPending, projectId]);
  const debug = useDebug(); // ?debug=1 → affichage scoring + layout large (sinon design éditorial 480px)

  const alterationsList = ((alterations as { alterations?: Alteration[] } | null)
    ?.alterations ?? []) as Alteration[];

  const isExpert = profile?.plan === "expert" || profile?.plan === "pro";
  const hasCredits = (wallet?.balance ?? 0) > 0;

  // ── Liste de courses alternative (mode expert) ─────────────────────────────
  // On accumule les choix de produits alternatifs SANS re-render à chaque clic ;
  // un seul bouton relance le rendu avec les (x) éléments modifiés.
  //
  // L'INDICE EST RECALCULÉ À PARTIR DE L'ID CHOISI, jamais lu tel quel. productOverrides
  // stockait un indice dans `matches` — or ce tableau est réordonné à chaque
  // reconstruction de liste (le produit intégré remonte en tête). L'indice pointait donc
  // sur un AUTRE produit après un refresh : Alexis avait choisi « Meuble tv marron », la
  // carte affichait « Meuble tv 3 portes effet noyer » (QA 2026-07-12). Le serveur a été
  // corrigé (productPicks, par ID) mais le client lisait toujours l'indice.
  // Ici on cherche, DANS LE TABLEAU AFFICHÉ, la position du produit réellement choisi.
  const rendered = useMemo(() => {
    const out: Record<string, number> = {};
    for (const it of shoppingList) {
      if (!it.elementId || !it.matches?.length) continue;
      const pid = productPicks?.[it.elementId];
      if (pid) {
        const i = it.matches.findIndex((m) => m.id === pid);
        out[it.elementId] = i >= 0 ? i : 0;
      } else if (productOverrides?.[it.elementId] != null) {
        // Repli : projets créés avant productPicks. Fragile par construction, mais
        // c'est tout ce qu'ils ont.
        out[it.elementId] = productOverrides[it.elementId];
      }
    }
    return out;
  }, [shoppingList, productPicks, productOverrides]);
  const renderedCustom = customProducts ?? {};
  // `selUser` = les clics de l'utilisateur, RIEN d'autre. La sélection affichée est
  // `rendered` (ce qui est dans l'image) écrasé par ses clics. Initialiser un state avec
  // `rendered` le figeait au premier montage : quand la liste arrive par le poll, les
  // indices avaient changé et la sélection pointait à côté.
  const [selUser, setSelUser] = useState<Record<string, number>>({});
  const sel = useMemo(() => ({ ...rendered, ...selUser }), [rendered, selUser]);
  const [cust, setCust] = useState<Record<string, CustomProduct>>(() => ({ ...renderedCustom }));
  const [rerendering, setRerendering] = useState(false);
  const chooseProduct = (elementId: string, idx: number) =>
    setSelUser((prev) => ({ ...prev, [elementId]: idx }));
  const setCustomProduct = (elementId: string, cp: CustomProduct | null) =>
    setCust((prev) => {
      const next = { ...prev };
      if (cp) next[elementId] = cp;
      else delete next[elementId];
      return next;
    });
  // x = nb d'éléments dont le produit choisi (index OU sur-mesure) diffère du rendu.
  const changedIdx = Array.from(new Set([...Object.keys(sel), ...Object.keys(rendered)]))
    .filter((k) => (sel[k] ?? 0) !== (rendered[k] ?? 0));
  const changedCustom = Array.from(new Set([...Object.keys(cust), ...Object.keys(renderedCustom)]))
    .filter((k) => (cust[k]?.imageUrl ?? "") !== (renderedCustom[k]?.imageUrl ?? ""));
  const changedCount = new Set([...changedIdx, ...changedCustom]).size;

  // « Commander » ouvre les pages des produits RÉELLEMENT choisis (référence
  // sur-mesure > produit sélectionné > meilleur match), pas tous les liens du
  // catalogue : l'utilisateur commande ce qu'il voit dans sa liste.
  const orderUrls = Array.from(
    new Set(
      shoppingList
        .map((it) => {
          const custom = it.elementId ? cust[it.elementId] : undefined;
          if (custom?.url) return custom.url;
          const idx = (it.elementId ? sel[it.elementId] : undefined) ?? 0;
          return (it.matches?.[idx] ?? it.matches?.[0])?.product_url ?? null;
        })
        .filter((u): u is string => Boolean(u)),
    ),
  );

  // Tirage HD : on télécharge une IMAGE, le projet ne bouge pas. On force le
  // téléchargement via un blob plutôt qu'un simple lien : sinon le navigateur ouvrirait
  // le PNG dans un onglet au lieu de l'enregistrer.
  async function handleHd() {
    if (hdLoading) return;
    setHdLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/hd`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !data?.url) {
        toast.error(data?.error ?? "Le tirage HD a échoué. Réessayez.");
        return;
      }
      const blob = await (await fetch(data.url)).blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `foyer-${projectId}-hd.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Image HD téléchargée.");
    } catch {
      toast.error("Le tirage HD a échoué. Réessayez.");
    } finally {
      setHdLoading(false);
    }
  }

  /**
   * Relance un rendu. Deux leviers, cumulables dans le MÊME geste :
   *  · les produits alternatifs choisis dans la liste (swap catalogue) ;
   *  · une consigne libre (« change le sol », « des murs plus clairs ») → itération.
   *
   * Le bouton était MORT tant qu'aucun produit n'avait changé : impossible de demander
   * autre chose depuis là. Il ouvre désormais une boîte de dialogue, même sans
   * modification de la liste.
   *
   * Les deux appels sont séquentiels quand les deux leviers sont utilisés : le swap
   * d'abord (il ne repose que ce qui a changé), la consigne ensuite, sur le résultat.
   * Chaque appel = une génération : on ne les lance donc que s'ils ont quelque chose à
   * faire.
   */
  async function handleNewRender() {
    const consigne = newRenderPrompt.trim();
    if (rerendering || (changedCount < 1 && !consigne)) return;
    setRerendering(true);
    setNewRenderOpen(false);
    try {
      if (changedCount >= 1) {
        const res = await fetch(`/api/projects/${projectId}/product-overrides`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overrides: sel, customProducts: cust }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          toast.error(data?.error ?? "Le nouveau rendu a échoué. Réessayez.");
          setRerendering(false);
          return;
        }
      }
      if (consigne) {
        const res = await fetch(`/api/projects/${projectId}/iterate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userRequest: consigne }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          toast.error(data?.error ?? "La retouche a échoué. Réessayez.");
          setRerendering(false);
          return;
        }
      }
      // On reste sur /final : le slider y montre déjà le rendu expert à jour.
      // L'ancien écran /expert récapitulait les « vrais meubles intégrés », mais il
      // les RECALCULAIT (selectExpertPieces sur la liste) au lieu de lire
      // expertIntegratedPieces — la seule vérité de ce qui est dans l'image. Après
      // une itération changeant un meuble, les deux divergeaient.
      setNewRenderPrompt("");
      // Rechargement DUR, pas router.refresh() : la liste vit dans l'état CLIENT
      // (useState initialisé au montage + poll arrêté une fois la liste servie) —
      // le refresh doux remettait l'image à jour mais laissait l'ANCIENNE liste à
      // l'écran (EJFyzwWG, QA Alexis 2026-07-16 : « c'est encore l'ancienne liste,
      // ça doit pas arriver »). Même geste que le pin « Modifier ce meuble ».
      window.location.reload();
    } catch {
      toast.error("Le nouveau rendu a échoué. Réessayez.");
      setRerendering(false);
    }
  }

  function handleLiveEdit() {
    if (isExpert) {
      toast.info("Édition live Expert — sélectionnez un élément (coming soon).");
      return;
    }
    if (localLiveEditsUsed === 0) {
      // First free live edit
      setLocalLiveEditsUsed(1);
      setLiveEditBanner(true);
      toast.success("1 édition live offerte utilisée !");
      return;
    }
    setPaywallTrigger("live_edit");
  }

  function handleProductUrl() {
    if (isExpert) {
      toast.info("URL produit — fonctionnalité disponible prochainement (coming soon).");
      return;
    }
    setPaywallTrigger("product_url");
  }

  async function handleRefreshShopping() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/refresh-shopping`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { shoppingList: ShoppingItem[]; scoreFoyer?: ScoreFoyer };
      setShoppingList(data.shoppingList);
      if (data.scoreFoyer) setScoreFoyer(data.scoreFoyer);
      toast.success("Liste de courses actualisée !");
    } catch {
      toast.error("Erreur lors du rafraîchissement. Réessayez.");
    } finally {
      setRefreshing(false);
    }
  }


  return (
    <ExpertOverridesProvider value={{ enabled: expertMode, selected: sel, choose: chooseProduct, custom: cust, setCustom: setCustomProduct }}>
      <div className="flex flex-1 flex-col">
        <ProgressBar currentStep={5} labels={STEPS} />

        <main className={cn("mx-auto w-full flex-1 px-5 pt-6", debug ? "max-w-[820px]" : "max-w-[480px] lg:max-w-[960px]", (expertMode || orderUrls.length > 0) ? "pb-36" : "pb-24")}>
          {/* Before / After slider (expert : bouton bas-droit pour basculer
              rendu réel ↔ rendu IA d'origine, comme l'ancien écran expert) */}
          <div className="relative">
            <BeforeAfterSlider
              before={beforeUrl}
              after={showFake && fakeRenderUrl ? fakeRenderUrl : afterUrl}
              initialPos={20}
              className="rounded-2xl"
              onPosChange={setSliderPos}
            />
            {/* Hotspots meubles (dots + matches + tap-to-target) — masqués côté
                rendu fake (les bboxes appartiennent au rendu affiché par défaut).
                Liste en cours de calcul → pins quand même, depuis le squelette
                d'items de l'ANALYSE (les positions viennent de la détection, pas
                du matching) ; les propositions arrivent avec la liste. */}
            {pinsOn && bboxState && !showFake && (!listPending || (skeletonItems?.length ?? 0) > 0) && (
              <RenderHotspots
                projectId={projectId}
                items={listPending ? (skeletonItems ?? []) : shoppingList}
                bboxById={bboxState}
                anchorById={anchorState}
                sliderPos={sliderPos}
                showModify={!expertMode}
                selected={expertMode ? sel : undefined}
                onSelect={
                  expertMode
                    ? chooseProduct
                    : (eid, idx) => {
                        // Choix top-1 SANS recalcul : réordonne la ligne localement
                        // (la carte liste suit) + persiste (survit au refresh/verrou).
                        setShoppingList((prev) =>
                          prev.map((it) =>
                            it.elementId === eid && it.matches && idx < it.matches.length
                              ? { ...it, matches: [it.matches[idx], ...it.matches.filter((_, i) => i !== idx)] }
                              : it,
                          ),
                        );
                        fetch(`/api/projects/${projectId}/choose-match`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ elementId: eid, matchIdx: idx }),
                        }).catch(() => toast.error("Choix non sauvegardé — réessayez."));
                      }
                }
              />
            )}
            {/* Les pins encombrent quand on veut juste REGARDER le rendu → on doit
                pouvoir les éteindre. z-40 : au-dessus de la couche hotspots (z-30). */}
            {bboxState && !showFake && (
              <button
                type="button"
                onClick={() => setPinsOn((v) => !v)}
                aria-pressed={pinsOn}
                className="absolute bottom-3 left-3 z-40 flex items-center gap-1.5 rounded-full bg-foyer-ink/75 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur transition-opacity hover:bg-foyer-ink"
              >
                <MapPin className="size-3.5" aria-hidden />
                {pinsOn ? "Masquer les repères" : "Afficher les repères"}
              </button>
            )}
            {fakeRenderUrl && (
              <button
                type="button"
                onClick={() => setShowFake((v) => !v)}
                className="absolute bottom-3 right-3 z-40 flex items-center gap-1.5 rounded-full bg-foyer-ink/75 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur transition-opacity hover:bg-foyer-ink"
              >
                <Eye className="size-3.5" aria-hidden />
                {showFake ? "Voir le rendu réel" : "Voir le rendu IA"}
              </button>
            )}
          </div>

          {/* ÉDITION LIVE — vitrine du flux GRATUIT seulement. C'est un add-on qu'on VEND
              (badge « Expert ») : le proposer dans le rendu expert, c'est vendre à quelqu'un
              ce qu'il a déjà — et, en mode expert, changer un meuble se fait de toute façon
              par les pins du rendu puis « Modifier ». */}
          {!expertMode && (
            <button
              type="button"
              onClick={handleLiveEdit}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-foyer-border bg-white px-4 py-3 text-[14px] font-medium text-foyer-ink transition-all hover:border-foyer-sage/50 hover:bg-foyer-sage/5"
            >
              <Pencil className="size-4 text-foyer-sage" />
              Édition live — changer un meuble
              {!isExpert && (
                <span className="ml-auto rounded-full bg-foyer-sage/15 px-2 py-0.5 text-[11px] font-semibold text-foyer-sage">
                  Expert
                </span>
              )}
            </button>
          )}

          {liveEditBanner && (
            <div className="mt-2 rounded-xl bg-foyer-sage/10 px-4 py-2.5 text-[12px] leading-relaxed text-foyer-sage">
              1 édition live offerte utilisée.{" "}
              <button
                type="button"
                onClick={() => setPaywallTrigger("live_edit")}
                className="font-semibold underline underline-offset-2"
              >
                Passez Expert pour en faire plus →
              </button>
            </div>
          )}

          {/* Segmented tab control */}
          <div className="relative mt-5 flex rounded-full border border-foyer-border bg-foyer-cream p-1">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-1 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out"
              style={{
                width: "calc(50% - 4px)",
                left: 4,
                transform: `translateX(${tabIdx * 100}%)`,
              }}
            />
            {TABS.map((t, i) => (
              <button
                key={t}
                type="button"
                onClick={() => setTabIdx(i)}
                className={cn(
                  "relative z-10 flex-1 rounded-full py-1.5 text-[13px] font-medium transition-colors duration-150",
                  tabIdx === i ? "text-foyer-ink" : "text-foyer-muted",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Refresh button — visible on shopping tab (recalcule les matchs catalogue) */}
          {tabIdx === 0 && !listPending && (
            <button
              type="button"
              onClick={handleRefreshShopping}
              disabled={refreshing}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-foyer-border bg-white px-4 py-2.5 text-[13px] font-medium text-foyer-muted transition-colors hover:border-foyer-sage/50 hover:text-foyer-sage disabled:opacity-50"
            >
              <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
              {refreshing ? "Rafraîchissement…" : "Rafraichir la liste"}
            </button>
          )}

          {/* Liste en préparation (calcul en fond) — squelette + polling */}
          {listPending && (
            <div className="mt-5 duration-300 animate-in fade-in">
              <div className="flex items-center gap-2.5 rounded-xl border border-foyer-border bg-white px-4 py-3">
                <RefreshCw className="size-4 animate-spin text-foyer-sage" aria-hidden />
                <div>
                  <p className="text-[13px] font-medium text-foyer-ink">
                    Liste de courses en préparation…
                  </p>
                  <p className="text-[12px] text-foyer-muted">
                    On analyse votre rendu et cherche les meilleures pièces.
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-3" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex animate-pulse items-center gap-3 rounded-xl border border-foyer-border bg-white p-3"
                    style={{ animationDelay: `${i * 150}ms` }}
                  >
                    <div className="size-16 shrink-0 rounded-lg bg-foyer-border/60" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-2/3 rounded bg-foyer-border/60" />
                      <div className="h-3 w-1/3 rounded bg-foyer-border/40" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vos références (produits fournis par URL/JPEG) — mode expert */}
          {expertMode && tabIdx === 0 && !listPending && Object.keys(cust).length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-foyer-sage">
                Vos références
              </p>
              <ul className="flex flex-col gap-2">
                {Object.entries(cust).map(([key, cp]) => (
                  <li key={key} className="flex items-center gap-3 rounded-2xl border border-foyer-border bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cp.imageUrl} alt="" className="size-14 shrink-0 rounded-xl border border-foyer-border object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[14px] font-medium text-foyer-ink">{cp.name ?? refLabel(key)}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-foyer-muted">
                        <span className="rounded-full bg-foyer-sage/15 px-2 py-0.5 font-medium text-foyer-sage">{refLabel(key)}</span>
                        {cp.merchant && <span>{cp.merchant}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="font-serif text-[16px] text-foyer-ink">{cp.price != null ? `${cp.price} €` : "–"}</span>
                      <div className="flex items-center gap-1.5">
                        {cp.url && (
                          <a href={cp.url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 rounded-full border border-foyer-border px-2.5 py-1 text-[13px] text-foyer-ink transition-colors hover:bg-foyer-cream">
                            <ExternalLink className="size-3" aria-hidden />Voir
                          </a>
                        )}
                        <button type="button" onClick={() => setCustomProduct(key, null)}
                          className="rounded-full border border-foyer-border px-2.5 py-1 text-[13px] text-foyer-muted transition-colors hover:text-foyer-ink">
                          Retirer
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sliding content */}
          {!listPending && (
          <div className="mt-5 overflow-hidden">
            <div
              className="flex transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${tabIdx * 100}%)` }}
            >
              {/* Slide 0 — Liste shopping with product URL buttons */}
              <div className="min-w-full">
                <EnhancedListeShoppingTab
                  shoppingList={shoppingList}
                  alterations={alterationsList}
                  onProductUrl={handleProductUrl}
                  diyBeta={diyBeta}
                />
              </div>
              {/* Slide 1 — Score Foyer */}
              <div className="min-w-full">
                <ScoreFoyerTab
                  score={scoreFoyer}
                  shoppingList={shoppingList}
                />
              </div>
            </div>
          </div>
          )}

          {/* « Affiner encore » et « Recommencer un projet » retirés : l'affinage a déjà
              son entrée (« Édition live » + les pins), et repartir de zéro n'a rien à
              faire en bas d'une liste d'achat. « Commander » est monté dans la barre
              flottante — il doit rester atteignable sans scroller jusqu'en bas. */}
          {!listPending && (
            <div className="mt-8">
              {/* Le projet est fini : on peut se payer une passe 4K dont le seul but est
                  la netteté. L'image téléchargée ne remplace PAS le rendu du projet. */}
              <button
                type="button"
                onClick={handleHd}
                disabled={hdLoading}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full border border-foyer-border font-medium text-foyer-ink transition-colors hover:bg-foyer-border/30 disabled:opacity-50"
              >
                {hdLoading ? (
                  <><Loader2 className="size-4 animate-spin" aria-hidden /> Tirage HD en cours…</>
                ) : (
                  <>
                    <Download className="size-4" aria-hidden /> Télécharger mon image en HD
                    <span className="text-[10px] uppercase tracking-wide bg-foyer-terra/10 text-foyer-terra px-1.5 py-0.5 rounded-full">
                      Payant
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </main>
      </div>

      {/* BARRE FLOTTANTE — « Commander » (primaire) et « Nouveau rendu » (secondaire).
          Elle n'apparaissait qu'en mode expert : y monter « Commander » tel quel l'aurait
          fait disparaître pour tous les autres. Elle s'affiche donc dès qu'il y a quelque
          chose à commander. Le rendu alternatif est SECONDAIRE : c'est l'achat qui est
          l'action principale, pas la régénération. */}
      {!listPending && (orderUrls.length > 0 || expertMode) && (
        // z-40 : sans z-index, la barre restait DERRIÈRE les onglets « Liste shopping /
        // Score Foyer », dont les boutons portent `relative z-10` — leur texte traversait
        // le bouton « Commander » (QA Alexis 2026-07-14). Sous les modales, qui sont en z-50.
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-foyer-border bg-foyer-cream/95 px-5 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-[480px] flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              {orderUrls.length > 0 && (
                <button
                  type="button"
                  onClick={() => { for (const url of orderUrls) window.open(url, "_blank"); }}
                  className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-foyer-sage font-medium text-white shadow-[0_2px_8px_rgba(107,142,111,0.35)] transition-all hover:-translate-y-0.5"
                >
                  <ShoppingBag className="size-4" aria-hidden />
                  Commander
                </button>
              )}
              {expertMode && (
                <button
                  type="button"
                  disabled={rerendering}
                  onClick={() => setNewRenderOpen(true)}
                  className={cn(
                    "flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full border font-medium transition-all",
                    rerendering
                      ? "cursor-not-allowed border-foyer-border text-foyer-muted"
                      : "border-foyer-ink text-foyer-ink hover:bg-foyer-ink/5",
                  )}
                >
                  {rerendering ? (
                    <><Loader2 className="size-4 animate-spin" aria-hidden /> Rendu en cours…</>
                  ) : (
                    <>
                      {/* « Nouveau rendu » disait au user qu'il repartait de zéro, alors que
                          ce bouton MODIFIE son rendu (produits échangés + demande libre).
                          Le geste, et donc le mot, c'est « Modifier ». */}
                      <Pencil className="size-4" aria-hidden />
                      Modifier
                      {changedCount >= 1 && (
                        <span className="rounded-full bg-foyer-ink/10 px-1.5 text-[12px] font-semibold">
                          {changedCount}
                        </span>
                      )}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NOUVEAU RENDU — produits alternatifs ET/OU consigne libre, dans le même geste.
          Le bouton était mort tant qu'aucun produit n'avait changé : on ne pouvait pas
          demander « change le sol » depuis là. Les deux leviers sont cumulables ; chacun
          coûte une génération, donc on n'appelle que ceux qui ont quelque chose à faire. */}
      {newRenderOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foyer-ink/40 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setNewRenderOpen(false)}
        >
          <div
            className="w-full max-w-[440px] rounded-3xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-serif text-xl text-foyer-ink">Modifier le rendu</h3>

            {changedCount >= 1 && (
              <p className="mt-2 rounded-xl bg-foyer-sage/10 px-3 py-2 text-[13px] text-foyer-sage">
                {changedCount} produit{changedCount > 1 ? "s" : ""} alternatif
                {changedCount > 1 ? "s" : ""} ser{changedCount > 1 ? "ont" : "a"} intégré
                {changedCount > 1 ? "s" : ""} au rendu.
              </p>
            )}

            <label
              htmlFor="new-render-prompt"
              className="mt-4 block text-[14px] font-medium text-foyer-ink"
            >
              Autre chose à changer&nbsp;?
            </label>
            <p className="mt-0.5 text-[12px] text-foyer-muted">
              Le sol, les murs, un meuble que vous n&apos;avez pas remplacé… Tout ce qui
              n&apos;est pas un produit du catalogue passe par ici.
            </p>
            <textarea
              id="new-render-prompt"
              value={newRenderPrompt}
              onChange={(e) => setNewRenderPrompt(e.target.value)}
              rows={3}
              placeholder="Ex. un parquet plus foncé, des murs plus clairs, enlever la plante du coin…"
              className="mt-2 w-full resize-none rounded-xl border border-foyer-border bg-foyer-cream px-3 py-2.5 text-[14px] text-foyer-ink outline-none placeholder:text-foyer-muted focus:border-foyer-ink"
            />

            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setNewRenderOpen(false)}
                className="h-[46px] flex-1 rounded-full border border-foyer-border font-medium text-foyer-ink transition-colors hover:bg-foyer-border/30"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleNewRender}
                disabled={changedCount < 1 && !newRenderPrompt.trim()}
                className="h-[46px] flex-1 rounded-full bg-foyer-sage font-medium text-white transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-foyer-border disabled:text-foyer-muted disabled:hover:translate-y-0"
              >
                Lancer le rendu
              </button>
            </div>
          </div>
        </div>
      )}

      {!PAYWALL_DISABLED && paywallTrigger && (
        <PaywallModal
          trigger={paywallTrigger}
          onClose={() => setPaywallTrigger(null)}
        />
      )}
    </ExpertOverridesProvider>
  );
}

// ── Enhanced shopping tab with product URL buttons ────────────────────────────
function EnhancedListeShoppingTab({
  shoppingList,
  alterations,
  onProductUrl,
  diyBeta = false,
}: {
  shoppingList: ShoppingItem[];
  alterations: Alteration[];
  onProductUrl: () => void;
  diyBeta?: boolean;
}) {
  // Dedup by id before grouping (guards against stale cached data with duplicate catalog products)
  const seen = new Set<string>();
  const dedupedList = shoppingList.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  // Group shopping items by family
  const byFamily = new Map<Family, ShoppingItem[]>();
  for (const item of dedupedList) {
    // Les fournitures DIY (peinture, moulures, tasseaux) héritent de la catégorie
    // de l'élément (ex. "wall") → on les force dans « Fournitures » via la source.
    const f = item.source === "diy" ? "Fournitures" : toFamily(item.category);
    if (!byFamily.has(f)) byFamily.set(f, []);
    byFamily.get(f)!.push(item);
  }

  const keptByFamily = new Map<Family, Alteration[]>();
  for (const a of alterations.filter((a) => a.shoppingImpact === "none")) {
    const f = toFamily(a.category);
    if (!keptByFamily.has(f)) keptByFamily.set(f, []);
    keptByFamily.get(f)!.push(a);
  }

  const activeFamilies = FAMILIES.filter(
    (f) => (byFamily.get(f)?.length ?? 0) > 0 || (keptByFamily.get(f)?.length ?? 0) > 0,
  );

  const allUrls = shoppingList
    .flatMap((i) => i.merchants.map((m) => m.url).filter(Boolean))
    .slice(0, 20) as string[];

  if (activeFamilies.length === 0) {
    return (
      <div className="rounded-2xl border border-foyer-border bg-white px-5 py-8 text-center">
        <p className="text-[15px] text-foyer-muted">La liste de courses se prépare…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {activeFamilies.map((family) => {
        const items = byFamily.get(family) ?? [];
        const kept = keptByFamily.get(family) ?? [];
        // "matched" = a un produit catalogue matché OU un marchand (legacy).
        const matched = items.filter((i) => (i.matches?.length ?? 0) > 0 || i.merchants.length > 0);
        const unmatched = items.filter((i) => (i.matches?.length ?? 0) === 0 && i.merchants.length === 0);
        const count = matched.length + kept.length;

        return (
          <section key={family}>
            <SectionLabel>
              {family} {count > 0 && `(${count})`}
            </SectionLabel>

            <ul className="flex flex-col gap-3">
              {matched.map((item) => (
                <ShoppingItemRow
                  key={item.id}
                  item={item}
                  onProductUrl={onProductUrl}
                />
              ))}

              {unmatched.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-dashed border-foyer-border bg-white px-4 py-3"
                >
                  <span className="size-2 shrink-0 rounded-full bg-foyer-muted/40" aria-hidden />
                  <span className="shrink-0 rounded bg-foyer-border/40 px-1.5 py-0.5 text-[11px] font-mono text-foyer-muted">
                    {item.category.replace(/_/g, " ")}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] text-foyer-muted" title={item.name}>
                    {item.name}
                  </span>
                  {(item.quantity ?? 1) > 1 && (
                    <span className="shrink-0 rounded-full bg-foyer-ink/10 px-2 py-0.5 text-[12px] font-semibold text-foyer-ink">
                      ×{item.quantity}
                    </span>
                  )}
                  {diyBeta && item.source === "diy" ? (
                    <span
                      className="shrink-0 rounded-full bg-foyer-sage/15 px-2 py-0.5 text-[12px] font-medium text-foyer-sage"
                      title={item.detail ?? undefined}
                    >
                      ✦ Customisation
                    </span>
                  ) : (
                    <span className="shrink-0 text-[12px] text-foyer-muted">À sourcer</span>
                  )}
                </li>
              ))}

              {kept.map((a) => (
                <li
                  key={a.element}
                  className="flex items-center gap-3 rounded-xl border border-foyer-border bg-white px-4 py-3"
                >
                  <span className="size-2 shrink-0 rounded-full bg-foyer-sage" aria-hidden />
                  <span className="text-[14px] capitalize text-foyer-ink">{a.element}</span>
                  <span className="ml-auto text-[12px] text-foyer-sage font-medium">Conservé</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <ListTotal items={dedupedList} />

      {allUrls.length > 0 && (
        <button
          type="button"
          onClick={() => { for (const url of allUrls) window.open(url, "_blank"); }}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-foyer-border py-3 text-[14px] font-medium text-foyer-ink transition-colors hover:bg-foyer-border/30"
        >
          <ExternalLink className="size-4" aria-hidden />
          Tout ouvrir ({allUrls.length} liens)
        </button>
      )}
    </div>
  );
}

// ── Total de la liste ─────────────────────────────────────────────────────────
// Le prix additionné est celui RÉELLEMENT AFFICHÉ sur chaque ligne : on relit le
// même choix que ShoppingCard (référence sur-mesure > produit choisi > meilleur
// match). Sommer priceMin/priceMax donnerait un total qui ne correspond à aucun
// prix visible à l'écran, donc invérifiable par l'utilisateur.
function ListTotal({ items }: { items: ShoppingItem[] }) {
  const ov = useExpertOverrides();

  let total = 0;
  let chiffres = 0;
  let sansPrix = 0;

  for (const it of items) {
    const qty = it.quantity ?? 1;
    const custom = it.elementId ? ov?.custom[it.elementId] : undefined;
    const idx = (it.elementId ? ov?.selected?.[it.elementId] : undefined) ?? 0;
    const price = custom ? custom.price : (it.matches?.[idx] ?? it.matches?.[0])?.price;

    if (typeof price === "number") {
      total += price * qty;
      chiffres += qty;
    } else {
      sansPrix += qty;
    }
  }

  if (chiffres === 0 && sansPrix === 0) return null;

  return (
    <div className="rounded-2xl border border-foyer-border bg-white px-5 py-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[14px] font-medium text-foyer-ink">
          Total — {chiffres + sansPrix} article{chiffres + sansPrix > 1 ? "s" : ""}
        </span>
        <span className="font-serif text-2xl text-foyer-ink">
          {Math.round(total).toLocaleString("fr-FR")}&nbsp;€
        </span>
      </div>
      {sansPrix > 0 && (
        <p className="mt-1 text-[12px] text-foyer-muted">
          dont {sansPrix} article{sansPrix > 1 ? "s" : ""} encore à sourcer, non compté{sansPrix > 1 ? "s" : ""} dans le total
        </p>
      )}
    </div>
  );
}
