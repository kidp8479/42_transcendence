export interface AuthenticatedUser {
  id: string;
  email: string;
  emailVerified: boolean;
  username: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  campus: string | null;
}

export interface AuthSession {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: AuthenticatedUser;
  csrfToken: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
}

export class AuthRequestError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "AuthRequestError";
  }
}

const csrfCookieName = "tr_csrf";
let currentSession: AuthSession | null = null;
let refreshInFlight: Promise<AuthSession | null> | null = null;
const sessionListeners = new Set<(session: AuthSession | null) => void>();

export function setAuthSession(session: AuthSession | null): void {
  publishAuthSession(session);
}

export function getAuthSession(): AuthSession | null {
  return currentSession;
}

export function subscribeAuthSession(
  listener: (session: AuthSession | null) => void
): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

// Session discovery is a refresh operation because the access token is
// intentionally memory-only and cannot be restored after a page load.
export async function getSession(): Promise<AuthSession | null> {
  return refreshSession();
}

export async function refreshAfterUnauthorized(
  rejectedAccessToken: string
): Promise<AuthSession | null> {
  if (currentSession && currentSession.accessToken !== rejectedAccessToken) {
    return currentSession;
  }
  return refreshSession();
}

export async function login(
  email: string,
  password: string
): Promise<AuthSession> {
  return authRequest("/auth/login", { email, password });
}

export async function register(
  email: string,
  username: string,
  password: string
): Promise<AuthSession> {
  return authRequest("/auth/register", { email, username, password });
}

export async function isFortyTwoOAuthAvailable(): Promise<boolean> {
  try {
    const response = await fetch("/auth/oauth/42/availability", {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return false;
    }
    const payload: unknown = await response.json();
    return isRecord(payload) && typeof payload.available === "boolean"
      ? payload.available
      : false;
  } catch {
    return false;
  }
}

export async function logout(csrfToken?: string): Promise<void> {
  const token =
    csrfToken ?? currentSession?.csrfToken ?? readCookie(csrfCookieName);
  if (!token) {
    publishAuthSession(null);
    return;
  }

  const response = await fetch("/auth/logout", {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "X-CSRF-Token": token,
    },
  });

  if (response.status === 401) {
    publishAuthSession(null);
    return;
  }
  if (response.status !== 204) {
    throw new AuthRequestError(
      response.status,
      await readErrorMessage(response)
    );
  }
  publishAuthSession(null);
}

function refreshSession(): Promise<AuthSession | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  const csrfToken = currentSession?.csrfToken ?? readCookie(csrfCookieName);
  if (!csrfToken) {
    publishAuthSession(null);
    return Promise.resolve(null);
  }

  const request = fetch("/auth/refresh", {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "X-CSRF-Token": csrfToken,
    },
  })
    .then(async (response) => {
      if (response.status === 401) {
        publishAuthSession(null);
        return null;
      }
      return parseSessionResponse(response);
    })
    .catch((error: unknown) => {
      publishAuthSession(null);
      throw error;
    })
    .finally(() => {
      if (refreshInFlight === request) {
        refreshInFlight = null;
      }
    });

  refreshInFlight = request;
  return request;
}

async function authRequest(
  url: string,
  body: Record<string, string>
): Promise<AuthSession> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return parseSessionResponse(response);
}

async function parseSessionResponse(response: Response): Promise<AuthSession> {
  if (!response.ok) {
    throw new AuthRequestError(
      response.status,
      await readErrorMessage(response)
    );
  }

  const payload: unknown = await response.json();
  if (!isAuthSession(payload)) {
    throw new Error("Authentication service returned invalid credentials");
  }
  publishAuthSession(payload);
  return payload;
}

function publishAuthSession(session: AuthSession | null): void {
  currentSession = session;
  for (const listener of sessionListeners) {
    listener(session);
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  const fallback = `Authentication request failed (${response.status})`;
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return fallback;
  }

  const payload: unknown = await response.json();
  if (
    isRecord(payload) &&
    typeof payload.message === "string" &&
    payload.message.length > 0
  ) {
    return payload.message;
  }
  return fallback;
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }
  for (const part of document.cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1 || part.slice(0, separator).trim() !== name) {
      continue;
    }
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!isRecord(value) || !isRecord(value.user)) {
    return false;
  }

  const { user } = value;
  return (
    typeof value.accessToken === "string" &&
    value.tokenType === "Bearer" &&
    typeof value.expiresIn === "number" &&
    typeof value.csrfToken === "string" &&
    typeof value.idleExpiresAt === "string" &&
    typeof value.absoluteExpiresAt === "string" &&
    typeof user.id === "string" &&
    typeof user.email === "string" &&
    typeof user.emailVerified === "boolean" &&
    typeof user.username === "string" &&
    (user.firstName === null || typeof user.firstName === "string") &&
    (user.lastName === null || typeof user.lastName === "string") &&
    (user.avatarUrl === null || typeof user.avatarUrl === "string") &&
    (user.campus === null || typeof user.campus === "string")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
