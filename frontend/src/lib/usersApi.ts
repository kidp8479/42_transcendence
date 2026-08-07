import { apiClient } from "./apiClient";

// Mirrors SAFE_PUBLIC_USER_SELECT in backend/src/users/users.service.ts -
// the subset of a User safe to hand to another authenticated user. Unlike
// GET /users/me, this is reachable for any user id, not just the caller's
// own.
export interface PublicUserProfile {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  campus: string | null;
}

// GET /users/:id - resolves any user id into their public profile. Used to
// turn the bare ids a UserRelationship row (or a "friends:*" socket event)
// carries into something displayable.
export async function getUserProfile(id: string): Promise<PublicUserProfile> {
  const payload = await apiClient<unknown>(`/users/${id}`);
  return parsePublicUserProfile(payload);
}

export function parsePublicUserProfile(value: unknown): PublicUserProfile {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.username !== "string" ||
    typeof value.email !== "string" ||
    !isNullableString(value.avatarUrl) ||
    !isNullableString(value.campus)
  ) {
    throw new Error("User profile response is invalid");
  }

  return {
    id: value.id,
    username: value.username,
    email: value.email,
    avatarUrl: value.avatarUrl,
    campus: value.campus,
  };
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
