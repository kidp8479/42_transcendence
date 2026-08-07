// Search API helpers for the /search page: network and parsing kept out of the
// route, mirroring backend/src/search/ (its DTO for the query, SearchService
// for the response).
//
// One request returns all three result groups at once. Filtering, sorting and
// pagination are resolved entirely server-side - this module never slices or
// re-sorts what it receives, it asks for the page it wants and renders the
// answer.
import { apiClient } from "@/lib/apiClient";
import type { ProjectStatus } from "@/lib/projectsApi";
import type { TaskPriority, TaskStatus } from "@/lib/tasks";

// Mirrors backend/src/search/search.constants.ts - kept in sync by hand, the
// two builds share no import (same arrangement as tasks.ts). The route uses the
// minimum to stay quiet below two characters instead of firing a request the
// DTO would reject with a 400, which is a normal UI state, not an error.
//
// The page size is deliberately NOT mirrored: nothing here sends a `limit`, so
// the server's default is the only one there is, and it comes back in the
// response for SearchPagination to divide by. A second copy of the number over
// here would be one nobody reads and everybody trusts.
export const SEARCH_QUERY_MIN_LENGTH = 2;
export const SEARCH_QUERY_MAX_LENGTH = 100;

// Mirror the unions SearchQueryDto validates with @IsIn.
export type SearchType = "all" | "projects" | "tasks" | "users";
export type SearchSort = "name" | "recent";
export type SearchOrder = "asc" | "desc";

// The status filter spans two backend enums: the server applies the value only
// to the type it belongs to, and ignores it entirely on type=all.
export type SearchStatusFilter = ProjectStatus | TaskStatus;

// Narrower than Project in projectsApi.ts, which also carries role, progress,
// memberCount and deadline - a search result has no use for any of them, and
// the backend's select doesn't return them.
export interface SearchProjectResult {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  isArchived: boolean;
  updatedAt: string;
}

// Likewise narrower than Task in tasks.ts (no rank, categoryId, notes,
// onCalendar or assignees).
export interface SearchTaskResult {
  id: string;
  projectId: string;
  // Flattened server-side by SearchService: "Fix login" means nothing out of
  // context, so every task result carries the name of the project it lives in.
  projectName: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  updatedAt: string;
}

// Same shape as ProjectMember["user"] in projectMembersApi.ts, redeclared
// rather than shared: that one is an anonymous inline type inside someone
// else's module, so extracting it would mean editing their file for no gain.
// It never carries an email - the backend's select leaves it out on purpose,
// so search can't be used to check whether an address is registered.
export interface SearchUserResult {
  id: string;
  username: string;
  avatarUrl: string | null;
  campus: string | null;
}

// Every group reports its own total, including the ones whose items the server
// deliberately didn't fetch. That is what keeps the tab counters honest while
// only the active tab is being paginated.
export interface SearchBucket<T> {
  items: T[];
  total: number;
}

export interface SearchResults {
  // These six echo what the server ACTUALLY applied, not what was asked for:
  // on type=all it pins page to 1 and limit to its preview size, because a
  // preview of three types at once is not a list you can be on page 3 of.
  query: string;
  type: SearchType;
  sort: SearchSort;
  order: SearchOrder;
  page: number;
  limit: number;
  projects: SearchBucket<SearchProjectResult>;
  tasks: SearchBucket<SearchTaskResult>;
  users: SearchBucket<SearchUserResult>;
}

export interface SearchParams {
  q: string;
  type?: SearchType;
  sort?: SearchSort;
  order?: SearchOrder;
  page?: number;
  // No `limit`: the page size is the server's to decide (SEARCH_DEFAULT_LIMIT
  // there, pinned to a preview on type=all), and it is echoed back in the
  // response. Add it here the day a caller genuinely needs another size.
  status?: SearchStatusFilter;
  includeArchived?: boolean;
}

// GET /search => projects, tasks and users matching the term, each with a total
export async function searchWorkspace(
  params: SearchParams
): Promise<SearchResults> {
  // apiClient<unknown>, not apiClient<SearchResults>: that generic is only a
  // TS-level cast, it doesn't check the response shape. parseSearchResults does.
  const payload = await apiClient<unknown>(
    "/search?" + buildSearchQuery(params)
  );
  return parseSearchResults(payload);
}

// Named keys only - never a loop over the params object, and never
// `new URLSearchParams(someRouteSearchObject)`. The backend's ValidationPipe
// runs with forbidNonWhitelisted, so a single undeclared key turns every search
// into a 400 whose message doesn't say where it came from; and the /search
// route's own URL will eventually carry UI-only state that must not reach the
// API. Defaults are left out so the request stays readable in the Network tab.
function buildSearchQuery(params: SearchParams): string {
  const query = new URLSearchParams({ q: params.q });
  if (params.type !== undefined && params.type !== "all") {
    query.set("type", params.type);
  }
  if (params.sort !== undefined && params.sort !== "name") {
    query.set("sort", params.sort);
  }
  if (params.order !== undefined && params.order !== "asc") {
    query.set("order", params.order);
  }
  if (params.page !== undefined && params.page > 1) {
    query.set("page", String(params.page));
  }
  if (params.status !== undefined) {
    query.set("status", params.status);
  }
  if (params.includeArchived === true) {
    query.set("includeArchived", "true");
  }
  return query.toString();
}

// Throws rather than returning null, unlike tasks.ts and discoveryBlocks.ts:
// those parsers double as WebSocket frame validators, where one bad frame must
// not kill the page. Search has no realtime side, and a throw inside a loader
// is already caught by RootErrorComponent - same choice as projectsApi.ts.
function parseSearchResults(value: unknown): SearchResults {
  if (
    !isRecord(value) ||
    typeof value.query !== "string" ||
    !isSearchType(value.type) ||
    !isSearchSort(value.sort) ||
    !isSearchOrder(value.order) ||
    typeof value.page !== "number" ||
    typeof value.limit !== "number"
  ) {
    throw new Error("Search API returned an invalid response");
  }

  return {
    query: value.query,
    type: value.type,
    sort: value.sort,
    order: value.order,
    page: value.page,
    limit: value.limit,
    projects: parseBucket(value.projects, parseSearchProject),
    tasks: parseBucket(value.tasks, parseSearchTask),
    users: parseBucket(value.users, parseSearchUser),
  };
}

// The three groups share one shape, so they share one check.
function parseBucket<T>(
  value: unknown,
  parseItem: (item: unknown) => T
): SearchBucket<T> {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    typeof value.total !== "number"
  ) {
    throw new Error("Search API returned an invalid result group");
  }
  return { items: value.items.map(parseItem), total: value.total };
}

// Each parser rebuilds an explicit object instead of returning the validated
// value as-is, so a field the server starts sending tomorrow can't slip into
// application state unnoticed.
function parseSearchProject(value: unknown): SearchProjectResult {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    !isNullableString(value.description) ||
    !isProjectStatus(value.status) ||
    typeof value.isArchived !== "boolean" ||
    typeof value.updatedAt !== "string"
  ) {
    throw new Error("Search API returned an invalid project result");
  }

  return {
    id: value.id,
    name: value.name,
    description: value.description,
    status: value.status,
    isArchived: value.isArchived,
    updatedAt: value.updatedAt,
  };
}

function parseSearchTask(value: unknown): SearchTaskResult {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.projectId !== "string" ||
    typeof value.projectName !== "string" ||
    typeof value.title !== "string" ||
    !isNullableString(value.description) ||
    !isTaskStatus(value.status) ||
    !isTaskPriority(value.priority) ||
    typeof value.updatedAt !== "string"
  ) {
    throw new Error("Search API returned an invalid task result");
  }

  return {
    id: value.id,
    projectId: value.projectId,
    projectName: value.projectName,
    title: value.title,
    description: value.description,
    status: value.status,
    priority: value.priority,
    updatedAt: value.updatedAt,
  };
}

function parseSearchUser(value: unknown): SearchUserResult {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.username !== "string" ||
    !isNullableString(value.avatarUrl) ||
    !isNullableString(value.campus)
  ) {
    throw new Error("Search API returned an invalid user result");
  }

  return {
    id: value.id,
    username: value.username,
    avatarUrl: value.avatarUrl,
    campus: value.campus,
  };
}

// These four are exported, unlike the parsers around them: searchPageParams.ts
// validates the same unions coming from the URL rather than from the server,
// and a second hand-written copy of "all" | "projects" | "tasks" | "users" is
// exactly the kind of pair that drifts.
export function isSearchType(value: unknown): value is SearchType {
  return (
    value === "all" ||
    value === "projects" ||
    value === "tasks" ||
    value === "users"
  );
}

export function isSearchSort(value: unknown): value is SearchSort {
  return value === "name" || value === "recent";
}

export function isSearchOrder(value: unknown): value is SearchOrder {
  return value === "asc" || value === "desc";
}

// The status filter spans both enums; which one actually applies is decided by
// the active type, server-side (SearchService ignores a TaskStatus on projects).
export function isSearchStatusFilter(
  value: unknown
): value is SearchStatusFilter {
  return isProjectStatus(value) || isTaskStatus(value);
}

function isProjectStatus(value: unknown): value is ProjectStatus {
  return value === "IN_PROGRESS" || value === "REVIEW" || value === "COMPLETED";
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    value === "TODO" ||
    value === "IN_PROGRESS" ||
    value === "REVIEW" ||
    value === "COMPLETED"
  );
}

function isTaskPriority(value: unknown): value is TaskPriority {
  return value === "LOW" || value === "MEDIUM" || value === "HIGH";
}

// null is kept, not coerced: the results page distinguishes "no description"
// from an empty one, so `?? ""` here would throw that away. undefined is
// rejected on purpose - the backend always sends the key.
function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

// Narrows unknown down to "an object whose string keys can be read". Each
// module in lib/ declares its own; there is no shared helper, deliberately.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
