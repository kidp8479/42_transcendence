import { getSession } from "./auth";
import {
  apiClient,
  ApiError,
  getCsrfToken,
  readErrorMessage,
} from "./apiClient";

export interface User {
  username: string;
  email: string;
  avatarUrl: string | null;
  campus: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseUser(value: unknown): User {
  if (!isRecord(value)) {
    throw new Error("Users response contains invalid items");
  }

  const { username, email, avatarUrl, campus } = value;
  if (
    typeof username !== "string" ||
    typeof email !== "string" ||
    (avatarUrl !== null && typeof avatarUrl !== "string") ||
    (campus !== null && typeof campus !== "string")
  ) {
    throw new Error("Users response contains invalid items");
  }

  return { username, email, avatarUrl, campus };
}

export async function getMe(): Promise<User> {
  return apiClient<unknown>(`/users/me`, { method: "GET" }).then(parseUser);
}

// PATCH /users/me
export async function updateMe(dto: Partial<User>): Promise<User> {
  return apiClient<unknown>(`/users/me`, { method: "PATCH", body: dto }).then(
    parseUser
  );
}

// --- Avatar ---
// POST /users/me/avatar, bypassing apiClient(): it always JSON-encodes the
// body and force-sets Content-Type, which breaks multipart/form-data (the
// browser needs to set its own boundary in Content-Type). CSRF/error
// handling below mirrors what apiClient() does for its own requests.
export async function uploadAvatar(file: File): Promise<User> {
  const token = getCsrfToken() ?? (await getSession())?.csrfToken;
  if (!token) {
    throw new Error("An active session is required");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/users/me/avatar", {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRF-Token": token },
    body: formData,
  });

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  return parseUser(await response.json());
}

// DELETE /users/me
export async function deleteMe(): Promise<User> {
  return apiClient<unknown>(`/users/me`, { method: "DELETE" }).then(
    (payload) => {
      const parsed = parseUser(payload);
      if (parsed === null) {
        throw new Error("User response is invalid");
      }
      return parsed;
    }
  );
}
