import { memo } from "react";
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
import { LuUserCheck, LuUserPlus } from "react-icons/lu";
import { darkDropdownTheme } from "@/lib/flowbite";
import {
  hasPresence,
  initialsOf,
  presenceLabel,
  type FriendProfile,
  type FriendshipStatus,
} from "@/lib/friendProfile";

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

// Contextual heading shown above the action pills - without it "Accept" /
// "Decline" on their own don't say what's being accepted or declined.
// NONE has no pill (adding a friend lives in the header's + icon only);
// ACCEPTED/BLOCKED act via the cogwheel menu instead.
const ACTION_COPY: Partial<Record<FriendshipStatus, string>> = {
  PENDING_INCOMING: `You've received a friend request`,
  PENDING_OUTGOING: "Friend request sent",
};

// Gate (only ACCEPTED/BLOCKED get a badge at all) and label come from
// friendProfile.ts's hasPresence/presenceLabel - shared with FriendRow's own
// presence dot, see presenceLabel's own comment for why BLOCKED always reads
// "Blocked" regardless of the real online value.
function PresenceBadge({
  status,
  online,
}: {
  status: "ACCEPTED" | "BLOCKED";
  online: boolean;
}) {
  const label = presenceLabel(status, online);
  // Same pill shape as the project status badges (ProjectCard.tsx's
  // STATUS_META) rather than flowbite-react's <Badge> - that component's
  // built-in colors don't map onto this app's status-* tokens, and this repo
  // already has an established "status pill" pattern to match instead.
  return (
    <span
      className={`w-fit rounded-md px-1 py-0.5 text-[10px] font-semibold ${
        label === "Online"
          ? "bg-status-completed/15 text-status-completed"
          : "bg-control-error/15 text-control-error"
      }`}
    >
      {label}
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
  // Plain div/p, not dl/dt/dd: a real description list requires each dt/dd
  // pair to be a direct child of the dl (or of a wrapper div containing only
  // dt/dd) - the icon in between breaks that, which would leave the
  // term/value relationship unreliable for screen readers. Reading the label
  // then the value in document order already reads the same way sighted
  // users see it, no list semantics needed for that.
  return (
    <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-overlay p-3">
      <Icon
        className="h-4 w-4 shrink-0 text-text-secondary"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-[10px] leading-tight text-text-secondary">{label}</p>
        <p className="truncate text-xs text-text-primary">{value}</p>
      </div>
    </div>
  );
}

// Memoized per the same reasoning as FriendRow - though as the single
// focused-profile pane (not a list item), this only pays off if `friend` and
// the handler props themselves stay referentially stable across a re-render
// that didn't actually change this profile (ex: friends.tsx's handlers
// would need useCallback for that to hold - not yet done, so this mostly
// guards against future re-renders that don't touch friend/handlers at all).
export const ProfilePanel = memo(function ProfilePanel({
  friend,
  email,
  headingId,
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
  // Fetched separately from `friend` (see usersApi.ts's getFriendEmail) and
  // only non-null for a genuinely ACCEPTED pair - null just means "don't
  // show the row", not an error state, so no separate loading/error prop.
  email: string | null;
  headingId: string;
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
          <h2
            id={headingId}
            // -1: focusable only by the page's mobile pane-switch effect,
            // not by Tab.
            tabIndex={-1}
            className="text-sm font-semibold text-text-primary"
          >
            Profile
          </h2>
        </div>

        <div className="flex items-center gap-1">
          {/* Discord-style quick relationship indicator: + to send a request,
              a tick to accept one that's waiting on me. Nothing shown once
              already friends - removing lives in the menu below, not here.
              Blocked/outgoing stay on the explicit buttons further down - a
              single icon can't express "cancel" or "unblock". */}
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
        {/* Stacked and centered below sm (same shape as UserSettingsPage's
            own avatar block) - side by side with the avatar only once there's
            room for both without cramming. */}
        <div className="flex flex-col items-center gap-4 border-b border-surface-border pb-6 sm:flex-row sm:gap-8">
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
            {hasPresence(friend.status) && (
              <PresenceBadge status={friend.status} online={friend.online} />
            )}
          </div>

          {/* Uncapped (w-full) while stacked under the avatar on a phone,
              capped once it sits beside it - otherwise the info rows
              stretch the full remaining width on a wide screen. */}
          <div className="flex w-full min-w-0 flex-col gap-2.5 sm:max-w-md sm:px-4">
            <InfoRow
              icon={HiOutlineUser}
              label="Name"
              value={
                `${friend.firstName} ${friend.lastName}`.trim() ||
                friend.username
              }
            />
            {email && (
              <InfoRow icon={HiOutlineEnvelope} label="Email" value={email} />
            )}
            <InfoRow
              icon={HiOutlineAcademicCap}
              label="Campus"
              value={friend.campus ?? "Unknown"}
            />
          </div>
        </div>

        {ACTION_COPY[friend.status] && (
          <div className="flex flex-col gap-3 pt-6">
            {/* h3, not p: it's a heading for the action(s) below it (nests
                under this panel's own h2 "Profile"), not a paragraph of
                content - screen reader users can jump straight to it via
                heading navigation instead of reading the whole panel. */}
            <h3 className="text-sm font-semibold text-text-primary">
              {ACTION_COPY[friend.status]}
            </h3>

            {/* Stacked full-width on a phone (flex-col's default
                align-items: stretch already does the widening, no w-full
                needed on the buttons themselves) - a row of two half-width
                buttons is a small tap target on a narrow screen. Same
                sm:flex-row hand-off as UserSettingsPage's own button rows. */}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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
});
