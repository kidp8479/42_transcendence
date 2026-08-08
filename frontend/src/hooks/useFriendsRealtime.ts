import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { friendCountResource } from "@/lib/friendCountState";
import { getRealtimeSocket } from "@/lib/realtimeSocket";
import { onFriendRequestSent, parseUserRelationship } from "@/lib/friendsApi";
import { toFriendProfile, type FriendProfile } from "@/lib/friendProfile";
import { getPresence, getUserProfile } from "@/lib/usersApi";

// Presence isn't pushed live over the socket (RealtimeService.isUserOnline
// reads it fresh per request, nothing broadcasts on connect/disconnect) - the
// friends list re-checks everyone on screen at this interval instead so it
// doesn't just go stale for the rest of the visit.
const PRESENCE_REFRESH_INTERVAL_MS = 20_000;

// Keeps friends.tsx's relationship state in sync with events it didn't
// itself cause: the other side sending/accepting/removing a request (pushed
// over the shared WebSocket - see backend/.../user-relationships.service.ts
// for where each event below is emitted), the caller sending a request from
// somewhere other than this page (onFriendRequestSent, see friendsApi.ts's
// sendFriendRequest), and presence drifting for friends already on screen.
//
// Every WebSocket event here only ever reaches the OTHER participant, never
// echoed back to whoever performed the action (see each emitToUser call on
// the backend) - so this hook only ever needs to react to the world
// changing, never to the caller's own actions. Those are applied locally by
// friends.tsx's own handlers instead.
export function useFriendsRealtime(
  currentUserId: string | null,
  friends: FriendProfile[],
  setFriends: Dispatch<SetStateAction<FriendProfile[]>>,
  setFocusedProfile: Dispatch<SetStateAction<FriendProfile | null>>,
  setSelectedId: Dispatch<SetStateAction<string | null>>
): void {
  useEffect(() => {
    if (!currentUserId) return;
    const socket = getRealtimeSocket();
    // Tied to this effect's own teardown (unmount, or currentUserId
    // changing - socket.off below), not to each individual event firing:
    // socket.on never calls a handler's return value, so a `cancelled` flag
    // declared and returned from inside handleRequestReceived itself would
    // never actually be set - a fetch it kicks off has no listener left to
    // apply its result to once this effect re-runs, regardless of which
    // particular event started it.
    let cancelled = false;

    function handleRequestReceived(payload: unknown) {
      if (typeof payload !== "string") return;
      const requesterId = payload;
      getUserProfile(requesterId)
        .then((profile) => {
          if (cancelled) return;
          setFriends((previous) =>
            previous.some((friend) => friend.id === requesterId)
              ? previous
              : [...previous, toFriendProfile(profile, "PENDING_INCOMING")]
          );
        })
        .catch(() => {
          // best-effort - a manual refresh will pick it up
        });
    }

    function handleRequestAccepted(payload: unknown) {
      const relationship = parseUserRelationship(payload);
      if (relationship === null) return;
      // The payload is the accepter's own row: requesterId is the person who
      // just accepted, addresseeId is us.
      const otherId = relationship.requesterId;
      setFriends((previous) =>
        previous.map((friend) =>
          friend.id === otherId ? { ...friend, status: "ACCEPTED" } : friend
        )
      );
    }

    // The other side declined/cancelled a pending request, or unfriended us
    // - payload is just their id, same shape as request-received's.
    function handleRelationshipRemoved(payload: unknown) {
      if (typeof payload !== "string") return;
      const otherId = payload;
      setFriends((previous) =>
        previous.filter((friend) => friend.id !== otherId)
      );
      setFocusedProfile((previous) =>
        previous?.id === otherId ? null : previous
      );
      setSelectedId((current) => (current === otherId ? null : current));
      // Might have been an ACCEPTED friendship (an unfriend) or might not (a
      // declined/cancelled request never counted) - friendCountResource's
      // own refresh() re-derives this rather than guessing here.
      friendCountResource.refresh();
    }

    socket.on("friends:request-received", handleRequestReceived);
    socket.on("friends:request-accepted", handleRequestAccepted);
    socket.on("friends:relationship-removed", handleRelationshipRemoved);

    return () => {
      cancelled = true;
      socket.off("friends:request-received", handleRequestReceived);
      socket.off("friends:request-accepted", handleRequestAccepted);
      socket.off("friends:relationship-removed", handleRelationshipRemoved);
    };
  }, [currentUserId, setFriends, setFocusedProfile, setSelectedId]);

  // A request sent from outside this page (ex: the header search bar's
  // inline "Add friend" button) never reaches this page as a socket event -
  // fetch-then-merge, the same shape handleRequestReceived above uses for an
  // incoming request, since the id may not be known here yet either.
  useEffect(() => {
    // Same fix as the socket-event effect above: onFriendRequestSent's
    // listener return value is discarded by its own for...of dispatch loop
    // (see friendsApi.ts's sendFriendRequest), so a `cancelled` flag
    // declared inside the listener callback would never actually be set.
    // Tied to this effect's own teardown instead.
    let cancelled = false;
    const unsubscribe = onFriendRequestSent((userId) => {
      getUserProfile(userId)
        .then((profile) => {
          if (cancelled) return;
          setFriends((previous) =>
            previous.some((friend) => friend.id === userId)
              ? previous.map((friend) =>
                  friend.id === userId
                    ? { ...friend, status: "PENDING_OUTGOING" }
                    : friend
                )
              : [...previous, toFriendProfile(profile, "PENDING_OUTGOING")]
          );
          setFocusedProfile((previous) =>
            previous?.id === userId
              ? { ...previous, status: "PENDING_OUTGOING" }
              : previous
          );
        })
        .catch(() => {
          // best-effort - a manual refresh will pick it up
        });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [setFriends, setFocusedProfile]);

  // Only ACCEPTED friends ever show a presence indicator (see FriendRow /
  // ProfilePanel), so pending requests and blocked users are excluded here
  // too - no point spending part of the shared 300 req/60s throttle budget
  // (app.module.ts) polling for a status nothing on screen displays. Keyed
  // on the id set, not the `friends` array itself - that array gets a new
  // reference on every tick this effect produces, which would otherwise tear
  // down and reschedule the interval every single cycle instead of letting
  // it run on its own cadence.
  const acceptedFriendIds = friends
    .filter((friend) => friend.status === "ACCEPTED")
    .map((friend) => friend.id)
    .join(",");
  // Guards against a slow tick's response landing after a faster, later
  // tick already applied newer presence data - both ticks go through the
  // same setFriends(previous.map(...)) shape with no timing info of their
  // own, so without this a stale response can silently overwrite fresher
  // data (a friend flickers to the wrong state until the next tick
  // self-corrects). Bumped synchronously before each fetch starts; a
  // response is only applied if it's still the latest one in flight when it
  // resolves.
  const latestTickRef = useRef(0);
  useEffect(() => {
    if (acceptedFriendIds.length === 0) return;
    const ids = acceptedFriendIds.split(",");

    function refreshPresence() {
      const tick = ++latestTickRef.current;
      // One bulk presence lookup instead of a full getUserProfile per
      // friend (see getPresence's own comment) - each tick used to burn a
      // full profile fetch (plus its own blocked-by-target DB query) per
      // friend on screen just to read one boolean.
      getPresence(ids)
        .then((presence) => {
          if (tick !== latestTickRef.current) return;
          setFriends((previous) =>
            previous.map((friend) =>
              // Only allocate a new object when the value actually
              // changed - FriendRow is memoized (see its own comment) on
              // the assumption that a friend nothing changed for keeps the
              // same object reference between ticks. Spreading
              // unconditionally here would hand memo a "new" friend prop
              // every 20s for every row regardless, defeating it entirely.
              friend.id in presence && friend.online !== presence[friend.id]
                ? { ...friend, online: presence[friend.id] }
                : friend
            )
          );
        })
        .catch(() => {
          // best-effort - the next tick will retry
        });
    }

    // A backgrounded/minimized tab has no visible presence dots to keep
    // fresh - polling through it just spends part of the shared 300 req/60s
    // throttle budget for no one to see. Skipped rather than cleared: the
    // interval itself stays cheap to leave running, and this keeps the tick
    // cadence (and latestTickRef bookkeeping) untouched.
    function tick() {
      if (document.hidden) return;
      refreshPresence();
    }

    const interval = window.setInterval(tick, PRESENCE_REFRESH_INTERVAL_MS);
    // Catches back up immediately on refocus instead of leaving presence
    // stale for up to a full interval - the tab could have been hidden for
    // much longer than that.
    function handleVisibilityChange() {
      if (!document.hidden) refreshPresence();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [acceptedFriendIds, setFriends]);
}
