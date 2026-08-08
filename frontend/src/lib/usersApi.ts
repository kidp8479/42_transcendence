import { ApiError, apiClient } from "./apiClient";

// Mirrors SAFE_PUBLIC_USER_SELECT in backend/src/users/users.service.ts -
// the subset of a User safe to hand to another authenticated user. Unlike
// GET /users/me, this is reachable for any user id, not just the caller's
// own. No email - see getFriendEmail below for the one path allowed to
// hand that out, and SAFE_PUBLIC_USER_SELECT's own comment for why.
export interface PublicUserProfile {
  id: string;
  username: string;
  avatarUrl: string | null;
  campus: string | null;
  // Computed fresh per request from whether the user currently has a live
  // WebSocket connection (see RealtimeService.isUserOnline) - never a
  // stored/cached value, so it's only ever as stale as this one response.
  online: boolean;
}

// GET /users/:id - resolves any user id into their public profile. Used to
// turn the bare ids a UserRelationship row (or a "friends:*" socket event)
// carries into something displayable.
export async function getUserProfile(id: string): Promise<PublicUserProfile> {
  const payload = await apiClient<unknown>(`/users/${id}`);
  return parsePublicUserProfile(payload);
}

// GET /users/presence?ids=... - bulk online/offline for the friends list's
// presence poll (useFriendsRealtime.ts), backed by RealtimeService's O(1)
// in-memory check. Replaces one getUserProfile per friend (full profile +
// a blocked-by-target DB query each, just to read one boolean) with a
// single request. Missing/unknown ids simply don't appear in the result -
// nothing to parse or validate beyond "is this a boolean".
export async function getPresence(
  ids: string[]
): Promise<Record<string, boolean>> {
  if (ids.length === 0) {
    return {};
  }
  const payload = await apiClient<unknown>(
    `/users/presence?ids=${ids.map(encodeURIComponent).join(",")}`
  );
  if (!isRecord(payload)) {
    throw new Error("Presence response is invalid");
  }
  const presence: Record<string, boolean> = {};
  for (const [id, online] of Object.entries(payload)) {
    if (typeof online === "boolean") {
      presence[id] = online;
    }
  }
  return presence;
}

export function parsePublicUserProfile(value: unknown): PublicUserProfile {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.username !== "string" ||
    !isNullableString(value.avatarUrl) ||
    !isNullableString(value.campus) ||
    typeof value.online !== "boolean"
  ) {
    throw new Error("User profile response is invalid");
  }

  return {
    id: value.id,
    username: value.username,
    avatarUrl: value.avatarUrl,
    campus: value.campus,
    online: value.online,
  };
}

// GET /users/:id/email - only returns a real value when the caller and `id`
// have a genuine mutual ACCEPTED relationship (checked server-side, see
// UsersService.findEmail's own comment - never trust the frontend's own
// derived status for this). A 403 here just means "not authorized", which
// is expected and not worth surfacing as an error - the caller only ever
// invokes this when its own state already believes the two are friends,
// so a 403 means that belief was stale (ex: silently blocked - the whole
// point is for that to look identical to "not friends", not a toast).
export async function getFriendEmail(id: string): Promise<string | null> {
  try {
    const payload = await apiClient<unknown>(`/users/${id}/email`);
    if (!isRecord(payload) || typeof payload.email !== "string") {
      throw new Error("Friend email response is invalid");
    }
    return payload.email;
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return null;
    }
    throw error;
  }
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
