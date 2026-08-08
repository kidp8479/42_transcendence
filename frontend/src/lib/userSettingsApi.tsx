import { apiClient } from "./apiClient";

export interface User {
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  campus: string | null;
}

type UserUpdate = Pick<User, "username">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseUser(value: unknown): User {
  if (!isRecord(value)) {
    throw new Error("Users response contains invalid items");
  }

  const { username, email, firstName, lastName, avatarUrl, campus } = value;
  if (
    typeof username !== "string" ||
    typeof email !== "string" ||
    (firstName !== null && typeof firstName !== "string") ||
    (lastName !== null && typeof lastName !== "string") ||
    (avatarUrl !== null && typeof avatarUrl !== "string") ||
    (campus !== null && typeof campus !== "string")
  ) {
    throw new Error("Users response contains invalid items");
  }

  return { username, email, firstName, lastName, avatarUrl, campus };
}

export async function getMe(): Promise<User> {
  return apiClient<unknown>(`/users/me`, { method: "GET" }).then(parseUser);
}

// PATCH /users/me
export async function updateMe(dto: UserUpdate): Promise<User> {
  return apiClient<unknown>(`/users/me`, { method: "PATCH", body: dto }).then(
    parseUser
  );
}

// POST /users/me/avatar (matches @Post("me/avatar") in users.controller.ts).
// apiClient() now special-cases FormData bodies (see apiClient.ts) so this
// goes through the same bearer-token + refresh-on-401 path as every other
// call here instead of hand-rolling its own fetch.
export async function uploadAvatar(file: File): Promise<User> {
  const formData = new FormData();
  formData.append("file", file);

  return apiClient<unknown>(`/users/me/avatar`, {
    method: "POST",
    body: formData,
  }).then(parseUser);
}

// DELETE /users/me
export async function deleteMe(): Promise<User> {
  return apiClient<unknown>(`/users/me`, { method: "DELETE" }).then(parseUser);
}
