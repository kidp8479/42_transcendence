// The /search route's URL contract, in one place. The route validates its
// search params with it, the components build their links with it, and the
// loader translates it into an API call - three consumers that must agree on
// what "?type=tasks&page=2" means.
//
// Two shapes, deliberately:
//
//   SearchPageSearch - what actually lives in the address bar. Everything but
//     `q` is optional, so a value equal to its default is simply ABSENT.
//     Typing "sh" in the header must land on /search?q=sh, not on
//     /search?q=sh&type=all&sort=name&order=asc&page=1&includeArchived=false.
//   SearchPageParams - the same thing with every default resolved. This is what
//     the loader and the components read, so no component ever has to remember
//     that a missing `sort` means "name".
//
// resolveSearchPageParams() goes from the first to the second, nextSearchParams()
// from the second back to the first.
import {
  isSearchOrder,
  isSearchSort,
  isSearchStatusFilter,
  isSearchType,
  SEARCH_QUERY_MAX_LENGTH,
  type SearchOrder,
  type SearchParams,
  type SearchSort,
  type SearchStatusFilter,
  type SearchType,
} from "@/lib/searchApi";

export interface SearchPageSearch {
  q: string;
  type?: SearchType;
  sort?: SearchSort;
  order?: SearchOrder;
  page?: number;
  status?: SearchStatusFilter;
  includeArchived?: boolean;
}

export interface SearchPageParams {
  q: string;
  type: SearchType;
  sort: SearchSort;
  order: SearchOrder;
  page: number;
  // Still optional once resolved: "no status filter" is a real state, not a
  // default value standing in for one.
  status?: SearchStatusFilter;
  includeArchived: boolean;
}

// The route's validateSearch. It NEVER throws, which is the opposite choice
// from searchApi.ts's response parsers - and for a reason: there it is the
// server talking, and a malformed answer is a bug worth surfacing; here it is
// the address bar, and anyone can type into it. A hand-edited ?type=bogus must
// give a normal page, not the root error screen.
export function parseSearchPageSearch(
  raw: Record<string, unknown>
): SearchPageSearch {
  // EVERY key is named, `undefined` included. The router does not replace the
  // raw params with what comes back from here, it merges the two -
  // `{ ...rawFromUrl, ...validateSearch(rawFromUrl) }` (router-core's
  // Object.assign over `{ ...location.search }`, and the same spread in its
  // validate middleware). A key this function leaves OUT is therefore a key it
  // fails to clear: ?page=-298 would be rejected by parsePage and then sail
  // through into Route.useSearch() anyway, because the merge had nothing to
  // overwrite it with. Naming the key is what rejects the value.
  //
  // The undefineds cost nothing on the way back out: the router's query-string
  // encoder skips undefined values, so none of these six ever appears in the
  // address bar.
  return {
    q: parseQuery(raw.q),
    type: isSearchType(raw.type) ? raw.type : undefined,
    sort: isSearchSort(raw.sort) ? raw.sort : undefined,
    order: isSearchOrder(raw.order) ? raw.order : undefined,
    page: parsePage(raw.page),
    status: isSearchStatusFilter(raw.status) ? raw.status : undefined,
    // TanStack parses search values as JSON when it can, so this arrives as a
    // real boolean from a router navigation and as the string "true" from a
    // hand-typed URL. Both have to work.
    includeArchived:
      raw.includeArchived === true || raw.includeArchived === "true"
        ? true
        : undefined,
  };
}

export function resolveSearchPageParams(
  search: SearchPageSearch
): SearchPageParams {
  return {
    q: search.q,
    type: search.type ?? "all",
    sort: search.sort ?? "name",
    order: search.order ?? "asc",
    page: search.page ?? 1,
    status: search.status,
    includeArchived: search.includeArchived ?? false,
  };
}

// Builds the search object for a <Link> or a navigate() from the current one
// plus a patch. Defaults are stripped on the way out, the same whitelist idea
// buildSearchQuery uses for the API call - here it keeps the URL readable
// instead of keeping a 400 away.
//
// `page` is the interesting case: it is carried over ONLY when the patch names
// it. Every other caller is changing what the result set IS - a filter, a sort,
// a type - and page 3 of the previous result set means nothing in the new one.
// Making that the default of this one function is what stops "you were on
// page 3, the filter cut it down to 12 results, here is a blank screen" from
// having to be remembered at six call sites.
export function nextSearchParams(
  current: SearchPageSearch,
  patch: Partial<SearchPageSearch>
): SearchPageSearch {
  const merged = { ...current, ...patch };
  const next: SearchPageSearch = { q: merged.q };

  if (merged.type !== undefined && merged.type !== "all") {
    next.type = merged.type;
  }
  if (merged.sort !== undefined && merged.sort !== "name") {
    next.sort = merged.sort;
  }
  if (merged.order !== undefined && merged.order !== "asc") {
    next.order = merged.order;
  }
  if (patch.page !== undefined && patch.page > 1) {
    next.page = patch.page;
  }
  if (merged.status !== undefined) {
    next.status = merged.status;
  }
  if (merged.includeArchived === true) {
    next.includeArchived = true;
  }

  return next;
}

// The page's own state translated into the API's contract. The two types are
// kept apart on purpose: the backend's ValidationPipe runs with
// forbidNonWhitelisted, so the day this URL carries a key that is purely about
// the UI, forwarding the page's search object wholesale would turn every
// search into a 400 whose message says nothing about where it came from.
export function toSearchParams(params: SearchPageParams): SearchParams {
  return {
    q: params.q,
    type: params.type,
    sort: params.sort,
    order: params.order,
    page: params.page,
    status: params.status,
    includeArchived: params.includeArchived,
  };
}

// The one place `q` enters the page, so it is where its invariant is set:
// FROM HERE ON, q IS TRIMMED. Everything downstream - the loader's minimum
// length guard, the API call, and the term the page quotes back in its heading
// and empty states - reads this one value, and SearchQueryDto trims server-side
// before it searches. Without the trim, /search?q=%20%20term%20%20 renders
// `No results for "  term  "` about a search the server actually ran for
// "term".
//
// Over-long queries are truncated rather than rejected: the DTO's @MaxLength
// would answer 400, and a 400 in a loader is the full-page error screen. A
// 100-character prefix is a sane search; an error card is not.
//
// Trim, then cap, then trim the end again - the cap can land mid-space and put
// back the trailing whitespace the first trim just removed, which is the exact
// mismatch this is here to prevent.
function parseQuery(value: unknown): string {
  return typeof value === "string"
    ? value.trim().slice(0, SEARCH_QUERY_MAX_LENGTH).trimEnd()
    : "";
}

// undefined means "page 1", which is also what the absence of the key means.
function parsePage(value: unknown): number | undefined {
  const page =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isInteger(page) && page > 1 ? page : undefined;
}
