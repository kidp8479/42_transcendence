// One project card for the /projects grid: icon, status badge, name,
// description, progress bar, member count, deadline (as a J- countdown),
// and a link into the project's summary tab.
//
// Navigation reuses the same TanStack Router <Link> the sidebar uses for its
// own project rows (ProjectRow in navigation/SideBarCmp.tsx), stretched over
// the whole card (absolute inset-0) so clicking anywhere opens the project,
// while staying one real <a> instead of a fake clickable div. The "..."
// trigger renders after it in DOM order inside a `relative` wrapper, so it
// stacks on top and stays independently clickable without needing to nest
// inside, or stop propagation from, that link.
//
// The "..." menu (Manage members / Delete project, added to the Figma
// 2026-07-20) only renders when canManageProject is true - the parent
// derives that from the caller's own project role (see
// routes/_authenticated/projects.tsx).
//
// "Delete project" doesn't call onDeleteProject right away - it swaps the
// whole card for an inline "type the project name to confirm" view first
// (same open/closed toggle idea as NewProjectCard's create form), and only
// fires onDeleteProject once the typed text matches project.name exactly.
import { Link } from "@tanstack/react-router";
import {
  Button,
  Dropdown,
  DropdownDivider,
  DropdownItem,
  TextInput,
} from "flowbite-react";
import { useId, useState } from "react";
import {
  HiOutlineCalendar,
  HiOutlineCog6Tooth,
  HiOutlineFolder,
  HiOutlineTrash,
  HiOutlineUserGroup,
  HiOutlineUsers,
  HiOutlineXMark,
} from "react-icons/hi2";
import { darkDropdownTheme } from "@/lib/flowbite";
import type { ProjectStatus } from "@/lib/projectsApi";

// Scoped to this card's "..." menu only - rounds the item hover highlight
// (rectangular by default in darkDropdownTheme, shared with NotificationBell
// and UserMenu) without touching that shared theme.
const roundedDropdownItemTheme = {
  container: "mx-1",
  base: "rounded-md",
};

// Scoped to the delete-confirmation input only - same black-background
// treatment as NewProjectCard's projectFormInputTheme.
const confirmDeleteInputTheme = {
  field: {
    input: {
      colors: {
        gray: "!border-control-border !bg-black text-text-primary placeholder:!text-text-secondary focus:!border-control-error focus:!ring-2 focus:!ring-red-500/40 focus-visible:!outline-none",
      },
    },
  },
};

const STATUS_META: Record<
  ProjectStatus,
  {
    label: string;
    dot: string;
    text: string;
    badgeBg: string;
    badgeBorder: string;
    hoverBorder: string;
  }
> = {
  IN_PROGRESS: {
    label: "In Progress",
    dot: "bg-status-in-progress",
    text: "text-status-in-progress",
    badgeBg: "bg-status-in-progress/15",
    badgeBorder: "border-status-in-progress/30",
    hoverBorder: "hover:border-status-in-progress/50",
  },
  REVIEW: {
    label: "Review",
    dot: "bg-status-review",
    text: "text-status-review",
    badgeBg: "bg-status-review/15",
    badgeBorder: "border-status-review/30",
    hoverBorder: "hover:border-status-review/50",
  },
  COMPLETED: {
    label: "Completed",
    dot: "bg-status-completed",
    text: "text-status-completed",
    badgeBg: "bg-status-completed/15",
    badgeBorder: "border-status-completed/30",
    hoverBorder: "hover:border-status-completed/50",
  },
};

export interface ProjectCardData {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  // 0-100, computed backend-side from EvaluationChecklistItem.isChecked.
  progress: number;
  // count of ProjectMember rows for this project.
  memberCount: number;
  // ISO date string - null when the project has no deadline set yet
  // (Project.deadline is nullable in schema.prisma and unseeded today).
  deadline: string | null;
}

interface ProjectCardProps {
  project: ProjectCardData;
  canManageProject: boolean;
  onManageMembers?: () => void;
  onDeleteProject?: () => Promise<boolean>;
}

export function ProjectCard({
  project,
  canManageProject,
  onManageMembers,
  onDeleteProject,
}: ProjectCardProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const confirmInputId = useId();

  function handleCancelDelete() {
    setIsConfirmingDelete(false);
    setConfirmText("");
  }

  async function handleConfirmDelete() {
    if (!onDeleteProject) {
      return;
    }
    setIsDeleting(true);
    try {
      if (await onDeleteProject()) {
        handleCancelDelete();
      }
    } finally {
      setIsDeleting(false);
    }
  }

  const status = STATUS_META[project.status];
  const formattedDeadline = project.deadline
    ? new Date(project.deadline).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      })
    : null;

  // Whole calendar days between today and the deadline, ignoring time of
  // day (setHours(0,0,0,0) on both sides) so "tomorrow at 23:00" and
  // "tomorrow at 01:00" both count as J-1.
  const daysUntilDeadline = project.deadline
    ? Math.ceil(
        (new Date(project.deadline).setHours(0, 0, 0, 0) -
          new Date().setHours(0, 0, 0, 0)) /
          86_400_000
      )
    : null;
  const deadlineLabel =
    daysUntilDeadline === null
      ? null
      : daysUntilDeadline >= 0
        ? `J-${daysUntilDeadline}`
        : `J+${Math.abs(daysUntilDeadline)}`;

  if (isConfirmingDelete) {
    const canConfirmDelete = confirmText.trim() === project.name;

    return (
      <div className="flex h-full flex-col gap-3 rounded-lg border border-control-error bg-surface-raised p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-text-primary">Delete project</h3>
          <button
            type="button"
            aria-label="Cancel delete project"
            onClick={handleCancelDelete}
            className="rounded-md p-1 text-text-muted hover:bg-surface-overlay hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          >
            <HiOutlineXMark className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-3">
          <p className="text-sm text-text-secondary">
            Type{" "}
            <span
              title={project.name}
              className="inline-block max-w-full truncate align-bottom font-semibold text-text-primary"
            >
              {project.name}
            </span>{" "}
            to confirm deletion. This cannot be undone.
          </p>

          <label htmlFor={confirmInputId} className="sr-only">
            Project name
          </label>
          <TextInput
            id={confirmInputId}
            autoFocus
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder={project.name}
            theme={confirmDeleteInputTheme}
            value={confirmText}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            onClick={handleConfirmDelete}
            disabled={!canConfirmDelete || isDeleting}
            className="flex-1 bg-control-error text-white! hover:bg-red-700 focus:outline-none focus-visible:outline-none focus:ring-4 focus:ring-red-300 dark:bg-control-error dark:hover:bg-red-700 dark:focus:ring-red-800"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
          <Button
            type="button"
            onClick={handleCancelDelete}
            disabled={isDeleting}
            className="flex-1 border border-control-border bg-transparent! text-text-secondary! hover:bg-surface-overlay! hover:text-text-primary! focus:outline-none! focus-visible:outline-none focus:ring-2 focus:ring-brand-500/40"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative cursor-pointer rounded-lg border border-surface-border bg-surface-raised transition-colors ${status.hoverBorder}`}
    >
      <Link
        to="/$projectId/summary"
        params={{ projectId: project.id }}
        aria-label={`Open ${project.name}`}
        className="absolute inset-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
      />

      {/* pointer-events-none lets clicks on plain content (name, description,
          progress, member count, deadline...) fall through to the Link
          behind it. Only the badge+menu wrapper below opts back in with
          pointer-events-auto, since it's the one actually-interactive area
          nested in here. */}
      <div className="pointer-events-none relative flex h-full flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-2">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${status.badgeBg}`}
          >
            <HiOutlineFolder
              className={`h-5 w-5 ${status.text}`}
              aria-hidden="true"
            />
          </div>

          <div className="pl-1 pt-2 flex flex-1 items-center justify-between gap-2">
            <span
              className={`rounded-md px-1 py-0.5 text-[10px] font-semibold ${status.badgeBg} ${status.text}`}
            >
              {status.label}
            </span>
          </div>

          <div className="pointer-events-auto flex items-center gap-1">
            {canManageProject && (
              <Dropdown
                arrowIcon={false}
                inline
                placement="bottom-end"
                theme={darkDropdownTheme}
                // flowbite-react's own default theme sets floating.style.auto to
                // "...dark:border-none..." (see node_modules/flowbite-react/.../
                // Dropdown/theme.js), which silently deletes the border-style
                // darkDropdownTheme's floating.base sets. Needs border-solid
                // specifically, not bare border/dark:border: verified via
                // resolveTheme+twMerge directly that bare "border" only carries
                // border-width for tailwind-merge, so it never conflicts with
                // (or removes) "border-none" - only the border-style utility
                // itself (border-solid) does.
                className="border-solid dark:border-solid"
                renderTrigger={() => (
                  <button
                    type="button"
                    aria-label={`Open actions for ${project.name}`}
                    className="rounded-md p-1 text-text-muted hover:bg-surface-overlay hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                  >
                    <HiOutlineCog6Tooth className="h-5 w-5" />
                  </button>
                )}
              >
                <DropdownItem
                  icon={HiOutlineUserGroup}
                  theme={roundedDropdownItemTheme}
                  onClick={() => onManageMembers?.()}
                >
                  Manage members
                </DropdownItem>
                <DropdownDivider />
                <DropdownItem
                  icon={HiOutlineTrash}
                  theme={roundedDropdownItemTheme}
                  className="text-control-error! dark:text-control-error!"
                  onClick={() => setIsConfirmingDelete(true)}
                >
                  Delete project
                </DropdownItem>
              </Dropdown>
            )}
          </div>
        </div>

        <div>
          <h3
            title={project.name}
            className="truncate font-mono text-base font-semibold text-text-primary"
          >
            {project.name}
          </h3>
          <p className="mt-1 min-h-10 text-sm text-text-secondary line-clamp-2">
            {project.description}
          </p>
        </div>

        <div className="mt-auto">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-text-secondary">Progress</span>
            <span className={`font-bold ${status.text}`}>
              {project.progress}%
            </span>
          </div>
          <div
            className="h-2 w-full rounded-full bg-surface-overlay"
            role="progressbar"
            aria-valuenow={project.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${project.name} progress`}
          >
            <div
              className={`h-2 rounded-full ${status.dot}`}
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-surface-border pt-3">
          <div className="flex items-center gap-4 text-xs text-text-secondary">
            <span className="flex items-center gap-1">
              <HiOutlineUsers className="h-4 w-4" aria-hidden="true" />
              {project.memberCount}
            </span>
            {formattedDeadline && (
              <span className="flex items-center gap-1">
                <HiOutlineCalendar className="h-4 w-4" aria-hidden="true" />
                {formattedDeadline}
              </span>
            )}
          </div>

          {deadlineLabel && (
            <span className="shrink-0 text-xs font-semibold text-text-muted">
              {deadlineLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
