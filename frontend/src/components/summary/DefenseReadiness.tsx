// This file is a good reference for how every component in src/components/summary
// is built - read it once and the pattern repeats everywhere else.
//
// - interface: a named contract describing the shape an object must have.
//   DefenseReadinessProps below says "whoever renders <DefenseReadiness />
//   must pass a `percent`, `checkpointsDone` and `checkpointsTotal`, all
//   numbers, nothing more, nothing less".
// - Props destructuring: `function DefenseReadiness({ percent, ... }: ...)`
//   pulls each field straight out of the single props object React passes
//   in, instead of writing `props.percent` everywhere below. Standard React
//   style, used in every component here.
// - Data flow: this component owns no data of its own. Everything it renders
//   is handed down as props by the parent (routes/.../summary.tsx), which is
//   the only place holding the real data (mock today, an API response
//   later). That's why nothing here does any fetching - it just displays
//   what it's given.
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
  // percent is uncapped (can exceed 100, up to
  // EVALUATION_CHECKLIST_READINESS_THRESHOLD.EXTRA_READY = 150), same as the
  // checklist page's own "Overall progress" - Bonus/Supplemental push it
  // past 100 once Mandatory (then Bonus) is fully checked off.
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
        className="h-2 w-full rounded-full bg-surface-overlay"
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
      </div>
      <p className="mt-2 text-xs text-text-secondary">
        {checkpointsDone}/{checkpointsTotal} checkpoints
      </p>
    </section>
  );
}
