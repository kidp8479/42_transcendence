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

type ApiOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

export async function apiClient<T>(
  path: string,
  { body, ...options }: ApiOptions = {}
): Promise<T> {
  const method = options.method?.toUpperCase() ?? "GET";
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

  const response = await fetch(`/api${path}`, {
    ...options,
    method,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new ApiError(
      response.status,
      `API request failed (${response.status})`
    );
  }

  return response.status === 204 ? (undefined as T) : response.json();
}