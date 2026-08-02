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

interface TaskAssigneesProps {
  assignees: TaskAssigneeUser[];
  // avatars shown before collapsing the rest into a "+N" chip
  maxVisible?: number;
}

// lib/categoryColorPalette.ts). The ring makes overlapped avatars readable
// against each other.
const AVATAR_CLASS =
  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-surface-raised";

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

export function TaskAssignees({
  assignees,
  maxVisible = 3,
}: TaskAssigneesProps) {
  if (assignees.length === 0) {
    return null;
  }

  const visible_assignees = assignees.slice(0, maxVisible);
  const hidden_count = assignees.length - visible_assignees.length;

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
            {assignee.username.slice(0, 2).toUpperCase()}
            <span className="sr-only">{assignee.username}</span>
          </span>
        )
      )}
      {hidden_count > 0 && (
        <span
          className={`${AVATAR_CLASS} bg-surface-overlay text-text-secondary`}
          title={assignees
            .slice(maxVisible)
            .map((assignee) => assignee.username)
            .join(", ")}
        >
          +{hidden_count}
        </span>
      )}
    </div>
  );
}
