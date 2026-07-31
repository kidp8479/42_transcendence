// Reference for the pattern every component in this folder follows: props
// interface, destructured in the signature, no fetching - the parent
// (routes/.../summary.tsx) owns the data and passes it down.
import {
  EVALUATION_CHECKLIST_READINESS_THRESHOLD,
  getEvaluationChecklistReadinessTier,
} from "@/lib/evaluationChecklistProgress";

// Same three colors as the checklist page's CATEGORY_STYLE (Mandatory/Bonus/
// Supplemental) - not imported from there since that page's CATEGORY_STYLE
// carries a lot more (icons, hover states) this widget doesn't need.
const READINESS_TIER_BAR_COLOR = {
  MANDATORY: "bg-brand-500",
  BONUS: "bg-status-in-progress",
  SUPPLEMENTAL: "bg-status-review",
} as const;
const READINESS_TIER_TEXT_COLOR = {
  MANDATORY: "text-brand-500",
  BONUS: "text-status-in-progress",
  SUPPLEMENTAL: "text-status-review",
} as const;

interface DefenseReadinessProps {
  // Uncapped, up to EXTRA_READY (150), same as the checklist page's Overall
  // progress bar. Bonus/Supplemental push it past 100.
  percent: number;
  checkpointsDone: number;
  checkpointsTotal: number;
}

export function DefenseReadiness({
  percent,
  checkpointsDone,
  checkpointsTotal,
}: DefenseReadinessProps) {
  const tier = getEvaluationChecklistReadinessTier(percent);
  const barColor = READINESS_TIER_BAR_COLOR[tier];
  const textColor = READINESS_TIER_TEXT_COLOR[tier];

  return (
    <section
      aria-labelledby="defense-readiness-heading"
      className="rounded-lg border border-surface-border bg-surface-raised p-4"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2
          id="defense-readiness-heading"
          className="font-mono text-base font-semibold text-text-primary"
        >
          Defense Readiness
        </h2>
        <span className={`text-sm font-bold ${textColor}`}>{percent}%</span>
      </div>
      <div
        className="relative h-2 w-full rounded-full bg-surface-overlay"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={EVALUATION_CHECKLIST_READINESS_THRESHOLD.EXTRA_READY}
        aria-labelledby="defense-readiness-heading"
      >
        <div
          className={`h-2 rounded-full transition-colors ${barColor}`}
          style={{
            width: `${Math.min((percent / EVALUATION_CHECKLIST_READINESS_THRESHOLD.EXTRA_READY) * 100, 100)}%`,
          }}
        />
        {/* Same 100/125% tick marks as the checklist page's own "Overall
        progress" bar, so filling past the visual "end" here reads as the
        same gated-progress pattern instead of a bug. */}
        {[
          EVALUATION_CHECKLIST_READINESS_THRESHOLD.READY,
          EVALUATION_CHECKLIST_READINESS_THRESHOLD.SUPER_READY,
        ].map((threshold) => (
          <div
            key={threshold}
            className="absolute top-1/2 h-2.5 w-px -translate-x-1/2 -translate-y-1/2 bg-text-muted/60"
            style={{
              left: `${(threshold / EVALUATION_CHECKLIST_READINESS_THRESHOLD.EXTRA_READY) * 100}%`,
            }}
          />
        ))}
      </div>
      <div className="relative mt-2 flex items-center justify-between text-xs text-text-muted">
        {[
          EVALUATION_CHECKLIST_READINESS_THRESHOLD.READY,
          EVALUATION_CHECKLIST_READINESS_THRESHOLD.SUPER_READY,
          EVALUATION_CHECKLIST_READINESS_THRESHOLD.EXTRA_READY,
        ].map((threshold) => (
          <span
            key={threshold}
            className="absolute -translate-x-1/2 text-text-muted/70"
            style={{
              left: `${(threshold / EVALUATION_CHECKLIST_READINESS_THRESHOLD.EXTRA_READY) * 100}%`,
            }}
          >
            {threshold}%
          </span>
        ))}
      </div>
      <p className="mt-5 text-xs text-text-secondary">
        {checkpointsDone}/{checkpointsTotal} checkpoints
      </p>
    </section>
  );
}
