import { Avatar } from "flowbite-react";

interface LockOwnerAvatarProps {
  // Not FieldLock itself: this only ever renders the two fields below, so any
  // caller with a plain {username, avatarUrl} pair can use it, not just a
  // lock holder. Kanban's TaskAssignees.tsx currently duplicates this same
  // img/initials-fallback logic by hand - see its own comment for why it
  // isn't routed through here (per-user colour coding, no equivalent here).
  username: string;
  avatarUrl: string | null;
  size?: "xs" | "sm";
}

// Shared by ChecklistItemRow.tsx and discovery_.$discoveryBlockId.edit.tsx:
// both show who currently holds a field lock via the same small avatar -
// img falls back to undefined (Flowbite's own placeholder) when the lock
// holder has no avatarUrl, initials are the first two letters of their
// username, same convention as UserMenu.tsx's own account avatar.
export function LockOwnerAvatar({
  username,
  avatarUrl,
  size = "xs",
}: LockOwnerAvatarProps) {
  return (
    <Avatar
      img={avatarUrl ?? undefined}
      placeholderInitials={username.slice(0, 2).toUpperCase()}
      rounded
      size={size}
    />
  );
}
