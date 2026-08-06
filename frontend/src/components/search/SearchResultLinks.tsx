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
import { HiOutlineFolder, HiOutlineUserPlus } from "react-icons/hi2";
import { LockOwnerAvatar } from "@/components/LockOwnerAvatar";
import { SearchResultRow } from "@/components/search/SearchResultRow";
import { PROJECT_STATUS_STYLES } from "@/lib/projectStatusStyles";
import type {
  SearchProjectResult,
  SearchTaskResult,
  SearchUserResult,
} from "@/lib/searchApi";
import { PRIORITY_STYLES } from "@/lib/taskPriorityStyles";
import { STATUS_STYLES } from "@/lib/taskStatusStyles";

// Fixed widths, not padding: every status pill is the same box whatever the
// label inside, so the pills line up down the page instead of drifting left
// and right with the length of "Review" versus "In Progress".
//
// From sm up only. Those two columns reserve 176px whatever is in them, and on
// a phone that is most of the row: the title collapsed to "ft..." and the
// description to "A Tr...". Alignment is worth nothing when there is nothing
// left to align, so below sm every badge shrinks to its own content and the
// text takes the space back. The gap BETWEEN the badges is untouched at every
// size - that one is doing real work.
const STATUS_PILL_CLASS =
  "inline-block shrink-0 rounded-full border px-1.5 py-0.5 text-center text-[10px] font-semibold sm:w-24 sm:px-0";
const SIDE_COLUMN_CLASS =
  "flex shrink-0 items-center justify-end gap-1 sm:w-20";

// The box behind an ICON only. Avatars don't get one - a circle inside a
// rounded square is the bubble-in-a-bubble the chat and the board avoid.
const ICON_BOX_CLASS =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-overlay";

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
          <span className={ICON_BOX_CLASS}>
            <HiOutlineFolder className={`h-5 w-5 ${style.text}`} aria-hidden />
          </span>
        }
        title={project.name}
        subtitle={project.description}
        trailing={
          <>
            {/* Rendered even when the project isn't archived, empty: it is
                what keeps the status pills in one column across rows. */}
            <span className={`${SIDE_COLUMN_CLASS} text-[10px] font-semibold`}>
              {project.isArchived && (
                <span className="rounded-md bg-yellow-400/15 px-1 py-0.5 text-yellow-400">
                  Archived
                </span>
              )}
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

export function TaskResultLink({ task }: { task: SearchTaskResult }) {
  const style = STATUS_STYLES[task.status];
  const priority = PRIORITY_STYLES[task.priority];
  const StatusIcon = style.icon;

  return (
    <Link
      to="/$projectId/kanban"
      params={{ projectId: task.projectId }}
      // The board reads this and opens the drawer on that task, so a result
      // lands on the card itself instead of on the column it sits in.
      search={{ task: task.id }}
      className="block"
    >
      <SearchResultRow
        leading={
          <span className={ICON_BOX_CLASS}>
            <StatusIcon className={`h-5 w-5 ${style.headerIcon}`} />
          </span>
        }
        title={task.title}
        // A task title out of context means nothing - "Fix login" in which
        // project? The server flattens the project name onto every task row.
        subtitle={task.projectName}
        trailing={
          <>
            <span
              className={`${SIDE_COLUMN_CLASS} text-[10px] font-semibold text-text-secondary`}
            >
              <span
                className={`h-2 w-2 rounded-full ${priority.dot}`}
                aria-hidden
              />
              {/* The dot alone on a phone - "Medium" is 45px the title needs
                  more than the priority does. sr-only rather than hidden, so
                  the colour is never the only thing carrying the meaning. */}
              <span className="sr-only sm:not-sr-only">{priority.label}</span>
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

export function UserResultLink({
  user,
  isFriend = false,
}: {
  user: SearchUserResult;
  // Nothing sets this yet - there is no Friend model on any branch, so the
  // API can't say. It exists so the badge is one prop away from working the
  // day the friends feature lands, alongside the button below.
  isFriend?: boolean;
}) {
  return (
    // The friend control is a sibling of the link, not a child: a <button>
    // inside an <a> is invalid HTML and swallows its own clicks. Same
    // arrangement as ProjectCard's "..." menu over its stretched card link.
    <div className="relative">
      <Link
        // First links in the repo to point at this route - it is still a stub
        // page, but the destination is the right one.
        to="/users/$username"
        params={{ username: user.username }}
        className="block"
      >
        <SearchResultRow
          // The same avatar the chat puts on a message, rather than an icon in
          // a box.
          leading={
            <LockOwnerAvatar
              username={user.username}
              avatarUrl={user.avatarUrl}
              size="sm"
            />
          }
          title={user.username}
          subtitle={user.campus}
          // Empty, and only there to reserve the room the control below needs
          // - it is positioned over the row, so nothing else keeps the title
          // from running underneath it. Narrow on a phone, where the button
          // is its icon alone.
          trailing={<span className="block w-16 sm:w-28" aria-hidden />}
        />
      </Link>

      <div className="absolute inset-y-0 right-4 flex items-center">
        {isFriend ? (
          <span className="rounded-full border border-brand-500/30 bg-brand-500/15 px-2 py-0.5 text-[10px] font-semibold text-brand-500">
            Friend
          </span>
        ) : (
          <button
            type="button"
            // Disabled rather than silently doing nothing: sending a friend
            // request has no endpoint yet (no Friend model in schema.prisma),
            // and a button that swallows clicks reads as a bug.
            disabled
            title="Friend requests aren't available yet"
            className="flex items-center gap-1 rounded-md border border-surface-border bg-surface-overlay px-2 py-1 text-[10px] font-semibold text-text-secondary transition-colors hover:border-brand-500 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-surface-border disabled:hover:text-text-secondary"
          >
            <HiOutlineUserPlus className="h-3.5 w-3.5" aria-hidden />
            {/* Icon-only on a phone, where the label costs more room than the
                username has to spare. */}
            <span className="sr-only sm:not-sr-only">Add friend</span>
          </button>
        )}
      </div>
    </div>
  );
}
