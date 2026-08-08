import { useEffect, type Dispatch, type SetStateAction } from "react";
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

    function handleRequestReceived(payload: unknown) {
      if (typeof payload !== "string") return;
      const requesterId = payload;
      let cancelled = false;
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
          if (cancelled) return;
        });
      return () => {
        cancelled = true;
      };
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
    return onFriendRequestSent((userId) => {
      let cancelled = false;
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
          if (cancelled) return;
        });
      return () => {
        cancelled = true;
      };
    });
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
  useEffect(() => {
    if (acceptedFriendIds.length === 0) return;
    const ids = acceptedFriendIds.split(",");
    const interval = window.setInterval(() => {
      // One bulk presence lookup instead of a full getUserProfile per
      // friend (see getPresence's own comment) - each tick used to burn a
      // full profile fetch (plus its own blocked-by-target DB query) per
      // friend on screen just to read one boolean.
      getPresence(ids)
        .then((presence) => {
          setFriends((previous) =>
            previous.map((friend) =>
              friend.id in presence
                ? { ...friend, online: presence[friend.id] }
                : friend
            )
          );
        })
        .catch(() => {
          // best-effort - the next tick will retry
        });
    }, PRESENCE_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [acceptedFriendIds, setFriends]);
}
