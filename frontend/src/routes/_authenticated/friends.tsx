// Friends page (/friends) - browse friends/requests/blocked users on the
// left, inspect and act on one relationship on the right. Mirrors chat.tsx's
// two-pane layout (pick someone on the left, act on them on the right) since
// the interaction shape is the same.
//
// Backed by /users/user-relationships + /users/:id (see friendsApi.ts and
// usersApi.ts) and kept live over the shared WebSocket for
// "friends:request-received"/"friends:request-accepted" (see
// backend/.../user-relationships.service.ts for where those are emitted).
//
// firstName/lastName aren't tracked by the backend yet (TR-61) - every
// FriendProfile carries them as empty strings on purpose, see
// toFriendProfile below.
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Avatar, Button, Dropdown, DropdownItem } from "flowbite-react";
import {
  HiOutlineAcademicCap,
  HiOutlineCheck,
  HiOutlineCog6Tooth,
  HiOutlineEnvelope,
  HiOutlineLockOpen,
  HiOutlineNoSymbol,
  HiOutlineUser,
  HiOutlineUserMinus,
  HiOutlineXMark,
} from "react-icons/hi2";
import type { IconType } from "react-icons";
import { IoArrowBack } from "react-icons/io5";
import { LuUser, LuUserCheck, LuUserPlus } from "react-icons/lu";
import { darkDropdownTheme } from "@/lib/flowbite";
import { useToast } from "@/hooks/useToast";
import { authSessionResource } from "@/lib/authState";
import { getRealtimeSocket } from "@/lib/realtimeSocket";
import {
  deriveFriendshipStatus,
  getUserRelationships,
  parseUserRelationship,
  removeFriendRelationship,
  sendFriendRequest,
  updateFriendRelationship,
  type RelationshipStatus,
} from "@/lib/friendsApi";
import { getUserProfile, type PublicUserProfile } from "@/lib/usersApi";

export const Route = createFileRoute("/_authenticated/friends")({
  component: FriendsPage,
});

// Same neutral gray button skin as UserSettingsPage's rowUploadButtonClass.
const rowUploadButtonClass = `
  bg-surface-overlay
  dark:bg-surface-overlay!
  text-text-primary
  dark:text-text-primary
  text-xs
  dark:text-xs
  hover:ring-1
  hover:ring-surface-border
  focus:ring-1
  focus:ring-brand-500
  dark:hover:ring-1
  dark:hover:ring-surface-border
  dark:focus:ring-1
  dark:focus:ring-brand-500
`;

type FriendshipStatus =
  | "NONE"
  | "ACCEPTED"
  | "PENDING_INCOMING"
  | "PENDING_OUTGOING"
  | "BLOCKED";

interface FriendProfile {
  id: string;
  firstName: string;
  lastName: string;
  displayedName: string;
  username: string;
  email: string;
  campus: string | null;
  avatarUrl: string | null;
  status: FriendshipStatus;
}

// Only shown for a relationship that isn't settled yet - an accepted friend
// or a blocked user don't need an extra status line under their name in the
// list, the section they're grouped under already says that.
const PENDING_STATUS_LABEL: Partial<Record<FriendshipStatus, string>> = {
  PENDING_INCOMING: "Wants to be friends",
  PENDING_OUTGOING: "Request sent",
};

// Contextual heading shown above the action pills - without it "Accept" /
// "Decline" on their own don't say what's being accepted or declined.
// NONE has no pill anymore (adding a friend lives in the header's + icon
// only); ACCEPTED/BLOCKED act via the cogwheel menu instead.
const ACTION_COPY: Partial<Record<FriendshipStatus, string>> = {
  PENDING_INCOMING: `You've received a friend request`,
  PENDING_OUTGOING: "Friend request sent",
};

// firstName/lastName stay blank until the backend tracks them - see the file
// header comment. displayedName falls back to username, the only name this
// page actually has right now.
function toFriendProfile(
  profile: PublicUserProfile,
  status: FriendshipStatus
): FriendProfile {
  return {
    id: profile.id,
    firstName: "",
    lastName: "",
    displayedName: profile.username,
    username: profile.username,
    email: profile.email,
    campus: profile.campus,
    avatarUrl: profile.avatarUrl,
    status,
  };
}

// Groups the caller's directional rows by the other user on each one, turns
// each pair into a single display status (deriveFriendshipStatus), then
// resolves every surviving other-user id into a profile. A profile lookup
// that fails (ex: the other account was deleted) just drops that one entry -
// not worth failing the whole page over.
async function loadFriends(currentUserId: string): Promise<FriendProfile[]> {
  const relationships = await getUserRelationships();

  const byOtherUser = new Map<
    string,
    { mine?: RelationshipStatus; theirs?: RelationshipStatus }
  >();
  for (const relationship of relationships) {
    const otherId =
      relationship.requesterId === currentUserId
        ? relationship.addresseeId
        : relationship.requesterId;
    const entry = byOtherUser.get(otherId) ?? {};
    if (relationship.requesterId === currentUserId) {
      entry.mine = relationship.status;
    } else {
      entry.theirs = relationship.status;
    }
    byOtherUser.set(otherId, entry);
  }

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

function initialsOf(friend: FriendProfile): string {
  const fromName =
    `${friend.firstName.charAt(0)}${friend.lastName.charAt(0)}`.toUpperCase();
  if (fromName.trim().length > 0) {
    return fromName;
  }
  // No first/last name yet (see the file header comment) - fall back to the
  // username so the avatar placeholder isn't just a blank circle.
  return friend.username.slice(0, 2).toUpperCase();
}

function FriendsPage() {
  const { showToast } = useToast();
  const authState = authSessionResource.getState();
  const currentUserId =
    authState?.status === "authenticated" ? authState.session.user.id : null;

  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Below md, the friends list and the profile panel can't fit side-by-side,
  // so only one shows at a time - same pattern as chat.tsx's mobileView.
  const [mobileView, setMobileView] = useState<"list" | "profile">("list");

  const selected = friends.find((friend) => friend.id === selectedId) ?? null;

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

  // Real-time: another user sending or accepting a friend request updates
  // this page without a reload. Event names/payloads match exactly what
  // backend/.../user-relationships.service.ts emits.
  useEffect(() => {
    if (!currentUserId) return;
    const socket = getRealtimeSocket();

    function handleRequestReceived(payload: unknown) {
      if (typeof payload !== "string") return;
      const requesterId = payload;
      getUserProfile(requesterId)
        .then((profile) => {
          setFriends((previous) =>
            previous.some((friend) => friend.id === requesterId)
              ? previous
              : [...previous, toFriendProfile(profile, "PENDING_INCOMING")]
          );
          showToast({
            type: "success",
            message: `${profile.username} sent you a friend request.`,
          });
        })
        .catch(() => {
          // best-effort - a manual refresh will pick it up
        });
    }

    function handleRequestAccepted(payload: unknown) {
      const relationship = parseUserRelationship(payload);
      if (relationship === null) return;
      // `updated` is the accepter's own row: requesterId is the person who
      // just accepted, addresseeId is us (see the backend emit).
      const otherId = relationship.requesterId;
      setFriends((previous) =>
        previous.map((friend) =>
          friend.id === otherId ? { ...friend, status: "ACCEPTED" } : friend
        )
      );
      showToast({
        type: "success",
        message: "Your friend request was accepted.",
      });
    }

    socket.on("friends:request-received", handleRequestReceived);
    socket.on("friends:request-accepted", handleRequestAccepted);

    return () => {
      socket.off("friends:request-received", handleRequestReceived);
      socket.off("friends:request-accepted", handleRequestAccepted);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- showToast is stable
  }, [currentUserId]);

  function setStatus(id: string, status: FriendshipStatus, message: string) {
    setFriends((previous) =>
      previous.map((friend) =>
        friend.id === id ? { ...friend, status } : friend
      )
    );
    showToast({ type: "success", message });
  }

  function removeFromList(id: string, message: string) {
    setFriends((previous) => previous.filter((friend) => friend.id !== id));
    setSelectedId((current) => (current === id ? null : current));
    showToast({ type: "success", message });
  }

  async function handleAddFriend() {
    if (!selected) return;
    try {
      await sendFriendRequest(selected.id);
      setStatus(
        selected.id,
        "PENDING_OUTGOING",
        `Friend request sent to ${selected.displayedName}.`
      );
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
      setStatus(
        selected.id,
        "ACCEPTED",
        `You are now friends with ${selected.displayedName}.`
      );
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
      removeFromList(selected.id, "Friend request declined.");
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
      removeFromList(selected.id, "Friend request cancelled.");
    } catch {
      showToast({
        type: "error",
        message: "Could not cancel this friend request.",
      });
    }
  }

  async function handleBlock() {
    if (!selected) return;
    try {
      await updateFriendRelationship(selected.id, "BLOCKED");
      setStatus(
        selected.id,
        "BLOCKED",
        `${selected.displayedName} has been blocked.`
      );
    } catch {
      showToast({ type: "error", message: "Could not block this user." });
    }
  }

  async function handleUnblock() {
    if (!selected) return;
    try {
      await updateFriendRelationship(selected.id, "ACCEPTED");
      setStatus(
        selected.id,
        "ACCEPTED",
        `${selected.displayedName} has been unblocked.`
      );
    } catch {
      showToast({ type: "error", message: "Could not unblock this user." });
    }
  }

  async function handleRemove() {
    if (!selected) return;
    try {
      await removeFriendRelationship(selected.id);
      removeFromList(selected.id, "Friend removed.");
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
          className={`w-full shrink-0 overflow-y-auto border-r border-surface-border md:block md:w-72 ${
            mobileView === "profile" ? "hidden" : "block"
          }`}
        >
          {friends.length === 0 ? (
            <p className="p-4 text-xs text-text-secondary">
              {loading ? "Loading friends..." : "No friends yet."}
            </p>
          ) : (
            friends.map((friend) => (
              <FriendRow
                key={friend.id}
                friend={friend}
                active={friend.id === selectedId}
                onClick={() => {
                  setSelectedId(friend.id);
                  setMobileView("profile");
                }}
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

function FriendRow({
  friend,
  active,
  onClick,
}: {
  friend: FriendProfile;
  active: boolean;
  onClick: () => void;
}) {
  const pendingLabel = PENDING_STATUS_LABEL[friend.status];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`flex w-full items-center gap-3 border-b border-surface-border px-4 py-3 text-left transition-colors hover:bg-surface-overlay ${
        active ? "bg-surface-overlay" : ""
      }`}
    >
      <Avatar
        img={friend.avatarUrl ?? undefined}
        placeholderInitials={initialsOf(friend)}
        rounded
        size="sm"
      />
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
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: IconType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-overlay p-3">
      <Icon className="h-4 w-4 shrink-0 text-text-secondary" />
      <div className="min-w-0">
        <dt className="text-[10px] leading-tight text-text-secondary">
          {label}
        </dt>
        <dd className="truncate text-xs text-text-primary">{value}</dd>
      </div>
    </div>
  );
}

function ProfilePanel({
  friend,
  onBack,
  onAddFriend,
  onAccept,
  onDecline,
  onCancelRequest,
  onBlock,
  onUnblock,
  onRemove,
}: {
  friend: FriendProfile;
  onBack: () => void;
  onAddFriend: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onCancelRequest: () => void;
  onBlock: () => void;
  onUnblock: () => void;
  onRemove: () => void;
}) {
  return (
    <>
      <header className="flex items-center justify-between gap-2 border-b border-surface-border px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to friends"
            className="-ml-1 shrink-0 p-1 text-text-secondary hover:text-text-primary md:hidden"
          >
            <IoArrowBack className="h-5 w-5" />
          </button>
          <h2 className="text-sm font-semibold text-text-primary">Profile</h2>
        </div>

        <div className="flex items-center gap-1">
          {/* Discord-style quick relationship indicator: + to send a request,
              a tick to accept one that's waiting on me, a plain friend icon
              once we're already connected (removing lives in the menu below,
              not here). Blocked/outgoing stay on the explicit buttons further
              down - a single icon can't express "cancel" or "unblock". */}
          {friend.status === "NONE" && (
            <button
              type="button"
              onClick={onAddFriend}
              aria-label={`Add ${friend.displayedName} as a friend`}
              className="shrink-0 rounded-md p-1 text-text-muted hover:bg-surface-overlay hover:text-text-primary"
            >
              <LuUserPlus className="h-5 w-5" />
            </button>
          )}
          {friend.status === "PENDING_INCOMING" && (
            <button
              type="button"
              onClick={onAccept}
              aria-label={`Accept ${friend.displayedName}'s friend request`}
              className="shrink-0 rounded-md p-1 text-text-muted hover:bg-surface-overlay hover:text-text-primary"
            >
              <LuUserCheck className="h-5 w-5" />
            </button>
          )}
          {friend.status === "ACCEPTED" && (
            <span
              aria-label="Friends"
              title="Friends"
              className="shrink-0 p-1 text-text-muted"
            >
              <LuUser className="h-5 w-5" />
            </span>
          )}

          {/* Always available regardless of friendship status - block/unblock
              applies to any relationship, not just accepted friends. */}
          <Dropdown
            inline
            arrowIcon={false}
            theme={darkDropdownTheme}
            className="border-solid !border-surface-border dark:border-solid dark:!border-surface-border"
            renderTrigger={() => (
              <button
                type="button"
                aria-label={`Manage ${friend.displayedName}`}
                className="shrink-0 rounded-md p-1 text-text-muted hover:bg-surface-overlay hover:text-text-primary"
              >
                <HiOutlineCog6Tooth className="h-5 w-5" />
              </button>
            )}
          >
            {friend.status === "BLOCKED" ? (
              <DropdownItem onClick={onUnblock}>
                <div className="flex items-center gap-2">
                  <HiOutlineLockOpen className="h-4 w-4" />
                  <span className="text-xs">Unblock</span>
                </div>
              </DropdownItem>
            ) : (
              <DropdownItem onClick={onBlock}>
                <div className="flex items-center gap-2">
                  <HiOutlineNoSymbol className="h-4 w-4" />
                  <span className="text-xs">Block</span>
                </div>
              </DropdownItem>
            )}
            {friend.status === "ACCEPTED" && (
              <DropdownItem className="!text-red-700" onClick={onRemove}>
                <div className="flex items-center gap-2 text-red-700">
                  <HiOutlineUserMinus className="h-4 w-4" />
                  <span className="text-xs">Remove friend</span>
                </div>
              </DropdownItem>
            )}
          </Dropdown>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="flex items-center gap-8 border-b border-surface-border pb-6">
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <Avatar
              img={friend.avatarUrl ?? undefined}
              placeholderInitials={initialsOf(friend)}
              rounded
              size="xl"
            />
            <span className="text-sm font-semibold text-text-primary">
              {friend.username}
            </span>
          </div>

          <dl className="flex w-full max-w-s min-w-0 flex-col px-4 gap-2.5">
            <InfoRow
              icon={HiOutlineUser}
              label="Name"
              value={`${friend.firstName} ${friend.lastName}`.trim()}
            />
            <InfoRow
              icon={HiOutlineEnvelope}
              label="Email"
              value={friend.email}
            />
            <InfoRow
              icon={HiOutlineAcademicCap}
              label="Campus"
              value={friend.campus ?? "Unknown"}
            />
          </dl>
        </div>

        {ACTION_COPY[friend.status] && (
          <div className="flex flex-col gap-3 pt-6">
            <p className="text-sm font-semibold text-text-primary">
              {ACTION_COPY[friend.status]}
            </p>

            <div className="flex flex-wrap gap-2">
              {friend.status === "PENDING_INCOMING" && (
                <>
                  {/* Same green as UserSettingsPage's "Save changes" and same
                      red as its "Delete account" - reuses that page's accept
                      (commit) / destructive color pairing instead of the
                      lighter tint pills used elsewhere on this page. */}
                  <Button
                    className="bg-brand-500 text-gray-900 hover:bg-brand-600 focus:ring-1 focus:ring-green-300 dark:bg-brand-500 dark:text-gray-900 dark:hover:bg-brand-600 dark:focus:ring-green-800"
                    onClick={onAccept}
                  >
                    <HiOutlineCheck className="mr-2 h-5 w-5" />
                    Accept
                  </Button>
                  <Button color="red" onClick={onDecline}>
                    <HiOutlineXMark className="mr-2 h-5 w-5" />
                    Decline
                  </Button>
                </>
              )}

              {friend.status === "PENDING_OUTGOING" && (
                // Same gray as UserSettingsPage's "Cancel" button in the
                // delete-account modal.
                <Button
                  className={rowUploadButtonClass}
                  onClick={onCancelRequest}
                >
                  <HiOutlineXMark className="mr-2 h-5 w-5" />
                  Cancel request
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
