import { describe, it, expect } from "vitest";
import { buildColorwayDirective, formatDesignPlan } from "../helpers";
import type { StyleColorway } from "@/lib/db/database.types";

const chair = (i: number) => ({
  element_id: `dining_chair_${i}`,
  category: "dining_chair",
  description: "Chaise de salle à manger pivotante avec pieds noirs.",
  mismatch_type: "structural" as const,
  action_label: "Retapisser en velours moutarde", // suggestion caduque du verdict
  qty: null,
  qty_unit: null,
});

describe("formatDesignPlan", () => {
  it("regroupe les identiques en une ligne (cible = catégorie, suffixe silhouette pour les assises)", () => {
    const plan = formatDesignPlan([chair(1), chair(2), chair(3), chair(4)]);
    const lines = plan.split("\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("the 4 dining chairs");
    expect(lines[0]).toContain("put 4");
    // Assise : exigence de géométrie différente (anti « même silhouette retapissée »)
    expect(lines[0]).toContain("SILHOUETTE");
    // La description de l'original n'est plus citée (le modèle la recopiait)
    expect(lines[0]).not.toContain("pivotante");
  });

  it("REPLACE ignore l'action_label 'retapisser' (pas de contradiction)", () => {
    const plan = formatDesignPlan([chair(1)]);
    expect(plan.toLowerCase()).not.toContain("retapisser");
    expect(plan).toContain("REPLACE");
    expect(plan.toLowerCase()).toContain("do not reupholster");
  });

  it("garde l'action_label pour une surface (RESTYLE mur)", () => {
    const plan = formatDesignPlan([
      { category: "wall", description: "Mur blanc.", mismatch_type: "surface", action_label: "Repeindre en crème", qty: null, qty_unit: null },
    ]);
    expect(plan).toContain("RESTYLE");
    expect(plan).toContain("Repeindre en crème");
  });

  // 2026-07-10 : les KEEP ne sont plus SILENCIEUX (flux standard ET beta). Muets, ils
  // étaient systématiquement violés — canapés « à conserver » recolorés par le rendu
  // (projet i1d6E1vlTmNgb2G3ekk9X). Ils sortent désormais en UNE ligne compacte.
  it("les 'keep' (none) sortent en ligne KEEP explicite, pas en silence", () => {
    const plan = formatDesignPlan([
      { category: "sofa", description: "Canapé", mismatch_type: "none", action_label: null, qty: null, qty_unit: null },
    ]);
    expect(plan).toContain("KEEP strictly unchanged");
    expect(plan).toContain("Canapé");
    expect(plan).not.toContain("REPLACE");
  });

  it("beta : les RESTYLE de descriptions différentes restent des lignes séparées (le groupage ×2 dégrade la conformité — banc 2026-07-07)", () => {
    const decisions = [
      { category: "bookshelf", description: "Bibliothèque sombre mur gauche", mismatch_type: "surface" as const, action_slug: "repaint", action_label: "Repeindre en blanc cassé", qty: 2, qty_unit: "L" },
      { category: "bookshelf", description: "Bibliothèque sombre près de la fenêtre", mismatch_type: "surface" as const, action_slug: "repaint", action_label: "Repeindre en blanc cassé", qty: 1, qty_unit: "L" },
    ];
    expect(formatDesignPlan(decisions).split("\n")).toHaveLength(2);
    expect(formatDesignPlan(decisions, { renderableSlugs: new Set(["repaint"]) }).split("\n")).toHaveLength(2);
  });

  it("beta : surface non renderable → dégradée en REPLACE image", () => {
    const plan = formatDesignPlan(
      [{ category: "sofa", description: "Canapé beige", mismatch_type: "surface", action_slug: "slipcover_seat", action_label: "Housse écrue", qty: null, qty_unit: null }],
      { renderableSlugs: new Set(["repaint"]) },
    );
    expect(plan).toContain("REPLACE");
    expect(plan).not.toContain("RESTYLE");
  });

  it("beta : surface SANS action (override user) → RESTYLE générique, jamais REPLACE (bug vLkE2sZ5)", () => {
    const plan = formatDesignPlan(
      [{ category: "dining_table", description: "Table à manger en bois", mismatch_type: "surface", action_slug: null, action_label: null, qty: null, qty_unit: null }],
      { renderableSlugs: new Set(["repaint"]) },
    );
    expect(plan).toContain("RESTYLE");
    expect(plan).not.toContain("REPLACE");
  });

  it("beta : la petite déco à remplacer est groupée en 1 ligne récapitulative (standard : inchangé)", () => {
    const decisions = [
      { category: "decor_object", description: "Vase blanc", mismatch_type: "structural" as const, action_slug: null, action_label: null, qty: null, qty_unit: null },
      { category: "decor_object", description: "Bol blanc", mismatch_type: "structural" as const, action_slug: null, action_label: null, qty: null, qty_unit: null },
      { category: "frame", description: "Cadre abstrait", mismatch_type: "structural" as const, action_slug: null, action_label: null, qty: null, qty_unit: null },
      { category: "sofa", description: "Canapé crème", mismatch_type: "structural" as const, action_slug: null, action_label: null, qty: null, qty_unit: null },
    ];
    const beta = formatDesignPlan(decisions, { renderableSlugs: new Set() });
    const lines = beta.split("\n");
    expect(lines).toHaveLength(2); // canapé + groupe déco
    // Remaster 2026-07-10 : la petite déco hors style est RETIRÉE (pas remplacée
    // pièce à pièce, ce qui créait du patchwork) — le test suivait l'ancien libellé.
    expect(beta).toContain("REMOVE the small decor");
    expect(beta).toContain("3 items");
    expect(beta).toContain("Vase blanc");
    // Standard : pas de groupage déco
    expect(formatDesignPlan(decisions).split("\n")).toHaveLength(4);
  });

  it("beta : murs partageant le même label → 1 ligne « the walls » ; REPLACE compact avec « identical »", () => {
    const decisions = [
      { category: "wall", description: "Mur vert sauge", mismatch_type: "surface" as const, action_slug: "repaint", action_label: "Repeindre en bleu encre", qty: 30, qty_unit: "L" },
      { category: "wall", description: "Mur blanc cassé", mismatch_type: "surface" as const, action_slug: "repaint", action_label: "Repeindre en bleu encre", qty: 25, qty_unit: "L" },
      { category: "chair", description: "Chaise beige", mismatch_type: "structural" as const, action_slug: null, action_label: null, qty: null, qty_unit: null },
      { category: "chair", description: "Chaise beige", mismatch_type: "structural" as const, action_slug: null, action_label: null, qty: null, qty_unit: null },
    ];
    const beta = formatDesignPlan(decisions, { renderableSlugs: new Set(["repaint"]) });
    const lines = beta.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines.find((l) => l.includes("the walls"))).toContain("RESTYLE");
    // Cible REPLACE par catégorie (plus de description de l'original)
    const chairs = lines.find((l) => l.includes("chair"));
    expect(chairs).toContain("all 2 identical");
    expect(chairs).toContain("Never the original recolored");
  });

  it("beta : le label ANGLAIS prime dans le plan (fallback FR) ; standard : FR", () => {
    const decisions = [
      { category: "dining_table", description: "Table bois clair", mismatch_type: "surface" as const, action_slug: "stain_wood", action_label: "Teinter le bois en espresso", action_label_en: "Stain the wood dark espresso", qty: null, qty_unit: null },
    ];
    const beta = formatDesignPlan(decisions, { renderableSlugs: new Set(["stain_wood"]) });
    expect(beta).toContain("Stain the wood dark espresso");
    expect(beta).not.toContain("Teinter");
    const standard = formatDesignPlan(decisions);
    expect(standard).toContain("Teinter le bois en espresso");
  });

  it("beta : mur/sol/plafond → toujours RESTYLE, même avec action non renderable", () => {
    const plan = formatDesignPlan(
      [
        { category: "wall", description: "Mur ocre", mismatch_type: "surface", action_slug: "wallpaper", action_label: "Papier peint géométrique", qty: null, qty_unit: null },
        { category: "ceiling", description: "Plafond blanc", mismatch_type: "surface", action_slug: null, action_label: null, qty: null, qty_unit: null },
        { category: "floor", description: "Parquet gris", mismatch_type: "surface", action_slug: "paint_floor", action_label: "Peindre le sol", qty: null, qty_unit: null },
      ],
      { renderableSlugs: new Set(["repaint", "paint_floor"]) },
    );
    const lines = plan.split("\n");
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(line).toContain("RESTYLE");
      expect(line).not.toContain("REPLACE");
    }
  });
});

describe("buildColorwayDirective", () => {
  const colorways: StyleColorway[] = [
    { slug: "blond", label: "Blond classique", walls: "warm white walls", accents: "cream accents" },
    { slug: "sauge", label: "Sauge", walls: "repaint the walls in a muted sage green", accents: "sage and olive textile accents" },
    { slug: "terre", label: "Terre", accents: "muted terracotta accents" },
  ];

  it("index 0 = déclinaison par défaut → aucune ligne", () => {
    expect(buildColorwayDirective(colorways, { colorwayIndex: 0 })).toEqual({ part: "" });
    expect(buildColorwayDirective(colorways)).toEqual({ part: "" });
  });

  it("style sans colorways → aucune ligne, quel que soit l'index", () => {
    expect(buildColorwayDirective([], { colorwayIndex: 2 })).toEqual({ part: "" });
  });

  it("index 1 → murs + accents de la déclinaison", () => {
    const { part, slug } = buildColorwayDirective(colorways, { colorwayIndex: 1 });
    expect(slug).toBe("sauge");
    expect(part).toContain("muted sage green");
    expect(part).toContain("sage and olive textile accents");
    expect(part).toContain("same materials and furniture shapes");
  });

  it("la rotation boucle (modulo) et retombe sur le défaut", () => {
    expect(buildColorwayDirective(colorways, { colorwayIndex: 3 })).toEqual({ part: "" }); // 3 % 3 = 0
    expect(buildColorwayDirective(colorways, { colorwayIndex: 4 }).slug).toBe("sauge");
  });

  it("lockWalls retire la consigne murs mais garde les accents", () => {
    const { part } = buildColorwayDirective(colorways, { colorwayIndex: 1, lockWalls: true });
    expect(part).not.toContain("sage green");
    expect(part).toContain("sage and olive textile accents");
  });

  it("déclinaison sans murs (accents seuls) fonctionne", () => {
    const { part, slug } = buildColorwayDirective(colorways, { colorwayIndex: 2 });
    expect(slug).toBe("terre");
    expect(part).toContain("terracotta");
  });
});
