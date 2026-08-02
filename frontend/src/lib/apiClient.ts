import { getAuthSession, getSession, refreshAfterUnauthorized } from "./auth";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// eslint-disable-next-line no-undef -- RequestInit is a TypeScript DOM ambient type.
type ApiOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};
type FetchInput = Parameters<typeof fetch>[0];
type FetchOptions = NonNullable<Parameters<typeof fetch>[1]>;

export async function apiClient<T>(
  path: string,
  { body, ...options }: ApiOptions = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");

  const response = await bearerFetch(`/api${path}`, {
    ...options,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export async function bearerFetch(
  input: FetchInput,
  init: FetchOptions = {}
): Promise<Response> {
  const session = getAuthSession() ?? (await getSession());
  if (!session) {
    throw new ApiError(401, "An active session is required");
  }

  let response = await fetchWithAccessToken(input, init, session.accessToken);
  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshAfterUnauthorized(session.accessToken);
  if (!refreshed) {
    return response;
  }
  response = await fetchWithAccessToken(input, init, refreshed.accessToken);
  return response;
}

function fetchWithAccessToken(
  input: FetchInput,
  init: FetchOptions,
  accessToken: string
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(input, {
    ...init,
    headers,
    credentials: "omit",
  });
}

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
