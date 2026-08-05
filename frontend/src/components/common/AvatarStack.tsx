// See DefenseReadiness.tsx (components/summary) for an explanation of the
// pattern every component here follows.
//
// Overlapping row of assignee avatars, read-only, shown on a kanban card. The
// drawer needs the same avatars as toggle buttons, so it builds its own from
// assigneeColorIndex below rather than reusing this. Same initials recipe as
// Team Workload; a user with an avatarUrl gets the image instead (User.avatarUrl
// in schema.prisma: "if null, the frontend generates an avatar from initials").
import { CATEGORY_COLOR_PALETTE } from "@/lib/categoryColorPalette";
import type { TaskAssigneeUser } from "@/lib/tasks";

interface AvatarStackProps {
  assignees: TaskAssigneeUser[];
  // avatars shown before collapsing the rest into a "+N" chip
  maxVisible?: number;
}

// lib/categoryColorPalette.ts). The ring makes overlapped avatars readable
// against each other.
// `relative` is load-bearing, not decoration: the sr-only labels inside are
// position:absolute, and an absolute box is only clipped by a POSITIONED
// ancestor. The column's card list is deliberately unpositioned (see
// KanbanColumn), so without this the labels escaped every scroller up to
// ProjectLayout's anchor, each one parked at its card's un-scrolled offset -
// enough of them and the whole tab area became scrollable onto empty space.
const AVATAR_CLASS =
  "relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-surface-raised";

// Deterministic palette index from the username, so a member keeps the same
// avatar color everywhere on the board. Mock-only shortcut: User has no color
// field in schema.prisma yet (Team Workload notes the same gap) - replace
// with the real per-user color when one exists.
export function assigneeColorIndex(username: string): number {
  let char_code_sum = 0;
  for (const char of username) {
    char_code_sum += char.charCodeAt(0);
  }
  return char_code_sum % CATEGORY_COLOR_PALETTE.length;
}

export function AvatarStack({
  assignees,
  maxVisible = 3,
}: AvatarStackProps) {
  if (assignees.length === 0) {
    return null;
  }

  const visible_assignees = assignees.slice(0, maxVisible);
  const hidden_count = assignees.length - visible_assignees.length;
  const hidden_names = assignees
    .slice(maxVisible)
    .map((assignee) => assignee.username)
    .join(", ");

  return (
    <div className="flex -space-x-1.5">
      {visible_assignees.map((assignee) =>
        assignee.avatarUrl !== null ? (
          <img
            key={assignee.id}
            src={assignee.avatarUrl}
            alt={assignee.username}
            title={assignee.username}
            className={`${AVATAR_CLASS} object-cover`}
          />
        ) : (
          <span
            key={assignee.id}
            title={assignee.username}
            className={`${AVATAR_CLASS} ${CATEGORY_COLOR_PALETTE[assigneeColorIndex(assignee.username)].bg}`}
          >
            {/* initials are decoration for the name below them - left visible
                they were announced first, giving "AN Anna" */}
            <span aria-hidden="true">
              {assignee.username.slice(0, 2).toUpperCase()}
            </span>
            <span className="sr-only">{assignee.username}</span>
          </span>
        )
      )}
      {hidden_count > 0 && (
        // "+2" read aloud on its own means nothing, so it is hidden from
        // assistive tech and replaced by the names it stands for. title only
        // covers pointer users - it is not reliably announced on a plain span.
        <span
          className={`${AVATAR_CLASS} bg-surface-overlay text-text-secondary`}
          title={hidden_names}
        >
          <span aria-hidden="true">+{hidden_count}</span>
          <span className="sr-only">
            {hidden_count} more {hidden_count === 1 ? "assignee" : "assignees"}:{" "}
            {hidden_names}
          </span>
        </span>
      )}
    </div>
  );
}
