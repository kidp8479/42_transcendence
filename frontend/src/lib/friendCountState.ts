// Shared, app-wide "how many settled (ACCEPTED) friendships does the caller
// have" store - dashboard.tsx's Friends tile is the only consumer today, but
// this lives outside React as a plain external store (same shape as
// chatUnreadState.ts's ChatUnreadResource) so it can be kept live over the
// socket without every consumer re-subscribing and re-fetching on its own.
import { getRealtimeSocket } from "./realtimeSocket";
import { authSessionResource } from "./authState";
import { getAcceptedFriendCount, parseUserRelationship } from "./friendsApi";

type Listener = () => void;

class FriendCountResource {
  private count: number | null = null;
  private listeners = new Set<Listener>();
  private started = false;

  getState(): number | null {
    return this.count;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    this.ensureStarted();
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Local optimistic adjustment - friends.tsx calls this right after an
  // action that changes the caller's OWN settled-friendship count (accept,
  // remove, block, unblock), the same way chatUnreadResource.markRead lets
  // the acting page skip waiting on a round trip. The socket event below only
  // ever covers the other side accepting a request the caller sent (see
  // user-relationships.service.ts's update() - it emits to the addressee,
  // never back to the acting user), so the caller's own actions need this
  // instead.
  adjust(delta: number): void {
    if (this.count === null) return;
    this.count += delta;
    this.notify();
  }

  // Full refetch rather than a local delta - used where the caller can't
  // cheaply know whether the change actually affected the ACCEPTED count
  // (ex: a "relationship removed" push covers declines/cancels too, which
  // never counted toward this in the first place) without re-deriving
  // deriveFriendshipStatus itself, which getAcceptedFriendCount already does.
  refresh(): void {
    const authState = authSessionResource.getState();
    if (authState?.status !== "authenticated") return;
    getAcceptedFriendCount(authState.session.user.id)
      .then((count) => {
        this.count = count;
        this.notify();
      })
      .catch(() => {
        // background badge, not a user action - no toast
      });
  }

  private ensureStarted(): void {
    if (this.started) return;
    this.started = true;

    this.refresh();
    const socket = getRealtimeSocket();
    // socket.io never replays events missed while disconnected - same
    // reasoning as chatUnreadState.ts's own "connect" refetch.
    socket.on("connect", () => this.refresh());
    // Someone the caller sent a request to just accepted it - the caller's
    // own directional row wasn't touched by this update, only the other
    // side's, so a plain +1 (rather than a full refetch) is enough.
    socket.on("friends:request-accepted", (payload: unknown) => {
      if (parseUserRelationship(payload) === null) return;
      this.adjust(1);
    });
    // A friendship the caller didn't touch just ended (the other side
    // declined/cancelled/unfriended) - unlike request-accepted, this can
    // land on a relationship that was never ACCEPTED to begin with (ex: a
    // declined pending request), so a full refresh is simpler and safer
    // than guessing at a delta here.
    socket.on("friends:relationship-removed", (payload: unknown) => {
      if (typeof payload !== "string") return;
      this.refresh();
    });
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const friendCountResource = new FriendCountResource();
