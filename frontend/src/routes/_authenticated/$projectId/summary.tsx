import { createFileRoute } from "@tanstack/react-router";
import { TaskStatusOverview } from "@/components/summary/TaskStatusOverview";
import { ProgressByCategory } from "@/components/summary/ProgressByCategory";
import {
  UpcomingEvents,
  type UpcomingEvent,
} from "@/components/summary/UpcomingEvents";
import { DefenseReadiness } from "@/components/summary/DefenseReadiness";
import { TeamWorkload } from "@/components/summary/TeamWorkload";
import { listCalendarEvents } from "@/lib/calendarEventsApi";
import { fetchEvaluationChecklistItems } from "@/lib/evaluationChecklist";
import { computeEvaluationChecklistProgress } from "@/lib/evaluationChecklistProgress";

// Summary tab shows at most this many upcoming events - the backend has no
// date-range/limit filter yet (see calendar.tsx's own note on this), so the
// trim happens here after fetching every event for the project.
const UPCOMING_EVENTS_LIMIT = 6;

async function loadSummaryPageData(projectId: string) {
  const [events, checklistItems] = await Promise.all([
    listCalendarEvents(projectId),
    fetchEvaluationChecklistItems(projectId),
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
      // every project's calendar categories are seeded/fixed (never user-
      // deletable today), so category is expected to always be set - the
      // fallback only satisfies CalendarEvent's nullable type.
      color: event.category?.color ?? 0,
    }));

  const defenseReadiness = computeEvaluationChecklistProgress(checklistItems);

  return { upcomingEvents, defenseReadiness };
}

export const Route = createFileRoute("/_authenticated/$projectId/summary")({
  loader: ({ params }) => loadSummaryPageData(params.projectId),
  component: SummaryPage,
});

function SummaryPage() {
  const { upcomingEvents, defenseReadiness } = Route.useLoaderData();

  // --- beginning of mock data - will be replaced by a call to
  // GET /api/projects/:id/summary once the backend for it exists ---
  // Fake data standing in for the real GET /api/projects/:id/summary response.
  // Auth is wired (see ProjectLayout) - what's still missing is the backend
  // itself: Tasks endpoints plus a team_workload aggregation, neither of
  // which exist yet (tracked for a follow-up PR, tasks.service.ts is still a
  // TODO stub). Upcoming events and defense readiness are now real, loaded
  // above. Each field below is passed down as props to its own section
  // component.
  const summary_data_json_mock_up = {
    // count of tasks per status, matches the TaskStatus enum in schema.prisma
    tasks_by_status: {
      TODO: 10,
      IN_PROGRESS: 5,
      REVIEW: 2,
      COMPLETED: 8,
    },
    // color: index into CATEGORY_COLOR_PALETTE, matches TaskCategory.color (Int) in schema.prisma
    categories: [
      { name: "Planning", completed: 1, total: 1, color: 0 },
      { name: "Development", completed: 5, total: 12, color: 1 },
      { name: "Testing", completed: 0, total: 1, color: 2 },
      { name: "Backend", completed: 1, total: 5, color: 3 },
      { name: "Frontend", completed: 1, total: 3, color: 4 },
      { name: "DevOps", completed: 2, total: 2, color: 5 },
      { name: "Parsing", completed: 0, total: 2, color: 6 },
      { name: "Documentation", completed: 1, total: 2, color: 7 },
    ],
    // open_tasks: tasks assigned to this member that aren't COMPLETED yet.
    // color: index into CATEGORY_COLOR_PALETTE, used for this member's avatar
    // - it's the member's own display color, unrelated to task/calendar
    // categories (User has no color field in schema.prisma yet, this is
    // mock-only for now).
    // categories: names of the categories this member has open tasks in -
    // matched against summary_data_json_mock_up.categories (by name) to reuse
    // the same color, instead of a separate per-category color system.
    team_workload: [
      {
        username: "sboxd",
        initials: "SA",
        color: 1,
        open_tasks: 5,
        categories: ["Backend", "Testing"],
      },
      {
        username: "mlebrun",
        initials: "ML",
        color: 5,
        open_tasks: 4,
        categories: ["Backend", "DevOps"],
      },
      {
        username: "jdupont",
        initials: "JD",
        color: 2,
        open_tasks: 5,
        categories: ["Testing", "DevOps"],
      },
      {
        username: "klaris",
        initials: "KL",
        color: 6,
        open_tasks: 2,
        categories: ["Frontend", "DevOps"],
      },
    ],
  };
  // --- end of mock data ---

  return (
    <>
      <TaskStatusOverview
        tasksByStatus={summary_data_json_mock_up.tasks_by_status}
      />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ProgressByCategory categories={summary_data_json_mock_up.categories} />

        <div className="flex flex-col gap-6">
          <UpcomingEvents events={upcomingEvents} />
          <DefenseReadiness
            percent={defenseReadiness.percent}
            checkpointsDone={defenseReadiness.currentValue}
            checkpointsTotal={defenseReadiness.completeAt}
          />
        </div>
      </div>

      <TeamWorkload
        members={summary_data_json_mock_up.team_workload}
        categories={summary_data_json_mock_up.categories}
      />
    </>
  );
}
