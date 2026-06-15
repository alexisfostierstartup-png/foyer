import { describe, it, expect } from "vitest";
import { reconcilePlan } from "../reconcile";
import type { ElementDecision } from "@/lib/diy/types";
import type { ApplicationAuditResult } from "../types";

function makeDecision(overrides: Partial<ElementDecision> = {}): ElementDecision {
  return {
    element_id: "e1",
    description: "Canapé beige",
    category: "sofa",
    mismatch_type: "none",
    action_slug: null,
    action_label: null,
    qty: null,
    qty_unit: null,
    supply_items: null,
    override: false,
    ...overrides,
  };
}

function makeAudit(elements: ApplicationAuditResult["elements"] = []): ApplicationAuditResult {
  return { elements };
}

describe("reconcilePlan — keep decisions", () => {
  it("keep + element_preserved=true → kept", () => {
    const decisions = [makeDecision({ element_id: "e1", mismatch_type: "none" })];
    const audit = makeAudit([
      { element_id: "e1", expected: "canapé beige intact", checks: [], element_preserved: true, notes: "" },
    ]);
    const plan = reconcilePlan(decisions, audit, { repairAlreadyUsed: false });
    expect(plan.kept).toHaveLength(1);
    expect(plan.repairQueue).toHaveLength(0);
    expect(plan.dropList).toHaveLength(0);
  });

  it("keep + no audit entry → kept (conservative)", () => {
    const decisions = [makeDecision({ element_id: "e1", mismatch_type: "none" })];
    const plan = reconcilePlan(decisions, makeAudit([]), { repairAlreadyUsed: false });
    expect(plan.kept).toHaveLength(1);
  });

  it("keep + element_preserved=false → repairQueue with priority=keep", () => {
    const decisions = [makeDecision({ element_id: "e2", mismatch_type: "none" })];
    const audit = makeAudit([
      { element_id: "e2", expected: "canapé original préservé", checks: [], element_preserved: false, notes: "replaced" },
    ]);
    const plan = reconcilePlan(decisions, audit, { repairAlreadyUsed: false });
    expect(plan.repairQueue).toHaveLength(1);
    expect(plan.repairQueue[0].priority).toBe("keep");
    expect(plan.repairQueue[0].element_id).toBe("e2");
    expect(plan.kept).toHaveLength(0);
  });

  it("keep + element_preserved=false + repairAlreadyUsed → dropList budget_exceeded", () => {
    const decisions = [makeDecision({ element_id: "e2", mismatch_type: "none" })];
    const audit = makeAudit([
      { element_id: "e2", expected: "canapé original", checks: [], element_preserved: false, notes: "" },
    ]);
    const plan = reconcilePlan(decisions, audit, { repairAlreadyUsed: true });
    expect(plan.dropList).toHaveLength(1);
    expect(plan.dropList[0].reason).toBe("budget_exceeded");
    expect(plan.repairBudgetExceeded).toBe(true);
    expect(plan.repairQueue).toHaveLength(0);
  });
});

describe("reconcilePlan — customize decisions", () => {
  it("customize + applied=true → applied with supplies", () => {
    const decisions = [
      makeDecision({
        element_id: "e3",
        mismatch_type: "surface",
        action_slug: "repaint",
        action_label: "Repeindre",
        supply_items: [{ name: "Peinture", qty: 2, unit: "L" }],
      }),
    ];
    const audit = makeAudit([
      {
        element_id: "e3",
        expected: "murs repeints en bleu",
        checks: [{ action_slug: "repaint", applied: true, confidence: 0.9 }],
        element_preserved: true,
        notes: "",
      },
    ]);
    const plan = reconcilePlan(decisions, audit, { repairAlreadyUsed: false });
    expect(plan.applied).toHaveLength(1);
    expect(plan.applied[0].supply_items).toHaveLength(1);
    expect(plan.repairQueue).toHaveLength(0);
  });

  it("customize + no audit entry → applied (conservative)", () => {
    const decisions = [
      makeDecision({ element_id: "e3", mismatch_type: "surface", action_slug: "repaint", action_label: "Repeindre" }),
    ];
    const plan = reconcilePlan(decisions, makeAudit([]), { repairAlreadyUsed: false });
    expect(plan.applied).toHaveLength(1);
  });

  it("customize + applied=false confidence=0.85 → repairQueue when budget available", () => {
    const decisions = [
      makeDecision({ element_id: "e4", mismatch_type: "surface", action_slug: "repaint", action_label: "Repeindre" }),
    ];
    const audit = makeAudit([
      {
        element_id: "e4",
        expected: "murs repeints",
        checks: [{ action_slug: "repaint", applied: false, confidence: 0.85 }],
        element_preserved: true,
        notes: "",
      },
    ]);
    const plan = reconcilePlan(decisions, audit, { repairAlreadyUsed: false });
    expect(plan.repairQueue).toHaveLength(1);
    expect(plan.repairQueue[0].priority).toBe("customize");
    expect(plan.applied).toHaveLength(0);
  });

  it("customize + applied=false confidence=0.85 + repairAlreadyUsed → dropList", () => {
    const decisions = [
      makeDecision({ element_id: "e4", mismatch_type: "surface", action_slug: "repaint", action_label: "Repeindre" }),
    ];
    const audit = makeAudit([
      {
        element_id: "e4",
        expected: "murs repeints",
        checks: [{ action_slug: "repaint", applied: false, confidence: 0.85 }],
        element_preserved: true,
        notes: "",
      },
    ]);
    const plan = reconcilePlan(decisions, audit, { repairAlreadyUsed: true });
    expect(plan.dropList).toHaveLength(1);
    expect(plan.dropList[0].reason).toBe("budget_exceeded");
    expect(plan.repairBudgetExceeded).toBe(true);
    expect(plan.repairQueue).toHaveLength(0);
  });

  it("customize + applied=false confidence=0.4 (low) → applied (uncertain)", () => {
    const decisions = [
      makeDecision({
        element_id: "e5",
        mismatch_type: "surface",
        action_slug: "stain_wood",
        action_label: "Teindre",
        supply_items: [{ name: "Teinture", qty: 1, unit: "L" }],
      }),
    ];
    const audit = makeAudit([
      {
        element_id: "e5",
        expected: "parquet teinté foncé",
        checks: [{ action_slug: "stain_wood", applied: false, confidence: 0.4 }],
        element_preserved: true,
        notes: "",
      },
    ]);
    const plan = reconcilePlan(decisions, audit, { repairAlreadyUsed: false });
    expect(plan.applied).toHaveLength(1);
    expect(plan.repairQueue).toHaveLength(0);
  });
});

describe("reconcilePlan — structural decisions", () => {
  it("structural → toReplace, no audit needed", () => {
    const decisions = [makeDecision({ element_id: "e6", mismatch_type: "structural" })];
    const plan = reconcilePlan(decisions, makeAudit([]), { repairAlreadyUsed: false });
    expect(plan.toReplace).toHaveLength(1);
    expect(plan.kept).toHaveLength(0);
    expect(plan.repairQueue).toHaveLength(0);
    expect(plan.applied).toHaveLength(0);
  });
});

describe("reconcilePlan — mixed scenarios", () => {
  it("mixed decisions produce correct buckets", () => {
    const decisions: ElementDecision[] = [
      makeDecision({ element_id: "keep-ok",  mismatch_type: "none" }),
      makeDecision({ element_id: "keep-bad", mismatch_type: "none" }),
      makeDecision({ element_id: "apply-ok", mismatch_type: "surface", action_slug: "repaint", action_label: "Repeindre" }),
      makeDecision({ element_id: "replace",  mismatch_type: "structural" }),
    ];
    const audit = makeAudit([
      { element_id: "keep-ok",  expected: "ok",   checks: [], element_preserved: true,  notes: "" },
      { element_id: "keep-bad", expected: "fail", checks: [], element_preserved: false, notes: "" },
      { element_id: "apply-ok", expected: "done", checks: [{ action_slug: "repaint", applied: true, confidence: 0.9 }], element_preserved: true, notes: "" },
    ]);
    const plan = reconcilePlan(decisions, audit, { repairAlreadyUsed: false });
    expect(plan.kept).toHaveLength(1);
    expect(plan.kept[0].element_id).toBe("keep-ok");
    expect(plan.repairQueue).toHaveLength(1);
    expect(plan.repairQueue[0].element_id).toBe("keep-bad");
    expect(plan.applied).toHaveLength(1);
    expect(plan.applied[0].element_id).toBe("apply-ok");
    expect(plan.toReplace).toHaveLength(1);
    expect(plan.toReplace[0].element_id).toBe("replace");
  });
});
