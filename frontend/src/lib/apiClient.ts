import { getSession, type AuthSession } from "./auth";

// Carries the HTTP status code so callers can react to specific cases (ex:
// 401 meaning "session expired" vs any other failure) without parsing the
// error message string.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let csrfToken: string | undefined;

export function setApiSession(session: AuthSession | null) {
  csrfToken = session?.csrfToken;
}

// Exposed for callers that can't use apiClient() directly (ex: multipart
// uploads, which can't use its JSON-only body handling).
export function getCsrfToken(): string | undefined {
  return csrfToken;
}

// eslint-disable-next-line no-undef -- RequestInit is a TypeScript DOM ambient type.
type ApiOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

// Single fetch wrapper for every /api call: attaches the CSRF token for
// mutating requests, JSON-encodes the body, and normalizes non-OK responses
// into ApiError instead of every caller re-implementing this.
export async function apiClient<T>(
  path: string,
  { body, ...options }: ApiOptions = {}
): Promise<T> {
  const method = options.method?.toUpperCase() ?? "GET";
  // CSRF only matters for state-changing requests - safe methods are exempt.
  const isMutation = !["GET", "HEAD", "OPTIONS"].includes(method);
  const headers = new Headers(options.headers);

  if (isMutation) {
    // Current opaque-session model: the browser sends tr_session automatically.
    // We add the separate CSRF value required by Go/NestJS.
    const token = csrfToken ?? (await getSession())?.csrfToken;
    if (!token) {
      throw new Error("An active session is required");
    }
    csrfToken = token;
    headers.set("X-CSRF-Token", token);
  }

  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");

  // nginx proxies /api/* to the backend (see nginx/nginx.conf) - not a Vite dev-proxy.
  const response = await fetch(`/api${path}`, {
    ...options,
    method,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  // 204 responses (ex: deleteProject) have no body - response.json() would
  // throw on empty input, so short-circuit to undefined instead.
  return response.status === 204 ? (undefined as T) : response.json();
}

// Exported so callers that can't use apiClient() (ex: multipart uploads)
// still normalize backend error bodies the same way.
export async function readErrorMessage(response: Response): Promise<string> {
  const fallback = `API request failed (${response.status})`;
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return fallback;
  }

  try {
    const payload: unknown = await response.json();
    if (!isRecord(payload)) {
      return fallback;
    }
    const { message } = payload;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
    if (Array.isArray(message)) {
      const messages = message.filter(
        (entry): entry is string => typeof entry === "string"
      );
      return messages.length > 0 ? messages.join(", ") : fallback;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
