import { Avatar } from "flowbite-react";
import type { FieldLock } from "@/hooks/useFieldLock";

interface LockOwnerAvatarProps {
  lock: FieldLock;
  size?: "xs" | "sm";
}

// Shared by ChecklistItemRow.tsx and discovery_.$discoveryBlockId.edit.tsx:
// both show who currently holds a field lock via the same small avatar -
// img falls back to undefined (Flowbite's own placeholder) when the lock
// holder has no avatarUrl, initials are the first two letters of their
// username, same convention as UserMenu.tsx's own account avatar.
export function LockOwnerAvatar({ lock, size = "xs" }: LockOwnerAvatarProps) {
  return (
    <Avatar
      img={lock.avatarUrl ?? undefined}
      placeholderInitials={lock.username.slice(0, 2).toUpperCase()}
      rounded
      size={size}
    />
  );
}
