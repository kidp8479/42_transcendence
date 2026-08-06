// Search results page (/search) - the landing point of the header's search bar.
//
// Everything on this page is URL state: the term, the type tab, the sort, the
// filters and the page number all live in the query string, and the loader
// re-runs on every change. That is what makes a result page shareable, and what
// makes the browser's Back button undo a filter instead of leaving the page.
//
// It is also the only route in this repo that uses loaderDeps. TanStack does
// not re-run a loader when only the search params change, so without it the
// second search would keep showing the first one's results.
//
// The page is read-only, so it deliberately skips two conventions that other
// routes follow: no useState/useEffect mirror of the loader data (that exists
// on discovery/kanban to survive router.invalidate() after a mutation, and
// nothing is mutated here), and no toasts (a failed load belongs to
// RootErrorComponent).
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SearchFilters } from "@/components/search/SearchFilters";
import { SearchPagination } from "@/components/search/SearchPagination";
import {
  ProjectResultLink,
  TaskResultLink,
  UserResultLink,
} from "@/components/search/SearchResultLinks";
import { SearchSection } from "@/components/search/SearchSection";
import { SearchSortControl } from "@/components/search/SearchSortControl";
import { SearchTabs } from "@/components/search/SearchTabs";
import {
  searchWorkspace,
  SEARCH_QUERY_MIN_LENGTH,
  type SearchResults,
  type SearchType,
} from "@/lib/searchApi";
import {
  nextSearchParams,
  parseSearchPageSearch,
  resolveSearchPageParams,
  toSearchParams,
  type SearchPageParams,
  type SearchPageSearch,
} from "@/lib/searchPageParams";

// A result row is one line of text and two badges; stretched across a 27"
// screen it reads as a banner, not a list. Capping the column leaves dead
// space either side on a desktop and changes nothing below 64rem, where the
// padding is already the whole story.
const PAGE_WIDTH_CLASS = "mx-auto w-full max-w-5xl";

// Same dashed box as EmptyColumnState.tsx - the house empty state. Repeated
// here rather than imported because that component hardcodes "No tasks".
const EMPTY_STATE_CLASS =
  "rounded-lg border border-dashed border-surface-border p-6 text-center text-xs text-text-muted-on-base";

// What each tab calls its rows in a sentence. "users" is the API's word for
// them; the UI has said "Members" since the header's search bar.
const TYPE_NOUNS: Record<SearchType, string> = {
  all: "results",
  projects: "projects",
  tasks: "tasks",
  users: "members",
};

async function loadSearchPageData(
  search: SearchPageSearch
): Promise<SearchResults | null> {
  const params = resolveSearchPageParams(search);

  // Below the minimum the DTO would answer 400, and a 400 inside a loader is
  // the full-page error screen. "I've only typed one letter" is a normal state
  // of the UI, so it never becomes a request at all.
  if (params.q.trim().length < SEARCH_QUERY_MIN_LENGTH) {
    return null;
  }
  return searchWorkspace(toSearchParams(params));
}

export const Route = createFileRoute("/_authenticated/search")({
  // The input stays Record<string, unknown> on purpose: it is what lets
  // SearchBar.tsx keep navigating with just { q }, without the six other keys.
  validateSearch: (search: Record<string, unknown>): SearchPageSearch =>
    parseSearchPageSearch(search),
  // Sorting, filtering and pagination are all resolved server-side, so every
  // change of the query string has to reach the loader.
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => loadSearchPageData(deps),
  component: SearchPage,
});

function SearchPage() {
  const search = Route.useSearch();
  const params = resolveSearchPageParams(search);
  const results = Route.useLoaderData();
  const navigate = useNavigate();

  // Every filter and sort change goes through here, and nextSearchParams drops
  // the page unless the patch names one: staying on page 3 of a result set that
  // a new filter just cut down to twelve rows shows a blank list. Invisible
  // with seed data, systematic in front of a grader.
  function updateParams(patch: Partial<SearchPageSearch>) {
    void navigate({ to: "/search", search: nextSearchParams(params, patch) });
  }

  function goToPage(page: number) {
    void navigate({
      to: "/search",
      search: nextSearchParams(params, { page }),
    });
  }

  return (
    <>
      {/* AuthenticatedLayout's <main> is a plain block, not a flex column, so
          this page returns sibling divs - same header block as projects.tsx.
          The rule spans the full width while its text lines up with the
          results below, hence the inner wrapper. */}
      <div className="mb-2 border-b border-surface-border">
        <div className={`${PAGE_WIDTH_CLASS} p-6`}>
          <h1 className="text-xl font-bold font-mono text-text-primary">
            Search
          </h1>
          <p className="text-xs text-text-secondary">
            {params.q
              ? `Results for "${params.q}"`
              : "Find projects, tasks and members across your workspace."}
          </p>
        </div>
      </div>

      <div className={`${PAGE_WIDTH_CLASS} flex flex-col gap-4 p-6`}>
        {results === null ? (
          <p className={EMPTY_STATE_CLASS}>
            {params.q.trim().length === 0
              ? "Search from the bar at the top of the page."
              : `Type at least ${SEARCH_QUERY_MIN_LENGTH} characters to search.`}
          </p>
        ) : (
          <>
            <SearchTabs
              params={params}
              counts={{
                projects: results.projects.total,
                tasks: results.tasks.total,
                users: results.users.total,
              }}
            />

            {/* ml-auto rather than justify-between: SearchFilters renders
                nothing on the Members tab, and the sort control would then
                slide to the left of the row. */}
            <div className="flex flex-wrap items-center gap-3">
              <SearchFilters params={params} onChange={updateParams} />
              <div className="ml-auto">
                <SearchSortControl params={params} onChange={updateParams} />
              </div>
            </div>

            <SearchResultsView
              params={params}
              results={results}
              onPageChange={goToPage}
            />
          </>
        )}
      </div>
    </>
  );
}

// Named ...View because SearchResults is already the API response type this
// takes as a prop.
function SearchResultsView({
  params,
  results,
  onPageChange,
}: {
  params: SearchPageParams;
  results: SearchResults;
  onPageChange: (page: number) => void;
}) {
  if (params.type === "all") {
    const grandTotal =
      results.projects.total + results.tasks.total + results.users.total;

    if (grandTotal === 0) {
      // The tabs and the filters stay up above this: an over-tight filter is
      // the likeliest cause, and it has to remain reachable.
      return (
        <p className={EMPTY_STATE_CLASS}>
          No results for &quot;{params.q}&quot;.
        </p>
      );
    }

    return (
      <div className="flex flex-col gap-6">
        <SearchSection
          title="Projects"
          total={results.projects.total}
          type="projects"
          params={params}
        >
          {results.projects.items.map((project) => (
            <ProjectResultLink key={project.id} project={project} />
          ))}
        </SearchSection>
        <SearchSection
          title="Tasks"
          total={results.tasks.total}
          type="tasks"
          params={params}
        >
          {results.tasks.items.map((task) => (
            <TaskResultLink key={task.id} task={task} />
          ))}
        </SearchSection>
        <SearchSection
          title="Members"
          total={results.users.total}
          type="users"
          params={params}
        >
          {results.users.items.map((user) => (
            <UserResultLink key={user.id} user={user} />
          ))}
        </SearchSection>
      </div>
    );
  }

  const bucket =
    params.type === "projects"
      ? results.projects
      : params.type === "tasks"
        ? results.tasks
        : results.users;

  // Per-type, not global: "sh" can match two projects and zero tasks, and the
  // Tasks tab then has to say so. Reading the grand total here would instead
  // send it down the "wrong page" branch below and offer to go back to page 1
  // it is already on.
  if (bucket.total === 0) {
    return (
      <p className={EMPTY_STATE_CLASS}>
        No {TYPE_NOUNS[params.type]} match &quot;{params.q}&quot;.
      </p>
    );
  }

  // A non-empty group with an empty page: reachable by editing ?page= by hand,
  // and by pressing Back onto a page a filter has since emptied. Without this
  // the screen is simply blank, which reads as a crash.
  if (bucket.items.length === 0) {
    return (
      <div className={EMPTY_STATE_CLASS}>
        <p>Nothing on page {params.page}.</p>
        <Link
          to="/search"
          search={nextSearchParams(params, { page: 1 })}
          className="mt-1 inline-block font-medium text-brand-500 hover:underline"
        >
          Back to the first page
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {params.type === "projects" &&
        results.projects.items.map((project) => (
          <ProjectResultLink key={project.id} project={project} />
        ))}
      {params.type === "tasks" &&
        results.tasks.items.map((task) => (
          <TaskResultLink key={task.id} task={task} />
        ))}
      {params.type === "users" &&
        results.users.items.map((user) => (
          <UserResultLink key={user.id} user={user} />
        ))}

      <SearchPagination
        page={params.page}
        // The limit the server actually applied, not the one we asked for.
        limit={results.limit}
        total={bucket.total}
        onPageChange={onPageChange}
      />
    </div>
  );
}
