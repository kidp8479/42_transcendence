// A titled group on the All tab, with the escape hatch that makes the tab
// useful: "View all (37)".
//
// The server returns five rows per type on type=all, and only the totals tell
// you there are thirty-two more. Without this link the only way out of a
// preview is to go back up to the tabs, which is exactly the kind of dead end
// that makes a search page feel broken.
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { SearchType } from "@/lib/searchApi";
import {
  nextSearchParams,
  type SearchPageParams,
} from "@/lib/searchPageParams";

interface SearchSectionProps {
  title: string;
  total: number;
  // the tab this section's "View all" switches to
  type: SearchType;
  params: SearchPageParams;
  children: ReactNode;
}

export function SearchSection({
  title,
  total,
  type,
  params,
  children,
}: SearchSectionProps) {
  // An empty group disappears entirely on All - three lines of chrome over
  // nothing is worse than nothing.
  if (total === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-text-primary">
          {title}
          <span className="ml-2 rounded-full bg-surface-overlay px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">
            {total}
          </span>
        </h2>
        <Link
          // Same construction as the tabs, and for the same reasons: the sort
          // travels, the status and the page do not.
          to="/search"
          search={nextSearchParams(params, { type, status: undefined })}
          className="shrink-0 text-xs font-medium text-brand-500 hover:underline"
        >
          View all ({total})
        </Link>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}
