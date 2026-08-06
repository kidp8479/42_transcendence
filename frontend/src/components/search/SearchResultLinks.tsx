// One clickable row per result type: where a project, a task and a member
// each send you, and what each one shows.
//
// Shared rather than kept in the route because two callers now render results
// - the /search page and the header's suggestions panel - and they must land
// on the same place. Two copies of these destinations is one copy that
// eventually drifts.
//
// (The route used to own these, on the argument that a typed to/params pair is
// only checked where it is written. That is true wherever the component lives,
// including here, so it never argued for keeping them in the route; having a
// single source for the destinations does argue for moving them out.)
import { Link } from "@tanstack/react-router";
import { Avatar } from "flowbite-react";
import { HiOutlineFolder } from "react-icons/hi2";
import { SearchResultRow } from "@/components/search/SearchResultRow";
import { PROJECT_STATUS_STYLES } from "@/lib/projectStatusStyles";
import type {
  SearchProjectResult,
  SearchTaskResult,
  SearchUserResult,
} from "@/lib/searchApi";
import { PRIORITY_STYLES } from "@/lib/taskPriorityStyles";
import { STATUS_STYLES } from "@/lib/taskStatusStyles";

const STATUS_PILL_CLASS =
  "rounded-full border px-2 py-0.5 text-[10px] font-semibold";

export function ProjectResultLink({
  project,
}: {
  project: SearchProjectResult;
}) {
  const style = PROJECT_STATUS_STYLES[project.status];

  return (
    <Link
      // Same destination the sidebar and the project cards use.
      to="/$projectId/summary"
      params={{ projectId: project.id }}
      className="block"
    >
      <SearchResultRow
        leading={
          <HiOutlineFolder className={`h-5 w-5 ${style.text}`} aria-hidden />
        }
        title={project.name}
        subtitle={project.description}
        trailing={
          <>
            {project.isArchived && (
              <span className="rounded-md bg-yellow-400/15 px-1 py-0.5 text-[10px] font-semibold text-yellow-400">
                Archived
              </span>
            )}
            <span className={`${STATUS_PILL_CLASS} ${style.statusPill}`}>
              {style.label}
            </span>
          </>
        }
      />
    </Link>
  );
}

export function TaskResultLink({ task }: { task: SearchTaskResult }) {
  const style = STATUS_STYLES[task.status];
  const priority = PRIORITY_STYLES[task.priority];
  const StatusIcon = style.icon;

  return (
    <Link
      // The board has no URL for a single task, so this opens the column the
      // task sits in and leaves the drawer closed.
      to="/$projectId/kanban"
      params={{ projectId: task.projectId }}
      className="block"
    >
      <SearchResultRow
        leading={<StatusIcon className={`h-5 w-5 ${style.headerIcon}`} />}
        title={task.title}
        // A task title out of context means nothing - "Fix login" in which
        // project? The server flattens the project name onto every task row.
        subtitle={task.projectName}
        trailing={
          <>
            <span className="flex items-center gap-1 text-[10px] font-semibold text-text-secondary">
              <span
                className={`h-2 w-2 rounded-full ${priority.dot}`}
                aria-hidden
              />
              {priority.label}
            </span>
            <span className={`${STATUS_PILL_CLASS} ${style.statusPill}`}>
              {style.label}
            </span>
          </>
        }
      />
    </Link>
  );
}

export function UserResultLink({ user }: { user: SearchUserResult }) {
  return (
    <Link
      // First links in the repo to point at this route - it is still a stub
      // page, but the destination is the right one.
      to="/users/$username"
      params={{ username: user.username }}
      className="block"
    >
      <SearchResultRow
        leading={
          <Avatar
            img={user.avatarUrl ?? undefined}
            placeholderInitials={user.username.slice(0, 2).toUpperCase()}
            rounded
            size="xs"
          />
        }
        title={user.username}
        subtitle={user.campus}
      />
    </Link>
  );
}
