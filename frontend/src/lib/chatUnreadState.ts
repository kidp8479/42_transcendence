// Shared, app-wide "which projects have an unread chat message" store - the
// Chat nav item (SideBarCmp) and the conversation list (chat.tsx) are
// siblings under the same layout, neither one owning the other, so this
// lives outside React as a plain external store (same shape as
// AuthSessionResource in authState.ts) instead of prop-drilling or a
// context tied to one of the two.
import { getRealtimeSocket } from "./realtimeSocket";
import { fetchUnreadChatProjectIds, parseChatMessage } from "./chatApi";
import { authSessionResource } from "./authState";

type Listener = () => void;

class ChatUnreadResource {
  private projectIds: Set<string> = new Set();
  // The conversation currently open on the Chat page, if any - a message
  // landing here shouldn't light up a badge for something already on
  // screen. Set/cleared by chat.tsx as the user switches conversations or
  // leaves the page entirely (see its own setActiveProjectId effect).
  private activeProjectId: string | null = null;
  // Cached derived view (projectIds minus activeProjectId) - recomputed only
  // on actual changes, not on every getState() call, so useSyncExternalStore
  // sees a stable reference and doesn't re-render needlessly.
  private snapshot: Set<string> = new Set();
  private listeners = new Set<Listener>();
  private started = false;

  getState(): Set<string> {
    return this.snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    this.ensureStarted();
    return () => {
      this.listeners.delete(listener);
    };
  }

  setActiveProjectId(projectId: string | null): void {
    if (this.activeProjectId === projectId) return;
    this.activeProjectId = projectId;
    this.recomputeSnapshot();
  }

  // Optimistic local removal, called by chat.tsx the moment a conversation
  // is opened - the backend's own read marker is set by that same GET
  // request (see ChatService.findAll), this just avoids waiting on a
  // roundtrip before the dot disappears.
  markRead(projectId: string): void {
    if (this.projectIds.delete(projectId)) {
      this.recomputeSnapshot();
    }
  }

  private ensureStarted(): void {
    if (this.started) return;
    this.started = true;

    const refresh = () => {
      fetchUnreadChatProjectIds()
        .then((ids) => {
          this.projectIds = new Set(ids);
          this.recomputeSnapshot();
        })
        .catch(() => {
          // no toast here - this is a background badge, not a user action
        });
    };

    refresh();
    const socket = getRealtimeSocket();
    // socket.io never replays events missed while disconnected, so a
    // reconnect (dropped wifi, backend restart) needs a full refetch to
    // catch up - same reasoning as NotificationBell's own "connect" refetch.
    socket.on("connect", refresh);
    socket.on("chat:deleted", refresh);
    socket.on("chat:created", (payload: unknown) => {
      const message = parseChatMessage(payload);
      if (message === null) return;
      // an echo of our own message shouldn't flag our own badge, and a
      // message landing in the conversation currently open on screen isn't
      // "unread" either - the user is looking right at it
      const authState = authSessionResource.getState();
      const currentUserId =
        authState?.status === "authenticated"
          ? authState.session.user.id
          : null;
      if (
        message.author?.id === currentUserId ||
        message.projectId === this.activeProjectId
      ) {
        return;
      }
      if (!this.projectIds.has(message.projectId)) {
        this.projectIds.add(message.projectId);
        this.recomputeSnapshot();
      }
    });
    socket.on("project:deleted", refresh);
  }

  private recomputeSnapshot(): void {
    this.snapshot = new Set(
      [...this.projectIds].filter((id) => id !== this.activeProjectId)
    );
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const chatUnreadResource = new ChatUnreadResource();
