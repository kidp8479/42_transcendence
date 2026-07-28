// See DefenseReadiness.tsx (components/summary) for an explanation of the
// pattern every component here follows.
//
// Overlapping row of assignee avatars for a kanban card (small) or the drawer
// (medium). Same initials-avatar recipe as Team Workload; when a user has an
// avatarUrl the image is shown instead (User.avatarUrl in schema.prisma:
// "if null, the frontend generates an avatar from username initials").
import { CATEGORY_COLOR_PALETTE } from "@/lib/categoryColorPalette";
import type { TaskAssigneeUser } from "@/lib/tasks";

interface TaskAssigneesProps {
  assignees: TaskAssigneeUser[];
  // avatars shown before collapsing the rest into a "+N" chip
  maxVisible?: number;
  size?: "sm" | "md";
}

// Both sizes written out whole (no string joining - see the Tailwind note in
// lib/categoryColorPalette.ts). The ring makes overlapped avatars readable
// against each other.
const AVATAR_SIZE_CLASSES = {
  sm: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-surface-raised",
  md: "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-surface-raised",
};

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
  size = "sm",
}: TaskAssigneesProps) {
  if (assignees.length === 0) {
    return null;
  }

  const visible_assignees = assignees.slice(0, maxVisible);
  const hidden_count = assignees.length - visible_assignees.length;
  const avatar_classes = AVATAR_SIZE_CLASSES[size];

  return (
    <div className="flex -space-x-2">
      {visible_assignees.map((assignee) =>
        assignee.avatarUrl !== null ? (
          <img
            key={assignee.id}
            src={assignee.avatarUrl}
            alt={assignee.username}
            title={assignee.username}
            className={`${avatar_classes} object-cover`}
          />
        ) : (
          <span
            key={assignee.id}
            title={assignee.username}
            className={`${avatar_classes} ${CATEGORY_COLOR_PALETTE[assigneeColorIndex(assignee.username)].bg}`}
          >
            {assignee.username.slice(0, 2).toUpperCase()}
            <span className="sr-only">{assignee.username}</span>
          </span>
        )
      )}
      {hidden_count > 0 && (
        <span
          className={`${avatar_classes} bg-surface-overlay text-text-secondary`}
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
