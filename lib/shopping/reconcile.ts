import type { ElementDecision } from "@/lib/diy/types";
import type {
  ApplicationAuditResult,
  AuditElementResult,
  AppliedItem,
  DroppedItem,
  RepairItem,
  ReconciledPlan,
} from "./types";

type ReconcileOptions = {
  repairAlreadyUsed: boolean;
};

export function reconcilePlan(
  decisions: ElementDecision[],
  audit: ApplicationAuditResult,
  options: ReconcileOptions,
): ReconciledPlan {
  const kept: ElementDecision[] = [];
  const applied: AppliedItem[] = [];
  const toReplace: ElementDecision[] = [];
  const repairQueue: RepairItem[] = [];
  const dropList: DroppedItem[] = [];
  let repairBudgetExceeded = false;

  const auditMap = new Map<string, AuditElementResult>(
    audit.elements.map((e) => [e.element_id, e]),
  );

  // Remaster déco 2026-07-10 : la petite déco non alignée est RETIRÉE du rendu
  // (discard) — jamais shoppée.
  const DECOR_DISCARD = new Set(["decor_object", "frame", "mirror", "plant", "cushion"]);

  for (const d of decisions) {
    if (d.mismatch_type === "structural") {
      if (DECOR_DISCARD.has(d.category)) {
        dropList.push({
          element_id: d.element_id, description: d.description,
          action_slug: null, action_label: null, reason: "decor_discarded",
        });
        continue;
      }
      // Le rendu a GARDÉ l'original malgré le REPLACE (audit : élément préservé)
      // → pas de ligne shopping incohérente avec l'image (pendant/miroir gardés
      // mais shoppés, projet TvrnYMMy 2026-07-10).
      const aud = auditMap.get(d.element_id);
      if (aud?.element_preserved) {
        dropList.push({
          element_id: d.element_id, description: d.description,
          action_slug: null, action_label: null, reason: "kept_in_render",
        });
        continue;
      }
      toReplace.push(d);
      continue;
    }

    const a = auditMap.get(d.element_id);

    // ── Keep (none) ───────────────────────────────────────────────────────────
    if (d.mismatch_type === "none") {
      if (!a || a.element_preserved) {
        kept.push(d);
      } else {
        // Element was modified despite keep decision → needs repair
        if (options.repairAlreadyUsed) {
          repairBudgetExceeded = true;
          dropList.push({
            element_id: d.element_id,
            description: d.description,
            action_slug: null,
            action_label: null,
            reason: "budget_exceeded",
          });
        } else {
          repairQueue.push({
            element_id: d.element_id,
            description: d.description,
            category: d.category,
            action_slug: null,
            target_state: a.expected || d.description,
            priority: "keep",
          });
        }
      }
      continue;
    }

    // ── Customize (surface) ───────────────────────────────────────────────────
    const check = a?.checks.find((c) => c.action_slug === d.action_slug);
    const highConfidenceMissing = check && !check.applied && check.confidence > 0.6;

    if (!highConfidenceMissing) {
      // Applied (or no evidence it's missing) → keep supplies
      if (d.action_slug) {
        applied.push({
          element_id: d.element_id,
          description: d.description,
          category: d.category,
          action_slug: d.action_slug,
          action_label: d.action_label ?? "",
          supply_items: d.supply_items ?? [],
          qty: d.qty,
          qty_unit: d.qty_unit,
        });
      }
    } else {
      // High-confidence missing → repair or drop
      if (options.repairAlreadyUsed) {
        repairBudgetExceeded = true;
        dropList.push({
          element_id: d.element_id,
          description: d.description,
          action_slug: d.action_slug,
          action_label: d.action_label,
          reason: "budget_exceeded",
        });
      } else {
        repairQueue.push({
          element_id: d.element_id,
          description: d.description,
          category: d.category,
          action_slug: d.action_slug,
          target_state: a?.expected || `${d.action_label ?? d.action_slug} sur ${d.description}`,
          priority: "customize",
        });
      }
    }
  }

  return { kept, applied, toReplace, repairQueue, dropList, repairBudgetExceeded };
}
