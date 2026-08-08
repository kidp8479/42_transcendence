// Friends page (/friends) - browse friends/requests/blocked users on the
// left, inspect and act on one relationship on the right. Mirrors chat.tsx's
// two-pane layout (pick someone on the left, act on them on the right) since
// the interaction shape is the same.
//
// This file owns the page's state and every action that mutates a
// relationship; FriendRow and ProfilePanel (components/friends/) are pure
// presentation, and useFriendsRealtime (hooks/) owns keeping that state in
// sync with events the page didn't itself cause. See friendsApi.ts for the
// API layer and friendProfile.ts for the FriendProfile view model shared by
// all of the above.
import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { FriendRow } from "@/components/friends/FriendRow";
import { ProfilePanel } from "@/components/friends/ProfilePanel";
import { useFriendsRealtime } from "@/hooks/useFriendsRealtime";
import { useToast } from "@/hooks/useToast";
import { authSessionResource } from "@/lib/authState";
import { friendCountResource } from "@/lib/friendCountState";
import {
  toFriendProfile,
  type FriendProfile,
  type FriendshipStatus,
} from "@/lib/friendProfile";
import {
  deriveFriendshipStatus,
  getUserRelationship,
  getUserRelationships,
  groupRelationshipsByOtherUser,
  removeFriendRelationship,
  sendFriendRequest,
  splitRelationshipPair,
  updateFriendRelationship,
} from "@/lib/friendsApi";
import { getUserProfile } from "@/lib/usersApi";

// ?userId=<id> - how search (SearchResultLinks.tsx's UserResultLink) opens a
// profile that isn't a friend yet: it links straight here instead of to its
// own page, so the existing two-pane layout and action handlers below just
// work for a stranger too (see FriendsPage's focusedProfile state).
interface FriendsPageSearch {
  userId?: string;
}

export const Route = createFileRoute("/_authenticated/friends")({
  validateSearch: (search: Record<string, unknown>): FriendsPageSearch => ({
    userId: typeof search.userId === "string" ? search.userId : undefined,
  }),
  component: FriendsPage,
});

// Focus targets for the mobile list<->profile transition (see FriendsPage's
// mobileView effect) - switching panes hides whatever was focused (the
// FriendRow button, or the back button), which otherwise drops a
// keyboard/screen reader user's focus to the document body with no
// indication anything changed.
const FRIENDS_LIST_ID = "friends-list";
const PROFILE_HEADING_ID = "friend-profile-heading";

// Groups the caller's directional rows by the other user on each one, turns
// each pair into a single display status (deriveFriendshipStatus), then
// resolves every surviving other-user id into a profile. A profile lookup
// that fails (ex: the other account was deleted) just drops that one entry -
// not worth failing the whole page over.
async function loadFriends(currentUserId: string): Promise<FriendProfile[]> {
  const relationships = await getUserRelationships();
  const byOtherUser = groupRelationshipsByOtherUser(
    relationships,
    currentUserId
  );

  const entries = Array.from(byOtherUser.entries())
    .map(([otherId, { mine, theirs }]) => ({
      otherId,
      status: deriveFriendshipStatus(mine, theirs),
    }))
    .filter((entry) => entry.status !== "NONE");

  const settled = await Promise.allSettled(
    entries.map(({ otherId }) => getUserProfile(otherId))
  );

  const friends: FriendProfile[] = [];
  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      friends.push(toFriendProfile(result.value, entries[index].status));
    }
  });
  return friends;
}

// Resolves one specific user into a FriendProfile, whatever their status -
// unlike loadFriends, this doesn't assume a relationship already exists
// (that's the whole point: it's how a search result that isn't a friend yet
// gets a profile to show at all). getUserRelationship returns 0-2 rows for
// just this pair; the mine/theirs split mirrors loadFriends' own grouping,
// just for a single id instead of the caller's whole list.
async function loadFocusedProfile(
  currentUserId: string,
  targetId: string
): Promise<FriendProfile> {
  const [profile, relationships] = await Promise.all([
    getUserProfile(targetId),
    getUserRelationship(targetId),
  ]);

  const { mine, theirs } = splitRelationshipPair(relationships, currentUserId);

  return toFriendProfile(profile, deriveFriendshipStatus(mine, theirs));
}

function FriendsPage() {
  const { showToast } = useToast();
  const { userId: focusedUserId } = Route.useSearch();
  // A click on a search result for someone already named in the URL (ex: A
  // removed B, then searches and clicks B again without ever leaving
  // /friends?userId=B) commits to the exact same location the router is
  // already on. TanStack Router's commitLocation skips the history push
  // entirely in that case (see @tanstack/router-core's isSameUrl/isSameState
  // check), so focusedUserId below stays the same string and the effect that
  // fetches it never re-runs on its own. `loadedAt`, unlike the
  // location/search objects, is bumped on every completed navigation attempt
  // - including that same-URL one - so it's what tells "the user revisited
  // this profile" apart from "nothing happened".
  const loadedAt = useRouterState({ select: (state) => state.loadedAt });
  const authState = authSessionResource.getState();
  const currentUserId =
    authState?.status === "authenticated" ? authState.session.user.id : null;

  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // A profile opened from search that isn't in `friends` (no relationship
  // exists yet) - kept separate from the relationships-backed list rather
  // than injected into it, so it never has to be reconciled back out if the
  // user navigates away without acting on it. `friends.find` below always
  // wins over this once the id genuinely has a relationship (see setStatus).
  const [focusedProfile, setFocusedProfile] = useState<FriendProfile | null>(
    null
  );
  // Below md, the friends list and the profile panel can't fit side-by-side,
  // so only one shows at a time - same pattern as chat.tsx's mobileView.
  const [mobileView, setMobileView] = useState<"list" | "profile">("list");

  const selected =
    friends.find((friend) => friend.id === selectedId) ??
    (focusedProfile?.id === selectedId ? focusedProfile : null);

  useEffect(() => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadFriends(currentUserId)
      .then((loaded) => {
        if (cancelled) return;
        setFriends(loaded);
        setSelectedId((current) => current ?? loaded[0]?.id ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        showToast({ type: "error", message: "Could not load your friends." });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showToast is stable
  }, [currentUserId]);

  // Opens the profile named by ?userId= (see SearchResultLinks.tsx) even if
  // it's nobody's friend yet. Always fetches, regardless of whether the id
  // already happens to be in `friends` - the `selected` derivation above
  // prefers the `friends` entry when both exist, so a redundant fetch here
  // is harmless, and avoiding it would mean reading `friends` from this
  // effect without depending on it (it changes every poll tick - see
  // useFriendsRealtime's own comment) just to dodge an occasional extra GET.
  useEffect(() => {
    if (!currentUserId || !focusedUserId) return;
    let cancelled = false;
    loadFocusedProfile(currentUserId, focusedUserId)
      .then((profile) => {
        if (cancelled) return;
        setFocusedProfile(profile);
        setSelectedId(profile.id);
        setMobileView("profile");
      })
      .catch(() => {
        if (cancelled) return;
        showToast({ type: "error", message: "Could not load this profile." });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showToast is stable
  }, [currentUserId, focusedUserId, loadedAt]);

  // Once the general list load (or a live socket event) catches up and adds
  // this id to `friends` for real, the standalone copy is just dead weight -
  // drop it so it can't go stale next to the one that's actually kept live.
  useEffect(() => {
    if (focusedProfile && friends.some((f) => f.id === focusedProfile.id)) {
      setFocusedProfile(null);
    }
  }, [friends, focusedProfile]);

  useFriendsRealtime(
    currentUserId,
    friends,
    setFriends,
    setFocusedProfile,
    setSelectedId
  );

  // Moves focus into whichever pane just became the active one, so a
  // keyboard/screen reader user isn't left on an element that just vanished
  // (see FRIENDS_LIST_ID/PROFILE_HEADING_ID's own comment). Skipped on the
  // very first render - mobileView already starts at "list", and grabbing
  // focus on page load (before the user has done anything) would be its own
  // a11y bug.
  const isInitialMobileView = useRef(true);
  useEffect(() => {
    if (isInitialMobileView.current) {
      isInitialMobileView.current = false;
      return;
    }
    const targetId =
      mobileView === "profile" ? PROFILE_HEADING_ID : FRIENDS_LIST_ID;
    document.getElementById(targetId)?.focus();
  }, [mobileView]);

  function setStatus(id: string, status: FriendshipStatus) {
    setFriends((previous) => {
      if (previous.some((friend) => friend.id === id)) {
        return previous.map((friend) =>
          friend.id === id ? { ...friend, status } : friend
        );
      }
      // Not in the relationships list yet - this is focusedProfile
      // transitioning for the first time (ex: a friend request just sent
      // from a search result). It now genuinely has a relationship row, so
      // it belongs in `friends` from here on: future socket events
      // (friends:request-accepted, etc.) only ever look for it there by id.
      if (focusedProfile?.id === id) {
        return [...previous, { ...focusedProfile, status }];
      }
      return previous;
    });
  }

  function removeFromList(id: string) {
    setFriends((previous) => previous.filter((friend) => friend.id !== id));
    setFocusedProfile((previous) => (previous?.id === id ? null : previous));
    setSelectedId((current) => (current === id ? null : current));
  }

  // useCallback with an empty dep array (setSelectedId/setMobileView are
  // both stable setters) so every FriendRow gets the same onClick reference
  // across renders - FriendRow is memoized (see its own comment) on that
  // assumption. An inline `() => {...}` per row here would hand memo a new
  // prop every render regardless of whether that row's own data changed.
  const handleSelectFriend = useCallback((id: string) => {
    setSelectedId(id);
    setMobileView("profile");
  }, []);

  async function handleAddFriend() {
    if (!selected) return;
    try {
      await sendFriendRequest(selected.id);
      setStatus(selected.id, "PENDING_OUTGOING");
    } catch {
      showToast({
        type: "error",
        message: "Could not send this friend request.",
      });
    }
  }

  async function handleAccept() {
    if (!selected) return;
    try {
      await updateFriendRelationship(selected.id, "ACCEPTED");
      setStatus(selected.id, "ACCEPTED");
      // The other side's "friends:request-accepted" push only reaches them,
      // never the caller who just performed the accept - apply it locally
      // instead (see friendCountState.ts's own comment).
      friendCountResource.adjust(1);
    } catch {
      showToast({
        type: "error",
        message: "Could not accept this friend request.",
      });
    }
  }

  async function handleDecline() {
    if (!selected) return;
    try {
      await removeFriendRelationship(selected.id);
      removeFromList(selected.id);
    } catch {
      showToast({
        type: "error",
        message: "Could not decline this friend request.",
      });
    }
  }

  async function handleCancelRequest() {
    if (!selected) return;
    try {
      await removeFriendRelationship(selected.id);
      removeFromList(selected.id);
    } catch {
      showToast({
        type: "error",
        message: "Could not cancel this friend request.",
      });
    }
  }

  async function handleBlock() {
    if (!selected) return;
    const wasAccepted = selected.status === "ACCEPTED";
    try {
      await updateFriendRelationship(selected.id, "BLOCKED");
      setStatus(selected.id, "BLOCKED");
      // Only a settled friendship counted toward the dashboard tile in the
      // first place - blocking a pending/stranger relationship leaves it
      // unchanged.
      if (wasAccepted) {
        friendCountResource.adjust(-1);
      }
    } catch {
      showToast({ type: "error", message: "Could not block this user." });
    }
  }

  async function handleUnblock() {
    if (!selected || !currentUserId) return;
    try {
      await updateFriendRelationship(selected.id, "ACCEPTED");
      // Unblocking only ever touches the caller's own row, so it can't
      // assume ACCEPTED on both sides the way handleAccept can - the other
      // side's row might not be there any more (ex: they removed the
      // relationship while blocked; remove() excludes BLOCKED rows from that
      // delete on purpose, so only the caller's row survived to be
      // unblocked - see user-relationships.service.ts). Re-deriving from
      // both directional rows, the same way loadFocusedProfile does, is what
      // tells "we're friends again" apart from "nothing left to unblock".
      const relationships = await getUserRelationship(selected.id);
      const { mine, theirs } = splitRelationshipPair(
        relationships,
        currentUserId
      );
      const derived = deriveFriendshipStatus(mine, theirs);
      if (derived === "NONE") {
        removeFromList(selected.id);
      } else {
        setStatus(selected.id, derived);
      }
      if (derived === "ACCEPTED") {
        friendCountResource.adjust(1);
      }
    } catch {
      showToast({ type: "error", message: "Could not unblock this user." });
    }
  }

  async function handleRemove() {
    if (!selected) return;
    try {
      await removeFriendRelationship(selected.id);
      removeFromList(selected.id);
      friendCountResource.adjust(-1);
    } catch {
      showToast({ type: "error", message: "Could not remove this friend." });
    }
  }

  return (
    // Same h-[calc(100vh-134px)] viewport-height hack as chat.tsx - see that
    // file's comment for why (SideBarCmp's own chrome height constant).
    <div className="flex h-[calc(100vh-134px)] min-h-0 flex-col overflow-hidden">
      <div className="mb-2 border-b border-surface-border p-6">
        <h1 className="font-mono text-xl font-bold text-text-primary">
          Friends
        </h1>
        <p className="text-xs text-text-secondary">
          Manage your friends, pending requests, and blocked users.
        </p>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside
          id={FRIENDS_LIST_ID}
          // -1: focusable only by the mobile back-navigation effect above,
          // never by Tab - it's a landmark to land on, not a stop in the
          // normal tab order.
          tabIndex={-1}
          className={`w-full shrink-0 overflow-y-auto border-r border-surface-border md:block md:w-72 ${
            mobileView === "profile" ? "hidden" : "block"
          }`}
        >
          {friends.length === 0 ? (
            <p role="status" className="p-4 text-xs text-text-secondary">
              {loading ? "Loading friends..." : "No friends yet."}
            </p>
          ) : (
            friends.map((friend) => (
              <FriendRow
                key={friend.id}
                friend={friend}
                active={friend.id === selectedId}
                onSelect={handleSelectFriend}
              />
            ))
          )}
        </aside>

        <section
          className={`min-h-0 flex-1 flex-col md:flex ${
            mobileView === "list" ? "hidden" : "flex"
          }`}
        >
          {!selected ? (
            <div className="flex flex-1 items-center justify-center text-sm text-text-secondary">
              Select someone on the left to see their profile.
            </div>
          ) : (
            <ProfilePanel
              friend={selected}
              headingId={PROFILE_HEADING_ID}
              onBack={() => setMobileView("list")}
              onAddFriend={() => void handleAddFriend()}
              onAccept={() => void handleAccept()}
              onDecline={() => void handleDecline()}
              onCancelRequest={() => void handleCancelRequest()}
              onBlock={() => void handleBlock()}
              onUnblock={() => void handleUnblock()}
              onRemove={() => void handleRemove()}
            />
          )}
        </section>
      </div>
    </div>
  );
}
