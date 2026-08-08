import { memo } from "react";
import { Avatar } from "flowbite-react";
import {
  initialsOf,
  type FriendProfile,
  type FriendshipStatus,
} from "@/lib/friendProfile";

// Only shown for a relationship that isn't settled yet - an accepted friend
// or a blocked user don't need an extra status line under their name, the
// section they're grouped under already says that.
const PENDING_STATUS_LABEL: Partial<Record<FriendshipStatus, string>> = {
  PENDING_INCOMING: "Wants to be friends",
  PENDING_OUTGOING: "Request sent",
};

// Memoized: the friends list re-renders every 20s presence-poll tick with a
// new top-level `friends` array reference (see useFriendsRealtime.ts), which
// would otherwise re-render every row even when most friends' displayed data
// didn't change. Only pays off as long as `friend`/`onSelect` keep a stable
// reference across ticks for rows nothing changed on - see friends.tsx's own
// comments on the presence-poll merge and the memoized onSelect callback.
// Takes `onSelect(id)` rather than a bare `onClick`, specifically so
// friends.tsx can pass one memoized function shared by every row instead of
// a fresh `() => handleSelect(friend.id)` closure per row per render - the
// latter would hand memo a "new" prop every time regardless of this
// component's own memoization.
export const FriendRow = memo(function FriendRow({
  friend,
  active,
  onSelect,
}: {
  friend: FriendProfile;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const pendingLabel = PENDING_STATUS_LABEL[friend.status];
  return (
    <button
      type="button"
      onClick={() => onSelect(friend.id)}
      aria-current={active ? "true" : undefined}
      className={`flex w-full items-center gap-3 border-b border-surface-border px-4 py-3 text-left transition-colors hover:bg-surface-overlay ${
        active ? "bg-surface-overlay" : ""
      }`}
    >
      <div className="relative shrink-0">
        <Avatar
          img={friend.avatarUrl ?? undefined}
          placeholderInitials={initialsOf(friend)}
          rounded
          size="sm"
        />
        {/* Presence hidden for a pending relationship - it isn't a "friend"
            yet, so their connection status stays private the same way it
            would be for a stranger. BLOCKED keeps the dot instead of hiding
            it (a block shouldn't quietly reshape the layout) - this row only
            ever renders BLOCKED on the blocker's own side (a block is never
            observable from the blocked side, see friendsApi.ts's
            deriveFriendshipStatus), so it reads "Blocked" rather than a real
            presence value that side has no business seeing anyway. */}
        {(friend.status === "ACCEPTED" || friend.status === "BLOCKED") && (
          <>
            <span
              aria-hidden="true"
              className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-base ${
                friend.status === "ACCEPTED" && friend.online
                  ? "bg-status-completed"
                  : "bg-text-muted"
              }`}
            />
            {/* The dot above is color-only and aria-hidden - this is the
                text equivalent, so the connection status isn't lost to
                screen reader users browsing the list. */}
            <span className="sr-only">
              {friend.status === "BLOCKED"
                ? "Blocked"
                : friend.online
                  ? "Online"
                  : "Offline"}
            </span>
          </>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-text-primary">
          {friend.displayedName}
        </span>
        {pendingLabel && (
          <span className="block truncate text-xs text-text-secondary">
            {pendingLabel}
          </span>
        )}
      </div>
    </button>
  );
});
