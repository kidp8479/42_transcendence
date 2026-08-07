import { createFileRoute } from "@tanstack/react-router";
import { TaskStatusOverview } from "@/components/summary/TaskStatusOverview";
import {
  ProgressByCategory,
  type CategoryProgress,
} from "@/components/summary/ProgressByCategory";
import {
  UpcomingEvents,
  type UpcomingEvent,
} from "@/components/summary/UpcomingEvents";
import { DefenseReadiness } from "@/components/summary/DefenseReadiness";
import {
  TeamWorkload,
  type TeamMemberWorkload,
} from "@/components/summary/TeamWorkload";
import { assigneeColorIndex } from "@/components/common/AvatarStack";
import { listCalendarEvents } from "@/lib/calendarEventsApi";
import { fetchEvaluationChecklistItems } from "@/lib/evaluationChecklist";
import { computeEvaluationChecklistProgress } from "@/lib/evaluationChecklistProgress";
import { listTasks, type Task, type TaskStatus } from "@/lib/tasks";
import { listTaskCategories } from "@/lib/taskCategories";
import { getMembers } from "@/lib/projectMembersApi";

// Summary tab shows at most this many upcoming events - the backend has no
// date-range/limit filter yet (see calendar.tsx's own note on this), so the
// trim happens here after fetching every event for the project.
const UPCOMING_EVENTS_LIMIT = 6;

function buildTasksByStatus(tasks: Task[]) {
  const tasksByStatus: Record<TaskStatus, number> = {
    TODO: 0,
    IN_PROGRESS: 0,
    REVIEW: 0,
    COMPLETED: 0,
  };
  for (const task of tasks) {
    tasksByStatus[task.status] += 1;
  }
  return tasksByStatus;
}

// One row per category that actually has tasks - ProgressByCategory expects
// total > 0 for every row it's given (see its own comment: 0/0 should never
// reach it), so a category nobody has used yet is dropped here rather than
// rendered as an empty/NaN bar.
function buildProgressByCategory(
  tasks: Task[],
  taskCategories: { id: string; name: string; color: number }[]
): CategoryProgress[] {
  return taskCategories
    .map((category) => {
      const categoryTasks = tasks.filter(
        (task) => task.categoryId === category.id
      );
      return {
        name: category.name,
        total: categoryTasks.length,
        completed: categoryTasks.filter((task) => task.status === "COMPLETED")
          .length,
        color: category.color,
      };
    })
    .filter((category) => category.total > 0);
}

// One row per project member, most open tasks first. "Open" = assigned and
// not COMPLETED yet. Members with zero open tasks still show (0 open) -
// workload balance is the point of this widget, an underloaded member is as
// relevant to show as an overloaded one.
function buildTeamWorkload(
  tasks: Task[],
  taskCategories: { id: string; name: string }[],
  members: { user: { username: string } }[]
): TeamMemberWorkload[] {
  const categoryNameById = new Map(
    taskCategories.map((category) => [category.id, category.name])
  );

  const workloads = members.map((member) => {
    const username = member.user.username;
    const openTasks = tasks.filter(
      (task) =>
        task.status !== "COMPLETED" &&
        task.assignees.some((assignee) => assignee.username === username)
    );
    // Same initials recipe as AvatarStack's kanban-card avatars, so a
    // member's initials/color don't visually diverge between the two pages.
    const categoryNames = [
      ...new Set(
        openTasks
          .map((task) => categoryNameById.get(task.categoryId ?? ""))
          .filter((name): name is string => name !== undefined)
      ),
    ];
    return {
      username,
      initials: username.slice(0, 2).toUpperCase(),
      color: assigneeColorIndex(username),
      open_tasks: openTasks.length,
      categories: categoryNames,
    };
  });

  return workloads.sort((a, b) => b.open_tasks - a.open_tasks);
}

async function loadSummaryPageData(projectId: string) {
  const [events, checklistItems, tasks, taskCategories, members] =
    await Promise.all([
      listCalendarEvents(projectId),
      fetchEvaluationChecklistItems(projectId),
      listTasks(projectId),
      listTaskCategories(projectId),
      getMembers(projectId),
    ]);

  const now = Date.now();
  const upcomingEvents: UpcomingEvent[] = events
    .filter((event) => new Date(event.startAt).getTime() >= now)
    .sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    )
    .slice(0, UPCOMING_EVENTS_LIMIT)
    .map((event) => ({
      id: event.id,
      title: event.title,
      startAt: event.startAt,
      // category is nullable in the type (delete would SetNull it), though
      // no UI calls deleteCalendarCategory today. Same fallback-to-0 as
      // EventPill/CalendarDayCell on the Calendar page either way.
      color: event.category?.color ?? 0,
    }));

  const defenseReadiness = computeEvaluationChecklistProgress(checklistItems);

  return {
    upcomingEvents,
    defenseReadiness,
    tasksByStatus: buildTasksByStatus(tasks),
    progressByCategory: buildProgressByCategory(tasks, taskCategories),
    teamWorkload: buildTeamWorkload(tasks, taskCategories, members),
  };
}

export const Route = createFileRoute("/_authenticated/$projectId/summary")({
  loader: ({ params }) => loadSummaryPageData(params.projectId),
  component: SummaryPage,
});

function SummaryPage() {
  const {
    upcomingEvents,
    defenseReadiness,
    tasksByStatus,
    progressByCategory,
    teamWorkload,
  } = Route.useLoaderData();

  return (
    <>
      <TaskStatusOverview tasksByStatus={tasksByStatus} />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ProgressByCategory categories={progressByCategory} />

        <div className="flex flex-col gap-6">
          <UpcomingEvents events={upcomingEvents} />
          <DefenseReadiness
            percent={defenseReadiness.percent}
            checkpointsDone={defenseReadiness.currentValue}
            checkpointsTotal={defenseReadiness.completeAt}
          />
        </div>
      </div>

      <TeamWorkload members={teamWorkload} categories={progressByCategory} />
    </>
  );
}
