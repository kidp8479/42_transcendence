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
interface DefenseReadinessProps {
  percent: number;
  checkpointsDone: number;
  checkpointsTotal: number;
}

export function DefenseReadiness({
  percent,
  checkpointsDone,
  checkpointsTotal,
}: DefenseReadinessProps) {
  return (
    <section
      aria-labelledby="defense-readiness-heading"
      className="rounded-lg border border-surface-border bg-surface-raised p-4"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2
          id="defense-readiness-heading"
          className="text-sm font-semibold text-text-primary"
        >
          Defense Readiness
        </h2>
        <span className="text-sm font-bold text-brand-500">{percent}%</span>
      </div>
      <div
        className="h-2 w-full rounded-full bg-surface-overlay"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-labelledby="defense-readiness-heading"
      >
        <div
          className="h-2 rounded-full bg-brand-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-text-secondary">
        {checkpointsDone}/{checkpointsTotal} checkpoints
      </p>
    </section>
  );
}
