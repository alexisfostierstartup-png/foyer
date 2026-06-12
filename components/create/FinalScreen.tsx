"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Pencil, Link2, Star, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ProgressBar } from "@/components/create/ProgressBar";
import { BeforeAfterSlider } from "@/components/create/BeforeAfterSlider";
import { ShoppingCard } from "@/components/create/ShoppingCard";
import { PaywallModal } from "@/components/paywalls/PaywallModal";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/auth/useUser";
import type { ShoppingItem, ScoreFoyer } from "@/lib/types";
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

// ── Section routing (α-10) ───────────────────────────────────────────────────
const DIY_CATEGORIES = new Set(["paint", "mouldings", "floor_material"]);

type Section = "lbc" | "partner" | "diy" | "mock";

function itemSection(item: ShoppingItem): Section {
  if (item.matchingSource === "lbc") return "lbc";
  if (item.matchingSource === "partner" || item.matchingSource === "mock_catalog") {
    return DIY_CATEGORIES.has(item.category) ? "diy" : "partner";
  }
  // Fallback pour items sans matchingSource (mock ancien format)
  if (DIY_CATEGORIES.has(item.category)) return "diy";
  return "mock";
}

// Conservé pour le cas mock_catalog (groupement family legacy)
type Family = "Mobilier" | "Décoration" | "Accessoires" | "Fournitures";
const FAMILIES: Family[] = ["Mobilier", "Décoration", "Accessoires", "Fournitures"];
const CATEGORY_FAMILY: Record<string, Family> = {
  sofa: "Mobilier", armchair: "Mobilier", coffee_table: "Mobilier",
  side_table: "Mobilier", tv_stand: "Mobilier", bookshelf: "Mobilier",
  bed: "Mobilier", nightstand: "Mobilier", dresser: "Mobilier",
  rug: "Décoration", lamp: "Décoration", floor_lamp: "Décoration", curtains: "Décoration",
  cushion: "Accessoires", plant: "Accessoires", other: "Accessoires",
  paint: "Fournitures", mouldings: "Fournitures", floor_material: "Fournitures",
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
  const total = kept + secondhand + ecoNew || 1;
  const co2 = score?.co2SavedKg ?? kept * 30 + secondhand * 20 + ecoNew * 5;
  const budget = score?.totalEstimated ?? shoppingList.reduce((s, i) => s + (i.priceMin + i.priceMax) / 2, 0);

  const segments = [
    { value: Math.round((kept / total) * 100), label: "conservé", color: "#6B8E6F", dot: "bg-foyer-sage" },
    { value: Math.round((secondhand / total) * 100), label: "occasion", color: "#A5B8A0", dot: "bg-foyer-water" },
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
            <p className="text-[12px] text-foyer-muted">conservés</p>
          </div>
          <div>
            <p className="font-serif text-2xl text-foyer-ink">{secondhand}</p>
            <p className="text-[12px] text-foyer-muted">occasion</p>
          </div>
          <div>
            <p className="font-serif text-2xl text-foyer-ink">{ecoNew}</p>
            <p className="text-[12px] text-foyer-muted">neuf éco</p>
          </div>
        </div>
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
};

export function FinalScreen({
  projectId,
  beforeUrl,
  afterUrl,
  shoppingList: initialShoppingList,
  scoreFoyer: initialScoreFoyer,
  alterations,
  liveEditsUsed = 0,
}: Props) {
  const router = useRouter();
  const { user, profile, wallet } = useUser();
  const [tabIdx, setTabIdx] = useState(0);
  const [paywallTrigger, setPaywallTrigger] = useState<PaywallTrigger | null>(null);
  const [liveEditBanner, setLiveEditBanner] = useState(false);
  const [localLiveEditsUsed, setLocalLiveEditsUsed] = useState(liveEditsUsed);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(initialShoppingList);
  const [scoreFoyer, setScoreFoyer] = useState<ScoreFoyer | undefined>(initialScoreFoyer);
  const [refreshing, setRefreshing] = useState(false);

  const alterationsList = ((alterations as { alterations?: Alteration[] } | null)
    ?.alterations ?? []) as Alteration[];

  const isExpert = profile?.plan === "expert" || profile?.plan === "pro";
  const hasCredits = (wallet?.balance ?? 0) > 0;

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

  function handleRestart() {
    if (isExpert) {
      router.push("/create");
      return;
    }
    if (user && hasCredits) {
      router.push("/create");
      return;
    }
    if (!user || (!hasCredits && !isExpert)) {
      setPaywallTrigger("second_project");
      return;
    }
    router.push("/create");
  }

  return (
    <>
      <div className="flex flex-1 flex-col">
        <ProgressBar currentStep={5} labels={STEPS} />

        <main className="mx-auto w-full max-w-[480px] flex-1 px-5 pb-24 pt-6">
          {/* Before / After slider */}
          <BeforeAfterSlider
            before={beforeUrl}
            after={afterUrl}
            initialPos={20}
            className="rounded-2xl"
          />

          {/* Live edit button */}
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

          {/* Refresh button — expert only, visible on shopping tab */}
          {isExpert && tabIdx === 0 && (
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

          {/* Sliding content */}
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

          {/* Actions */}
          <div className="mt-8 flex flex-col gap-3">
            <Link
              href={`/create/${projectId}/iterate`}
              className="flex h-[52px] w-full items-center justify-center rounded-full border border-foyer-border font-medium text-foyer-ink transition-colors hover:bg-foyer-border/30"
            >
              Affiner encore
            </Link>
            <button
              type="button"
              onClick={handleRestart}
              className="flex h-[52px] w-full items-center justify-center rounded-full bg-foyer-sage font-medium text-white shadow-[0_2px_8px_rgba(107,142,111,0.35)] transition-all hover:-translate-y-0.5"
            >
              Recommencer un projet
            </button>
          </div>
        </main>
      </div>

      {paywallTrigger && (
        <PaywallModal
          trigger={paywallTrigger}
          onClose={() => setPaywallTrigger(null)}
        />
      )}
    </>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ emoji, title, count }: { emoji: string; title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[15px]" aria-hidden>{emoji}</span>
      <SectionLabel>{title} {count > 0 && `(${count})`}</SectionLabel>
    </div>
  );
}

// ── Ligne item non-matchée ────────────────────────────────────────────────────
function UnmatchedRow({ item }: { item: ShoppingItem }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-dashed border-foyer-border bg-white px-4 py-3">
      <span className="size-2 shrink-0 rounded-full bg-foyer-muted/40" aria-hidden />
      <span className="text-[14px] capitalize text-foyer-muted">{item.name}</span>
      <span className="ml-auto text-[12px] text-foyer-muted">À sourcer</span>
    </li>
  );
}

// ── Ligne altération conservée ────────────────────────────────────────────────
function KeptRow({ alteration }: { alteration: Alteration }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-foyer-border bg-white px-4 py-3">
      <span className="size-2 shrink-0 rounded-full bg-foyer-sage" aria-hidden />
      <span className="text-[14px] capitalize text-foyer-ink">{alteration.element}</span>
      <span className="ml-auto text-[12px] text-foyer-sage font-medium">Conservé</span>
    </li>
  );
}

// ── Shopping tab avec 4 sections (α-10) ──────────────────────────────────────
function EnhancedListeShoppingTab({
  shoppingList,
  alterations,
  onProductUrl,
}: {
  shoppingList: ShoppingItem[];
  alterations: Alteration[];
  onProductUrl: () => void;
}) {
  const isHybrid = shoppingList.some(
    (i) => i.matchingSource === "lbc" || i.matchingSource === "partner",
  );

  // ── Mode hybride : 4 sections ────────────────────────────────────────────
  if (isHybrid) {
    const keptAlterations = alterations.filter((a) => a.shoppingImpact === "none");
    const lbcItems = shoppingList.filter((i) => itemSection(i) === "lbc");
    const partnerItems = shoppingList.filter((i) => itemSection(i) === "partner");
    const diyItems = shoppingList.filter((i) => itemSection(i) === "diy");
    const unmatched = shoppingList.filter((i) => i.merchants.length === 0);

    const hasContent =
      keptAlterations.length > 0 || lbcItems.length > 0 ||
      partnerItems.length > 0 || diyItems.length > 0;

    if (!hasContent) {
      return (
        <div className="rounded-2xl border border-foyer-border bg-white px-5 py-8 text-center">
          <p className="text-[15px] text-foyer-muted">La liste de courses se prépare…</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Section 1 — Conservé */}
        {keptAlterations.length > 0 && (
          <section>
            <SectionHeader emoji="✓" title="Conservé" count={keptAlterations.length} />
            <ul className="flex flex-col gap-3">
              {keptAlterations.map((a) => <KeptRow key={a.element} alteration={a} />)}
            </ul>
          </section>
        )}

        {/* Section 2 — Seconde main LBC */}
        {lbcItems.length > 0 && (
          <section>
            <SectionHeader emoji="⚐" title="Seconde main" count={lbcItems.length} />
            <ul className="flex flex-col gap-3">
              {lbcItems.map((item) => (
                <ShoppingItemRow key={item.id} item={item} onProductUrl={onProductUrl} />
              ))}
            </ul>
          </section>
        )}

        {/* Section 3 — Neuf durable */}
        {partnerItems.length > 0 && (
          <section>
            <SectionHeader emoji="🌱" title="Neuf durable" count={partnerItems.length} />
            <ul className="flex flex-col gap-3">
              {partnerItems.map((item) => (
                <ShoppingItemRow key={item.id} item={item} onProductUrl={onProductUrl} />
              ))}
            </ul>
          </section>
        )}

        {/* Section 4 — DIY & fournitures */}
        {diyItems.length > 0 && (
          <section>
            <SectionHeader emoji="🔧" title="DIY & fournitures" count={diyItems.length} />
            <ul className="flex flex-col gap-3">
              {diyItems.map((item) => (
                <ShoppingItemRow key={item.id} item={item} onProductUrl={onProductUrl} />
              ))}
            </ul>
          </section>
        )}

        {unmatched.length > 0 && (
          <section>
            <SectionLabel>À sourcer</SectionLabel>
            <ul className="flex flex-col gap-3">
              {unmatched.map((item) => <UnmatchedRow key={item.id} item={item} />)}
            </ul>
          </section>
        )}
      </div>
    );
  }

  // ── Mode mock_catalog legacy : groupement par famille ────────────────────
  const byFamily = new Map<Family, ShoppingItem[]>();
  for (const item of shoppingList) {
    const f = toFamily(item.category);
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

  if (activeFamilies.length === 0) {
    return (
      <div className="rounded-2xl border border-foyer-border bg-white px-5 py-8 text-center">
        <p className="text-[15px] text-foyer-muted">La liste de courses se prépare…</p>
      </div>
    );
  }

  const allUrls = shoppingList
    .flatMap((i) => i.merchants.map((m) => m.url).filter(Boolean))
    .slice(0, 20) as string[];

  return (
    <div className="space-y-6">
      {activeFamilies.map((family) => {
        const items = byFamily.get(family) ?? [];
        const kept = keptByFamily.get(family) ?? [];
        const matched = items.filter((i) => i.merchants.length > 0);
        const unmatched = items.filter((i) => i.merchants.length === 0);
        const count = matched.length + kept.length;
        return (
          <section key={family}>
            <SectionLabel>{family} {count > 0 && `(${count})`}</SectionLabel>
            <ul className="flex flex-col gap-3">
              {matched.map((item) => (
                <ShoppingItemRow key={item.id} item={item} onProductUrl={onProductUrl} />
              ))}
              {unmatched.map((item) => <UnmatchedRow key={item.id} item={item} />)}
              {kept.map((a) => <KeptRow key={a.element} alteration={a} />)}
            </ul>
          </section>
        );
      })}
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
