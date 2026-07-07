import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase before importing rules
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdmin: vi.fn(),
}));

import { filterCandidateActions, getCandidateActions } from "../rules";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { DiyAction, ElementProfile } from "../types";

const mockActions: DiyAction[] = [
  {
    id: "1",
    slug: "repaint",
    label: "Repeindre",
    label_en: "Repaint",
    applies_to_categories: ["wall", "furniture", "door"],
    requires: { material_family: ["wood", "metal", "paint"] },
    excludes: { material_family: ["stone", "glass", "fabric"] },
    qty_formula: "area_m2",
    qty_unit: "L",
    style_affinity: { doux: 0.9, brut: 0.6, "bois-clair": 0.7 },
    supplies_template: null,
    is_active: true,
    level: 1,
    renderable: true,
    beta: false,
    beta_categories: [],
  },
  {
    id: "2",
    slug: "wallpaper",
    label: "Poser du papier peint",
    label_en: "Apply wallpaper",
    applies_to_categories: ["wall"],
    requires: {},
    excludes: { material_family: ["stone", "glass", "fabric"] },
    qty_formula: "area_m2 * 1.1",
    qty_unit: "m²",
    style_affinity: { doux: 0.85, brut: 0.2, "bois-clair": 0.4 },
    supplies_template: null,
    is_active: true,
    level: 1,
    renderable: true,
    beta: false,
    beta_categories: [],
  },
  {
    id: "3",
    slug: "reupholster",
    label: "Retapisser",
    label_en: "Reupholster",
    applies_to_categories: ["sofa", "armchair", "chair"],
    requires: { material_family: ["fabric", "leather"] },
    excludes: {},
    qty_formula: "area_m2 * 1.15",
    qty_unit: "m²",
    style_affinity: { doux: 0.9, brut: 0.3, "bois-clair": 0.5 },
    supplies_template: null,
    is_active: true,
    level: 3,
    renderable: false,
    beta: false,
    beta_categories: [],
  },
];

function makeMockSupabase(actions: DiyAction[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    contains: vi.fn().mockResolvedValue({ data: actions, error: null }),
  };
  return { from: vi.fn().mockReturnValue(chain) };
}

const wallProfile: ElementProfile = {
  element_id: "wall_1",
  element: "wall",
  category: "wall",
  description: "Mur peint en blanc",
  material_family: "paint",
  surface_features: ["painted", "matte"],
  condition: "good",
  movable: false,
  dims: { area_m2: 12, length_m: 3 },
};

const stoneWallProfile: ElementProfile = {
  ...wallProfile,
  element_id: "wall_2",
  material_family: "stone",
};

const sofaProfile: ElementProfile = {
  element_id: "sofa_1",
  element: "sofa",
  category: "sofa",
  description: "Canapé en tissu gris",
  material_family: "fabric",
  surface_features: ["upholstered"],
  condition: "fair",
  movable: true,
  dims: { area_m2: 2, width_cm: 220 },
};

beforeEach(() => {
  vi.mocked(createSupabaseAdmin).mockReturnValue(makeMockSupabase(mockActions) as never);
});

describe("getCandidateActions", () => {
  it("returns actions matching the element category", async () => {
    const wallActions = mockActions.filter((a) =>
      a.applies_to_categories.includes("wall"),
    );
    vi.mocked(createSupabaseAdmin).mockReturnValue(
      makeMockSupabase(wallActions) as never,
    );

    const result = await getCandidateActions(wallProfile, "doux");
    expect(result.length).toBeGreaterThan(0);
    result.forEach((a) => {
      expect(a.applies_to_categories).toContain("wall");
    });
  });

  it("filters out actions excluded by material_family", async () => {
    const wallActions = mockActions.filter((a) =>
      a.applies_to_categories.includes("wall"),
    );
    vi.mocked(createSupabaseAdmin).mockReturnValue(
      makeMockSupabase(wallActions) as never,
    );

    const result = await getCandidateActions(stoneWallProfile, "doux");
    result.forEach((a) => {
      const excludedFamilies = a.excludes.material_family ?? [];
      expect(excludedFamilies).not.toContain("stone");
    });
  });

  it("filters out actions requiring a material_family the element doesn't have", async () => {
    const wallActions = mockActions.filter((a) =>
      a.applies_to_categories.includes("wall"),
    );
    const woodOnlyAction: DiyAction = {
      ...mockActions[0],
      id: "4",
      slug: "stain_wood",
      requires: { material_family: ["wood"] },
    };
    vi.mocked(createSupabaseAdmin).mockReturnValue(
      makeMockSupabase([...wallActions, woodOnlyAction]) as never,
    );

    const result = await getCandidateActions(wallProfile, "doux");
    expect(result.find((a) => a.slug === "stain_wood")).toBeUndefined();
  });

  it("sorts by style_affinity descending for the given styleId", async () => {
    const wallActions = mockActions.filter((a) =>
      a.applies_to_categories.includes("wall"),
    );
    vi.mocked(createSupabaseAdmin).mockReturnValue(
      makeMockSupabase(wallActions) as never,
    );

    const result = await getCandidateActions(wallProfile, "doux");
    for (let i = 1; i < result.length; i++) {
      const prev = (result[i - 1].style_affinity["doux"] ?? 0) as number;
      const curr = (result[i].style_affinity["doux"] ?? 0) as number;
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  it("returns at most 10 results", async () => {
    const manyActions = Array.from({ length: 15 }, (_, i) => ({
      ...mockActions[0],
      id: String(i),
      slug: `action_${i}`,
    }));
    vi.mocked(createSupabaseAdmin).mockReturnValue(
      makeMockSupabase(manyActions) as never,
    );

    const result = await getCandidateActions(wallProfile, "doux");
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("returns empty array when no actions match requires", async () => {
    vi.mocked(createSupabaseAdmin).mockReturnValue(
      makeMockSupabase([mockActions[2]]) as never,
    );

    const result = await getCandidateActions(wallProfile, "doux");
    expect(result).toHaveLength(0);
  });

  it("returns empty array on DB error", async () => {
    const errorChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      contains: vi.fn().mockResolvedValue({ data: null, error: new Error("DB error") }),
    };
    vi.mocked(createSupabaseAdmin).mockReturnValue({ from: vi.fn().mockReturnValue(errorChain) } as never);

    const result = await getCandidateActions(sofaProfile, "doux");
    expect(result).toHaveLength(0);
  });
});

describe("filterCandidateActions — mode DIY beta", () => {
  const betaAction: DiyAction = {
    ...mockActions[0],
    id: "10",
    slug: "slat_wall",
    applies_to_categories: ["wall"],
    requires: {},
    excludes: {},
    is_active: false,
    beta: true,
    level: 1,
    style_affinity: { japandi: 0.9, memphis: -1 },
    beta_categories: [],
  };
  const levelTwoAction: DiyAction = {
    ...betaAction,
    id: "11",
    slug: "fresco_wall",
    level: 2,
    style_affinity: {},
  };
  const withBetaCats: DiyAction = {
    ...mockActions[0],
    id: "12",
    slug: "repaint",
    applies_to_categories: ["wall"],
    beta_categories: ["sideboard"],
    requires: {},
    excludes: {},
    style_affinity: {},
  };
  const sideboardProfile: ElementProfile = {
    ...wallProfile,
    element_id: "sideboard_1",
    category: "sideboard",
    material_family: "wood",
  };

  it("standard : ignore beta_categories (candidats inchangés)", () => {
    const res = filterCandidateActions([withBetaCats], sideboardProfile, "japandi");
    expect(res).toHaveLength(0);
  });

  it("beta : merge beta_categories dans le match catégorie", () => {
    const res = filterCandidateActions([withBetaCats], sideboardProfile, "japandi", { mode: "beta" });
    expect(res.map((a) => a.slug)).toContain("repaint");
  });

  it("beta : filtre level ≤ maxLevel (défaut néophyte = 1)", () => {
    const res = filterCandidateActions([betaAction, levelTwoAction], wallProfile, "japandi", { mode: "beta" });
    expect(res.map((a) => a.slug)).toEqual(["slat_wall"]);
    const res2 = filterCandidateActions([betaAction, levelTwoAction], wallProfile, "japandi", { mode: "beta", maxLevel: 2 });
    expect(res2.map((a) => a.slug).sort()).toEqual(["fresco_wall", "slat_wall"]);
  });

  it("beta : affinité négative = exclusion dure pour ce style", () => {
    const japandi = filterCandidateActions([betaAction], wallProfile, "japandi", { mode: "beta" });
    expect(japandi).toHaveLength(1);
    const memphis = filterCandidateActions([betaAction], wallProfile, "memphis", { mode: "beta" });
    expect(memphis).toHaveLength(0);
  });

  it("standard : l'affinité négative ne filtre PAS (tri seulement)", () => {
    const res = filterCandidateActions([betaAction], wallProfile, "memphis");
    expect(res).toHaveLength(1);
  });

  it("standard : le level ne filtre PAS", () => {
    const res = filterCandidateActions([levelTwoAction], wallProfile, "japandi");
    expect(res).toHaveLength(1);
  });
});
