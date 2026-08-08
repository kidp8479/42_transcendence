import type { PublicUserProfile } from "./usersApi";

// Per-pair display status, reconciled from up to two raw directional rows
// (see friendsApi.ts's RelationshipStatus + deriveFriendshipStatus) into the
// one status the UI actually renders.
export type FriendshipStatus =
  | "NONE"
  | "ACCEPTED"
  | "PENDING_INCOMING"
  | "PENDING_OUTGOING"
  | "BLOCKED";

// The view model friends.tsx and its components render: a PublicUserProfile
// merged with the caller's relationship status toward that user. No email -
// that's fetched separately, only for a genuinely ACCEPTED pair, see
// usersApi.ts's getFriendEmail and ProfilePanel's own `email` prop.
export interface FriendProfile {
  id: string;
  firstName: string;
  lastName: string;
  displayedName: string;
  username: string;
  campus: string | null;
  avatarUrl: string | null;
  status: FriendshipStatus;
  online: boolean;
}

// firstName/lastName aren't tracked by the backend yet (TR-61), so every
// FriendProfile carries them blank; displayedName falls back to username,
// the only name available today.
export function toFriendProfile(
  profile: PublicUserProfile,
  status: FriendshipStatus
): FriendProfile {
  return {
    id: profile.id,
    firstName: "",
    lastName: "",
    displayedName: profile.username,
    username: profile.username,
    campus: profile.campus,
    avatarUrl: profile.avatarUrl,
    status,
    online: profile.online,
  };
}

// A presence indicator (dot in FriendRow, badge in ProfilePanel) only ever
// shows for ACCEPTED or BLOCKED - a pending relationship isn't a "friend"
// yet, so their connection status stays private the same way it would for a
// stranger. Both components independently encoded this same gate plus the
// label rule below; a type predicate here also lets callers narrow `status`
// to what presenceLabel expects without restating the check.
export function hasPresence(
  status: FriendshipStatus
): status is "ACCEPTED" | "BLOCKED" {
  return status === "ACCEPTED" || status === "BLOCKED";
}

// BLOCKED always reads as "Blocked" regardless of the real online value -
// this only ever renders on the blocker's own side (a block is never
// observable from the blocked side, see friendsApi.ts's
// deriveFriendshipStatus), so there's no real presence value that side has
// any business seeing anyway.
export function presenceLabel(
  status: "ACCEPTED" | "BLOCKED",
  online: boolean
): "Blocked" | "Online" | "Offline" {
  return status === "BLOCKED" ? "Blocked" : online ? "Online" : "Offline";
}

export function initialsOf(friend: FriendProfile): string {
  const fromName =
    `${friend.firstName.charAt(0)}${friend.lastName.charAt(0)}`.toUpperCase();
  if (fromName.trim().length > 0) {
    return fromName;
  }
  // No first/last name yet - fall back to the username so the avatar
  // placeholder isn't a blank circle.
  return friend.username.slice(0, 2).toUpperCase();
}
