import { describe, it, expect } from "vitest";
import { formatDesignPlan } from "../helpers";

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
