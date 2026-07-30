import type {
  EvaluationChecklistItem,
  EvaluationChecklistSection,
} from "@/lib/evaluationChecklist";

// Pure calculation, no network/validation here - see evaluationChecklist.ts
// for the fetch/parse layer this reads its input from. Shared by the
// evaluation-checklist page and the Summary tab's DefenseReadiness widget so
// both always agree on what "ready" means.
//
// Mandatory alone carries the first 100 points (READY). Bonus and
// Supplemental each unlock CATEGORY_WEIGHT further points once the previous
// section is fully done, topping the score out at EXTRA_READY.
export const EVALUATION_CHECKLIST_CATEGORY_WEIGHT = 25;
export const EVALUATION_CHECKLIST_READINESS_THRESHOLD = {
  READY: 100,
  SUPER_READY: 125,
  EXTRA_READY: 150,
} as const;

export interface EvaluationChecklistProgress {
  // gated: Bonus items only join currentValue/completeAt once Mandatory is
  // 100%, Supplemental only once Bonus is also 100% - same gating as percent
  currentValue: number;
  completeAt: number;
  // uncapped, can go up to EXTRA_READY (150) - unlike the backend's
  // computeProjectProgress, which caps at 100 for the /projects card
  percent: number;
}

// Plain (non-gated) completion percent for a single section - 0 when the
// section has no items.
function sectionPercent(items: EvaluationChecklistItem[]): number {
  return items.length === 0
    ? 0
    : Math.round(
        (items.filter((item) => item.isChecked).length / items.length) * 100
      );
}

export function computeEvaluationChecklistProgress(
  items: EvaluationChecklistItem[]
): EvaluationChecklistProgress {
  const mandatoryItems = items.filter((item) => item.section === "MANDATORY");
  const bonusItems = items.filter((item) => item.section === "BONUS");
  const supplementalItems = items.filter(
    (item) => item.section === "SUPPLEMENTAL"
  );

  const mandatoryPercent = sectionPercent(mandatoryItems);
  const bonusPercent = sectionPercent(bonusItems);
  const supplementalPercent = sectionPercent(supplementalItems);
  const mandatoryComplete =
    mandatoryPercent >= EVALUATION_CHECKLIST_READINESS_THRESHOLD.READY;
  const bonusComplete =
    bonusPercent >= EVALUATION_CHECKLIST_READINESS_THRESHOLD.READY;

  const progress = {
    currentValue: mandatoryItems.filter((item) => item.isChecked).length,
    completeAt: mandatoryItems.length,
    percent: mandatoryPercent,
  };

  if (mandatoryComplete) {
    progress.currentValue += bonusItems.filter((item) => item.isChecked).length;
    progress.completeAt += bonusItems.length;
    progress.percent +=
      (bonusPercent / 100) * EVALUATION_CHECKLIST_CATEGORY_WEIGHT;

    if (bonusComplete) {
      progress.currentValue += supplementalItems.filter(
        (item) => item.isChecked
      ).length;
      progress.completeAt += supplementalItems.length;
      progress.percent +=
        (supplementalPercent / 100) * EVALUATION_CHECKLIST_CATEGORY_WEIGHT;
    }
  }

  progress.percent = Math.round(progress.percent);
  return progress;
}

// Which section's color the overall bar/badge should currently borrow -
// same >100/>125 tiers as the checklist page's overallBarBg/readinessColor.
export function getEvaluationChecklistReadinessTier(
  percent: number
): EvaluationChecklistSection {
  if (percent > EVALUATION_CHECKLIST_READINESS_THRESHOLD.SUPER_READY) {
    return "SUPPLEMENTAL";
  }
  if (percent > EVALUATION_CHECKLIST_READINESS_THRESHOLD.READY) {
    return "BONUS";
  }
  return "MANDATORY";
}
