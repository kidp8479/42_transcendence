import { useCallback, useEffect, useState } from "react";
import { getRealtimeSocket } from "@/lib/realtimeSocket";

// Mirrors the backend's FieldLock shape (RealtimeGateway).
export interface FieldLock {
  userId: string;
  username: string;
  avatarUrl: string | null;
}

interface FieldLockedEvent {
  key: string;
  lock: FieldLock;
}

interface FieldUnlockedEvent {
  key: string;
}

interface UseFieldLockResult {
  lock: FieldLock | null;
  isLockedByOther: boolean;
  acquire: () => void;
  release: () => void;
}

// Generic lock for any resource, keyed by an opaque string - reusable for
// Discovery block edits, checklist item labels, and later Kanban cards.
// Server side is RealtimeGateway's field:lock/field:unlock/field:query.
export function useFieldLock(
  projectId: string,
  key: string,
  currentUserId: string
): UseFieldLockResult {
  const [lock, setLock] = useState<FieldLock | null>(null);

  useEffect(() => {
    const socket = getRealtimeSocket();

    socket.emit(
      "field:query",
      { projectId, key },
      (response: { lock: FieldLock | undefined }) => {
        setLock(response.lock ?? null);
      }
    );

    function handleLocked(event: FieldLockedEvent) {
      if (event.key === key) {
        setLock(event.lock);
      }
    }
    function handleUnlocked(event: FieldUnlockedEvent) {
      if (event.key === key) {
        setLock(null);
      }
    }

    socket.on("field:locked", handleLocked);
    socket.on("field:unlocked", handleUnlocked);

    return () => {
      socket.off("field:locked", handleLocked);
      socket.off("field:unlocked", handleUnlocked);
      // a component unmounting (navigating away) doesn't close the socket,
      // so the server's disconnect-based cleanup would never fire for this -
      // release explicitly. No-op server-side if this client never held it.
      socket.emit("field:unlock", { projectId, key });
    };
  }, [projectId, key]);

  const acquire = useCallback(() => {
    const socket = getRealtimeSocket();
    socket.emit(
      "field:lock",
      { projectId, key },
      (response: { locked: boolean; lock: FieldLock | undefined }) => {
        setLock(response.lock ?? null);
      }
    );
  }, [projectId, key]);

  const release = useCallback(() => {
    const socket = getRealtimeSocket();
    socket.emit("field:unlock", { projectId, key });
    setLock(null);
  }, [projectId, key]);

  return {
    lock,
    isLockedByOther: lock !== null && lock.userId !== currentUserId,
    acquire,
    release,
  };
}
