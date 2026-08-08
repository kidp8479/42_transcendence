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
// merged with the caller's relationship status toward that user.
export interface FriendProfile {
  id: string;
  firstName: string;
  lastName: string;
  displayedName: string;
  username: string;
  email: string;
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
    email: profile.email,
    campus: profile.campus,
    avatarUrl: profile.avatarUrl,
    status,
    online: profile.online,
  };
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
