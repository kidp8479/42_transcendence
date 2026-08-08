import { memo } from "react";
import { Avatar } from "flowbite-react";
import {
  hasPresence,
  initialsOf,
  presenceLabel,
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
        {/* Gate and label come from friendProfile.ts's hasPresence/
            presenceLabel (shared with ProfilePanel's PresenceBadge) - a
            block shouldn't quietly reshape the layout, so BLOCKED keeps the
            dot instead of hiding it, reading "Blocked" rather than a real
            presence value that side has no business seeing (see
            presenceLabel's own comment). */}
        {hasPresence(friend.status) && (
          <>
            <span
              aria-hidden="true"
              className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-base ${
                presenceLabel(friend.status, friend.online) === "Online"
                  ? "bg-status-completed"
                  : "bg-text-muted"
              }`}
            />
            {/* The dot above is color-only and aria-hidden - this is the
                text equivalent, so the connection status isn't lost to
                screen reader users browsing the list. */}
            <span className="sr-only">
              {presenceLabel(friend.status, friend.online)}
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
