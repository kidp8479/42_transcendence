// One row of search results, whatever the row is about. A project, a task and
// a member all reduce to the same four slots - something on the left, a title,
// a line of context under it, a badge on the right - and giving them one
// component is what makes the three groups read as one list instead of three
// widgets that happen to share a page.
//
// It does NOT contain the <Link>. The route wraps it, because that is where
// the destination is known and where TanStack's typed `to`/`params` pair can
// still be checked against the route tree.
import type { ReactNode } from "react";

interface SearchResultRowProps {
  // an icon or an avatar - the row doesn't care which
  leading: ReactNode;
  title: string;
  // Nullable rather than optional-only: descriptions and campuses come back as
  // null from the API and are passed straight through, so the caller never has
  // to turn a null into an empty string just to satisfy a prop type.
  subtitle?: string | null;
  trailing?: ReactNode;
}

export function SearchResultRow({
  leading,
  title,
  subtitle,
  trailing,
}: SearchResultRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-surface-border bg-surface-raised px-4 py-3 transition-colors hover:border-brand-500/50">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-overlay">
        {leading}
      </div>

      {/* min-w-0 is what lets truncate work at all: without it this flex item
          refuses to shrink below its content's intrinsic width and the row
          overflows instead of clipping. */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">
          {title}
        </p>
        {subtitle && (
          <p className="line-clamp-1 text-xs text-text-secondary">{subtitle}</p>
        )}
      </div>

      {trailing && (
        <div className="flex shrink-0 items-center gap-2">{trailing}</div>
      )}
    </div>
  );
}
