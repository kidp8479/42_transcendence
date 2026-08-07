// Friends page (/friends) - browse friends/requests/blocked users on the
// left, inspect and act on one relationship on the right. Mirrors chat.tsx's
// two-pane layout (pick someone on the left, act on them on the right) since
// the interaction shape is the same.
//
// MOCKUP: the backend's UserRelationship rows only carry
// requesterId/addresseeId (see backend/.../user-relationships.service.ts) -
// there is no endpoint yet to resolve those ids into a profile (name,
// avatar, campus, email) or presence (online). This page runs on local mock
// data until that lookup exists; swap MOCK_FRIENDS and the handlers below
// for real calls to /users/user-relationships once it does.
import { useState } from "react";
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
  online: boolean;
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

const MOCK_FRIENDS: FriendProfile[] = [
  {
    id: "1",
    firstName: "Alice",
    lastName: "Martin",
    displayedName: "alice.m",
    username: "amartin",
    email: "alice.martin@student.42.fr",
    campus: "42 Paris",
    avatarUrl: null,
    status: "ACCEPTED",
    online: true,
  },
  {
    id: "2",
    firstName: "Benoit",
    lastName: "Rousseau",
    displayedName: "benoit_r",
    username: "brousseau",
    email: "benoit.rousseau@student.42.fr",
    campus: "42 Lyon",
    avatarUrl: null,
    status: "PENDING_INCOMING",
    online: false,
  },
  {
    id: "3",
    firstName: "Chloe",
    lastName: "Nguyen",
    displayedName: "chloen",
    username: "cnguyen",
    email: "chloe.nguyen@student.42.fr",
    campus: "42 Paris",
    avatarUrl: null,
    status: "PENDING_OUTGOING",
    online: true,
  },
  {
    id: "4",
    firstName: "David",
    lastName: "Kim",
    displayedName: "dkim",
    username: "dkim",
    email: "david.kim@student.42.fr",
    campus: "42 Seoul",
    avatarUrl: null,
    status: "BLOCKED",
    online: false,
  },
  {
    id: "5",
    firstName: "Elena",
    lastName: "Petrova",
    displayedName: "elena.p",
    username: "epetrova",
    email: "elena.petrova@student.42.fr",
    campus: "42 Berlin",
    avatarUrl: null,
    status: "NONE",
    online: true,
  },
];

function initialsOf(friend: FriendProfile): string {
  return `${friend.firstName.charAt(0)}${friend.lastName.charAt(0)}`.toUpperCase();
}

function FriendsPage() {
  const { showToast } = useToast();
  const [friends, setFriends] = useState<FriendProfile[]>(MOCK_FRIENDS);
  const [selectedId, setSelectedId] = useState<string | null>(
    MOCK_FRIENDS[0]?.id ?? null
  );
  // Below md, the friends list and the profile panel can't fit side-by-side,
  // so only one shows at a time - same pattern as chat.tsx's mobileView.
  const [mobileView, setMobileView] = useState<"list" | "profile">("list");

  const selected = friends.find((friend) => friend.id === selectedId) ?? null;

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
            <p className="p-4 text-xs text-text-secondary">No friends yet.</p>
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
              onAddFriend={() =>
                setStatus(
                  selected.id,
                  "PENDING_OUTGOING",
                  `Friend request sent to ${selected.displayedName}.`
                )
              }
              onAccept={() =>
                setStatus(
                  selected.id,
                  "ACCEPTED",
                  `You are now friends with ${selected.displayedName}.`
                )
              }
              onDecline={() =>
                removeFromList(selected.id, "Friend request declined.")
              }
              onCancelRequest={() =>
                removeFromList(selected.id, "Friend request cancelled.")
              }
              onBlock={() =>
                setStatus(
                  selected.id,
                  "BLOCKED",
                  `${selected.displayedName} has been blocked.`
                )
              }
              onUnblock={() =>
                setStatus(
                  selected.id,
                  "ACCEPTED",
                  `${selected.displayedName} has been unblocked.`
                )
              }
              onRemove={() => removeFromList(selected.id, "Friend removed.")}
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
      <div className="relative shrink-0">
        <Avatar
          img={friend.avatarUrl ?? undefined}
          placeholderInitials={initialsOf(friend)}
          rounded
          size="sm"
        />
        {/* Presence only - green when online, otherwise muted. Not tied to
            friendship status (see PENDING_STATUS_LABEL for that). */}
        <span
          aria-hidden="true"
          className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-base ${
            friend.online ? "bg-status-completed" : "bg-text-muted"
          }`}
        />
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
}

function PresenceBadge({ online }: { online: boolean }) {
  // Same pill shape as the project status badges (ProjectCard.tsx's
  // STATUS_META) rather than flowbite-react's <Badge> - that component's
  // built-in colors don't map onto this app's status-* tokens, and this repo
  // already has an established "status pill" pattern to match instead.
  return (
    <span
      className={`w-fit rounded-md px-1 py-0.5 text-[10px] font-semibold ${
        online
          ? "bg-status-completed/15 text-status-completed"
          : "bg-control-error/15 text-control-error"
      }`}
    >
      {online ? "Online" : "Offline"}
    </span>
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
            <PresenceBadge online={friend.online} />
          </div>

          <dl className="flex w-full max-w-s min-w-0 flex-col px-4 gap-2.5">
            <InfoRow
              icon={HiOutlineUser}
              label="Name"
              value={`${friend.firstName} ${friend.lastName}`}
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
