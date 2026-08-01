import { apiClient } from "./apiClient";

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
    (payload) => {
      const parsed = parseUser(payload);
      if (parsed === null) {
        throw new Error("User response is invalid");
      }
      return parsed;
    }
  );
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
