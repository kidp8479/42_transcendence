// The suggestions that drop under the header's search bar while you type.
//
// A preview, not a results page: three rows per type at most, and a way out to
// /search for everything else. It renders the same rows the results page does
// (SearchResultLinks), so a suggestion and its full-page counterpart look the
// same and lead to the same place.
//
// Purely presentational - SearchBar owns the query, the fetch and the open
// state, and decides when this is mounted at all.
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  ProjectResultLink,
  TaskResultLink,
  UserResultLink,
} from "@/components/search/SearchResultLinks";
import type { SearchResults } from "@/lib/searchApi";

interface SearchSuggestionsPanelProps {
  // the trimmed term `results` belongs to, not what is currently in the input
  query: string;
  results: SearchResults | null;
  loading: boolean;
}

// The server sends five per type on an untyped search; three is what fits
// under a header without turning the preview into a page of its own.
const SUGGESTIONS_PER_TYPE = 3;

export function SearchSuggestionsPanel({
  query,
  results,
  loading,
}: SearchSuggestionsPanelProps) {
  const total = results
    ? results.projects.total + results.tasks.total + results.users.total
    : 0;

  return (
    // Anchored on SearchBar's own form, which is `relative`, so the panel is
    // exactly as wide as the input at every breakpoint. It lives inside
    // HeaderShell (sticky, no overflow), so nothing clips it and its z-index
    // only competes with its siblings in the header.
    //
    // A plain border works here, unlike on the Flowbite dropdowns that need
    // `border-solid` to beat their own dark:border-none default - this is a
    // hand-rolled div with no theme fighting it. No shadow though: the app
    // zeroes every --shadow-* variable, depth comes from the surface steps.
    <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-lg border border-surface-border bg-surface-overlay p-2">
      {/* Stale results stay visible while the next request is in flight -
          swapping them for "Searching..." on every keystroke would make the
          panel flash. The text only shows when there is nothing to show yet. */}
      {loading && results === null ? (
        <p className="px-2 py-3 text-sm text-text-secondary">Searching...</p>
      ) : results === null || total === 0 ? (
        <p className="px-2 py-3 text-sm text-text-secondary">
          No results for &quot;{query}&quot;.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <SuggestionGroup title="Projects" total={results.projects.total}>
            {results.projects.items
              .slice(0, SUGGESTIONS_PER_TYPE)
              .map((project) => (
                <ProjectResultLink key={project.id} project={project} />
              ))}
          </SuggestionGroup>
          <SuggestionGroup title="Tasks" total={results.tasks.total}>
            {results.tasks.items.slice(0, SUGGESTIONS_PER_TYPE).map((task) => (
              <TaskResultLink key={task.id} task={task} />
            ))}
          </SuggestionGroup>
          <SuggestionGroup title="Members" total={results.users.total}>
            {results.users.items.slice(0, SUGGESTIONS_PER_TYPE).map((user) => (
              <UserResultLink key={user.id} user={user} />
            ))}
          </SuggestionGroup>

          {/* The way out of a three-row preview. Only `q` is sent, so the page
              opens on All with its own defaults. */}
          <Link
            to="/search"
            search={{ q: query }}
            className="px-2 py-1 text-xs font-medium text-brand-500 hover:underline"
          >
            See all results ({total})
          </Link>
        </div>
      )}
    </div>
  );
}

function SuggestionGroup({
  title,
  total,
  children,
}: {
  title: string;
  total: number;
  children: ReactNode;
}) {
  if (total === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-1">
      <h2 className="px-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
        {title} ({total})
      </h2>
      {children}
    </section>
  );
}
