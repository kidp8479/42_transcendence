// One row of search results, whatever the row is about. A project, a task and
// a member all reduce to the same four slots - something on the left, a title,
// a line of context under it, badges on the right - and giving them one
// component is what makes the three groups read as one list instead of three
// widgets that happen to share a page.
//
// It does NOT contain the <Link>. The route wraps it, because that is where
// the destination is known and where TanStack's typed `to`/`params` pair can
// still be checked against the route tree.
import type { ReactNode } from "react";

interface SearchResultRowProps {
  // An icon or an avatar, passed ready to render: this row adds no box around
  // it. An avatar is already a circle, and wrapping one in a rounded square
  // gave the bubble-inside-a-bubble look the chat and the board avoid. The
  // icon rows bring their own box (SEARCH_RESULT_ICON_CLASS).
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
    <div className="flex items-center gap-3 rounded-lg border border-surface-border bg-surface-raised px-4 py-3 transition-colors hover:border-brand-500">
      {leading}

      {/* min-w-0 is what lets truncate work at all: without it this flex item
          refuses to shrink below its content's intrinsic width and the row
          overflows instead of clipping. */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">
          {title}
        </p>
        {subtitle && (
          // Two lines on a phone, one from sm up. A description clipped to a
          // single line on a narrow screen is usually clipped mid-sentence and
          // says nothing; on a wide one a second line is mostly empty space.
          <p className="line-clamp-2 text-xs text-text-secondary sm:line-clamp-1">
            {subtitle}
          </p>
        )}
      </div>

      {trailing && (
        // The badges are laid out in fixed-width columns by their callers, so
        // a "Medium" and a "High" don't shift the status pill next to them and
        // the right-hand side of the list reads as columns rather than waves.
        <div className="flex shrink-0 items-center gap-2">{trailing}</div>
      )}
    </div>
  );
}
