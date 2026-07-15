export interface AuthenticatedUser {
  id: string;
  email: string;
  emailVerified: boolean;
  username: string;
  avatarUrl: string | null;
  campus: string | null;
}

export interface AuthSession {
  user: AuthenticatedUser;
  csrfToken: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
}

export async function getSession(): Promise<AuthSession | null> {
  const response = await fetch("/auth/session", {
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (response.status === 401) {
    return null;
  }

  return parseSessionResponse(response);
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

export async function logout(csrfToken?: string): Promise<void> {
  const token = csrfToken ?? (await getSession())?.csrfToken;
  if (!token) {
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

  if (response.status !== 204) {
    throw new Error(await readErrorMessage(response));
  }
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
    throw new Error(await readErrorMessage(response));
  }

  const payload: unknown = await response.json();
  if (!isAuthSession(payload)) {
    throw new Error("Authentication service returned an invalid session");
  }
  return payload;
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

function isAuthSession(value: unknown): value is AuthSession {
  if (!isRecord(value) || !isRecord(value.user)) {
    return false;
  }

  const { user } = value;
  return (
    typeof value.csrfToken === "string" &&
    typeof value.idleExpiresAt === "string" &&
    typeof value.absoluteExpiresAt === "string" &&
    typeof user.id === "string" &&
    typeof user.email === "string" &&
    typeof user.emailVerified === "boolean" &&
    typeof user.username === "string" &&
    (user.avatarUrl === null || typeof user.avatarUrl === "string") &&
    (user.campus === null || typeof user.campus === "string")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
