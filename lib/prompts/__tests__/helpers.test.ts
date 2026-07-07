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
  it("regroupe les identiques en une ligne ×N", () => {
    const plan = formatDesignPlan([chair(1), chair(2), chair(3), chair(4)]);
    const lines = plan.split("\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("×4");
    expect(lines[0]).toContain("the 4");
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

  it("ignore les 'keep' (none)", () => {
    const plan = formatDesignPlan([
      { category: "sofa", description: "Canapé", mismatch_type: "none", action_label: null, qty: null, qty_unit: null },
    ]);
    expect(plan).toBe("");
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
