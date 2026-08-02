import { useCallback, useEffect, useRef, useState } from "react";
import { getRealtimeSocket } from "@/lib/realtimeSocket";

// Mirrors the backend's FieldLock shape (RealtimeGateway).
export interface FieldLock {
  userId: string;
  username: string;
  avatarUrl: string | null;
  // identifies which socket/tab actually holds the lock, not just which
  // account - two tabs signed into the same account are two different
  // sockets, and isLockedByOther below needs to tell them apart
  socketId: string;
  expiresAt: number;
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
  leaseToken: string | null;
  leaseLost: boolean;
  // resolves to whether the lock was actually granted - callers must wait
  // for this before treating the resource as editable, the request can
  // still be denied server-side even if the local state looked free
  acquire: () => Promise<string | null>;
  release: () => void;
}

// Generic lock for any resource, keyed by an opaque string - reusable for
// Discovery block edits, checklist item labels, and later Kanban cards.
// Server side is RealtimeGateway's field:lock/field:unlock/field:query.
export function useFieldLock(
  projectId: string,
  key: string
): UseFieldLockResult {
  const [lock, setLock] = useState<FieldLock | null>(null);
  const [leaseToken, setLeaseToken] = useState<string | null>(null);
  const [leaseLost, setLeaseLost] = useState(false);
  const leaseTokenRef = useRef<string | null>(null);
  // this tab's own socket id - re-read on every "connect" (including
  // reconnects, which socket.io-client assigns a new id to) so
  // isLockedByOther below always compares against the live connection,
  // not a stale id from before a reconnect
  const [mySocketId, setMySocketId] = useState<string | undefined>(undefined);

  useEffect(() => {
    leaseTokenRef.current = leaseToken;
  }, [leaseToken]);

  useEffect(() => {
    const socket = getRealtimeSocket();

    function queryLock() {
      setMySocketId(socket.id);
      socket.emit(
        "field:query",
        { projectId, key },
        (response: { lock: FieldLock | undefined }) => {
          setLock(response.lock ?? null);
          if (response.lock?.socketId !== socket.id) {
            setLeaseToken(null);
          }
        }
      );
    }

    queryLock();
    // the backend's lock Map is in-memory, wiped on every backend restart -
    // a client whose socket survives that as a reconnect (not a page
    // reload) would otherwise keep showing a lock that no longer exists
    // server-side, since nothing else re-triggers a query. "connect" fires
    // on every reconnect, not just the first one.
    socket.on("connect", queryLock);

    function handleLocked(event: FieldLockedEvent) {
      if (event.key === key) {
        setLock(event.lock);
      }
    }
    function handleUnlocked(event: FieldUnlockedEvent) {
      if (event.key === key) {
        setLock(null);
        setLeaseToken(null);
        setLeaseLost(false);
      }
    }

    function handleDisconnect() {
      const heldLease = leaseTokenRef.current !== null;
      setLock(null);
      setLeaseToken(null);
      setLeaseLost(heldLease);
      setMySocketId(undefined);
    }

    socket.on("field:locked", handleLocked);
    socket.on("field:unlocked", handleUnlocked);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("connect", queryLock);
      socket.off("field:locked", handleLocked);
      socket.off("field:unlocked", handleUnlocked);
      socket.off("disconnect", handleDisconnect);
      // a component unmounting (navigating away) doesn't close the socket,
      // so the server's disconnect-based cleanup would never fire for this -
      // release explicitly. No-op server-side if this client never held it.
      socket.emit("field:unlock", { projectId, key });
    };
  }, [projectId, key]);

  useEffect(() => {
    if (leaseToken === null) {
      return;
    }

    const socket = getRealtimeSocket();
    const interval = window.setInterval(() => {
      socket.emit(
        "field:renew",
        { projectId, key, leaseToken },
        (response: { renewed: boolean }) => {
          if (!response.renewed) {
            setLeaseToken(null);
            setLock(null);
            setLeaseLost(true);
          }
        }
      );
    }, 10_000);

    return () => window.clearInterval(interval);
  }, [projectId, key, leaseToken]);

  const acquire = useCallback((): Promise<string | null> => {
    const socket = getRealtimeSocket();
    return new Promise((resolve) => {
      socket.emit(
        "field:lock",
        { projectId, key },
        (response: {
          locked: boolean;
          lock: FieldLock | undefined;
          leaseToken: string | undefined;
        }) => {
          setLock(response.lock ?? null);
          const token =
            response.locked && typeof response.leaseToken === "string"
              ? response.leaseToken
              : null;
          setLeaseToken(token);
          if (token !== null) {
            setLeaseLost(false);
          }
          resolve(token);
        }
      );
    });
  }, [projectId, key]);

  const release = useCallback(() => {
    const socket = getRealtimeSocket();
    socket.emit("field:unlock", { projectId, key });
    setLock(null);
    setLeaseToken(null);
    setLeaseLost(false);
  }, [projectId, key]);

  return {
    lock,
    isLockedByOther: lock !== null && lock.socketId !== mySocketId,
    leaseToken,
    leaseLost,
    acquire,
    release,
  };
}
