import {
  apiClient,
  bearerFetch,
  ApiError,
  readErrorMessage,
} from "./apiClient";

export type RelationshipStatus = "PENDING_APPROVAL" | "ACCEPTED" | "BLOCKED";

// Mirrors the Prisma UserRelationship row (backend/prisma/schema.prisma) -
// findAll()/PATCH return it as-is, no select. Each row is only ONE
// participant's own stance toward the other (see the backend service's own
// top comment) - a pair of users is represented by up to two of these, one
// per direction, never a single merged "the relationship" object.
export interface UserRelationship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: RelationshipStatus;
  createdAt: string;
  updatedAt: string;
}

// GET /users/user-relationships - every directional row involving the
// caller, in both directions (see UserRelationshipsService.findAll).
// Reconciling these into one friendship status per other-user is
// deriveFriendshipStatus's job, not this call's.
export async function getUserRelationships(): Promise<UserRelationship[]> {
  const payload = await apiClient<unknown>("/users/user-relationships");
  if (!Array.isArray(payload)) {
    throw new Error("User relationships response is invalid");
  }
  const parsed = payload.map(parseUserRelationship);
  if (parsed.some((relationship) => relationship === null)) {
    throw new Error("User relationships response contains invalid items");
  }
  return parsed as UserRelationship[];
}

// GET /users/user-relationships/:id - just the directional row(s) for one
// specific pair, not the caller's whole relationship list. Used to resolve a
// single external profile's status (ex: opening a search result that isn't a
// friend yet) without re-fetching everyone.
export async function getUserRelationship(
  userId: string
): Promise<UserRelationship[]> {
  const payload = await apiClient<unknown>(
    `/users/user-relationships/${userId}`
  );
  if (!Array.isArray(payload)) {
    throw new Error("User relationship response is invalid");
  }
  const parsed = payload.map(parseUserRelationship);
  if (parsed.some((relationship) => relationship === null)) {
    throw new Error("User relationship response contains invalid items");
  }
  return parsed as UserRelationship[];
}

// POST /users/user-relationships/:id - sends a friend request. The backend
// replies with a bare [requesterId, addresseeId] tuple (not a
// UserRelationship row), which carries nothing the caller doesn't already
// know - nothing to parse, nothing to return.
export async function sendFriendRequest(userId: string): Promise<void> {
  await apiClient<unknown>(`/users/user-relationships/${userId}`, {
    method: "POST",
  });
}

// PATCH /users/user-relationships/:id - accept, block, or unblock. `userId`
// is always the OTHER person (see the backend controller's own comment: the
// URL id is never the caller's own id).
export async function updateFriendRelationship(
  userId: string,
  status: RelationshipStatus
): Promise<UserRelationship> {
  const payload = await apiClient<unknown>(
    `/users/user-relationships/${userId}`,
    { method: "PATCH", body: { status } }
  );
  const parsed = parseUserRelationship(payload);
  if (parsed === null) {
    throw new Error("User relationship update response was invalid");
  }
  return parsed;
}

// DELETE /users/user-relationships/:id - declines/cancels/removes a
// relationship. UserRelationshipsService.remove()'s transaction ends on two
// deleteMany calls with no final return, so unlike every other DELETE in
// this codebase there's no row to parse back. Going through apiClient here
// would force a response.json() call against a body that was never a JSON
// document, which throws on an empty 200 body just as much as on a real
// error - bearerFetch is used directly instead, exactly what apiClient does
// internally, minus that unneeded parse.
export async function removeFriendRelationship(userId: string): Promise<void> {
  const response = await bearerFetch(
    `/api/users/user-relationships/${userId}`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }
}

// Each UserRelationship row is one side's own stance; the caller only ever
// has `mine` (their own directional row) and/or `theirs` (the other side's),
// never one merged object - reconciling the two into a single display status
// is exactly what create()/update()'s own comments describe (see
// backend/.../user-relationships.service.ts).
export function deriveFriendshipStatus(
  mine: RelationshipStatus | undefined,
  theirs: RelationshipStatus | undefined
): "NONE" | "ACCEPTED" | "PENDING_INCOMING" | "PENDING_OUTGOING" | "BLOCKED" {
  if (mine === "BLOCKED") {
    return "BLOCKED";
  }
  // A block must stay unobservable from the blocked side (create()'s own
  // duplicate-request handling already enforces this for a fresh request) -
  // falling through to "NONE" here would do the opposite: the friend's row
  // would vanish from the list entirely the moment they blocked me, which is
  // a bigger tell than anything it's supposed to hide. Treating their row as
  // still ACCEPTED keeps the relationship looking exactly like it did before
  // the block, for both people it can legitimately mean (a settled
  // friendship, or the other side never having answered my request yet).
  const effectiveTheirs = theirs === "BLOCKED" ? "ACCEPTED" : theirs;
  if (mine === "ACCEPTED" && effectiveTheirs === "ACCEPTED") {
    return "ACCEPTED";
  }
  if (mine === "ACCEPTED" && effectiveTheirs === "PENDING_APPROVAL") {
    return "PENDING_OUTGOING";
  }
  if (mine === "PENDING_APPROVAL" && effectiveTheirs === "ACCEPTED") {
    return "PENDING_INCOMING";
  }
  return "NONE";
}

// Non-throwing (returns null on a malformed value) rather than throwing like
// the rest of this file's parsers - this one doubles as the validator for
// the "friends:request-accepted" socket payload (see friends.tsx), where one
// bad frame must not take the whole page down, same reasoning as
// notificationsApi.ts's parseNotification.
export function parseUserRelationship(value: unknown): UserRelationship | null {
  if (!isRecord(value)) {
    return null;
  }
  const { id, requesterId, addresseeId, status, createdAt, updatedAt } = value;
  if (
    typeof id !== "string" ||
    typeof requesterId !== "string" ||
    typeof addresseeId !== "string" ||
    !isRelationshipStatus(status) ||
    typeof createdAt !== "string" ||
    typeof updatedAt !== "string"
  ) {
    return null;
  }
  return { id, requesterId, addresseeId, status, createdAt, updatedAt };
}

function isRelationshipStatus(value: unknown): value is RelationshipStatus {
  return (
    value === "PENDING_APPROVAL" || value === "ACCEPTED" || value === "BLOCKED"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
