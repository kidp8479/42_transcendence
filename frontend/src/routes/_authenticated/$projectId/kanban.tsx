import { useMemo, useReducer, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { KanBanCardDrawer } from "@/components/drawers/kanban/KanBanCardDrawer";
import type { TaskDraft } from "@/components/drawers/kanban/KanBanCardDrawer";
import { useToast } from "@/hooks/useToast";
import { nextRankForStatus, tasksReducer } from "@/lib/tasksReducer";
import type { Task, TaskStatus } from "@/lib/tasks";
import type { TaskCategory } from "@/lib/taskCategories";
import type { ProjectMemberUser } from "@/lib/projectMembers";

// TODO: when the Tasks/TaskCategories/ProjectMembers backends land, delete
// buildKanbanMockData below and give this route a loader instead:
//   loader: async (routeContext) => {
//     const projectId = routeContext.params.projectId;
//     const [tasks, categories, members] = await Promise.all([
//       listTasks(projectId),
//       listTaskCategories(projectId),
//       listProjectMembers(projectId),
//     ]);
//     return { tasks, categories, members };
//   },
// then mirror it into the reducer with
//   useEffect(() => dispatch({ type: "tasks_loaded", tasks: loaderData.tasks }), [loaderData])
// (same pattern as discovery.tsx's own loaderData sync). No loader today: one
// returning constants would make router.invalidate() a no-op and the mirror
// would wipe local edits on any unrelated invalidate.
export const Route = createFileRoute("/_authenticated/$projectId/kanban")({
  component: KanbanPage,
});

// Which drawer is open, if any. Edit stores the task ID (not the task): the
// rendered drawer resolves the live task from state, so it stays fresh if a
// future WebSocket update touches the task mid-edit.
type DrawerState =
  | { mode: "closed" }
  | { mode: "create"; status: TaskStatus }
  | { mode: "edit"; taskId: string };

// Drawer width bounds, in px. The default matches the max-w-md the drawer had
// before it became resizable, and the max is Tailwind's 3xl (48rem) rather
// than an invented number. Plain constants: the panel is also capped by
// max-w-full in CSS, so it can never exceed the board whatever these say.
const MIN_DRAWER_WIDTH = 360;
const DEFAULT_DRAWER_WIDTH = 448;
const MAX_DRAWER_WIDTH = 768;

// --- beginning of mock data - will be replaced by calls to
// GET /api/projects/:projectId/tasks,
// GET /api/projects/:projectId/task-categories and
// GET /api/projects/:projectId/members once the backend for them exists
// (typed functions already waiting in lib/tasks.ts, lib/taskCategories.ts and
// lib/projectMembers.ts - they're just not wired up yet, the services are
// still empty classes). Everything below is one function so that removing it
// is a single deletion; the handlers further down already have the shape they
// need once the calls are real (each carries its own TODO). ---
function buildKanbanMockData(projectId: string): {
  tasks: Task[];
  categories: TaskCategory[];
  members: ProjectMemberUser[];
} {
  // The 8 default categories every project is seeded with (prisma/seed.ts),
  // color = index into CATEGORY_COLOR_PALETTE.
  const categories: TaskCategory[] = [
    { id: "cat-0", name: "Planning", color: 0 },
    { id: "cat-1", name: "Development", color: 1 },
    { id: "cat-2", name: "Testing", color: 2 },
    { id: "cat-3", name: "Backend", color: 3 },
    { id: "cat-4", name: "Frontend", color: 4 },
    { id: "cat-5", name: "DevOps", color: 5 },
    { id: "cat-6", name: "Parsing", color: 6 },
    { id: "cat-7", name: "Documentation", color: 7 },
  ];

  // Same fake team as the Summary tab's mock.
  const members: ProjectMemberUser[] = [
    { id: "member-1", username: "sboxd", avatarUrl: null },
    { id: "member-2", username: "mlebrun", avatarUrl: null },
    { id: "member-3", username: "jdupont", avatarUrl: null },
    { id: "member-4", username: "klaris", avatarUrl: null },
  ];

  const sboxd = members[0];
  const mlebrun = members[1];
  const jdupont = members[2];
  const klaris = members[3];

  // Typed as Task[] (the lib/tasks.ts contract) so the mock can't drift from
  // what GET /tasks will return. rank is the 0-based position inside the
  // task's STATUS column - dense 0..n-1 per column, kept that way by
  // tasksReducer. Review is left nearly empty on purpose (drag its task away
  // to see the empty-column state).
  const tasks: Task[] = [
    {
      id: "task-1",
      projectId,
      title: "Implement user authentication",
      status: "TODO",
      categoryId: "cat-3",
      rank: 0,
      priority: "HIGH",
      startAt: null,
      endAt: null,
      description: null,
      notes: null,
      onCalendar: false,
      assignees: [sboxd, mlebrun],
    },
    {
      id: "task-2",
      projectId,
      title: "Set up WebSocket connection",
      status: "TODO",
      categoryId: "cat-3",
      rank: 1,
      priority: "MEDIUM",
      startAt: null,
      endAt: null,
      description: null,
      notes: null,
      onCalendar: false,
      assignees: [mlebrun],
    },
    {
      id: "task-3",
      projectId,
      title: "Design matchmaking system",
      status: "TODO",
      categoryId: "cat-1",
      rank: 2,
      priority: "MEDIUM",
      startAt: null,
      endAt: null,
      description: null,
      notes: null,
      onCalendar: false,
      assignees: [sboxd, jdupont],
    },
    {
      id: "task-4",
      projectId,
      title: "Write unit tests for game engine",
      status: "TODO",
      categoryId: "cat-2",
      rank: 3,
      priority: "LOW",
      startAt: null,
      endAt: null,
      description: null,
      notes: null,
      onCalendar: false,
      assignees: [jdupont, sboxd],
    },
    {
      id: "task-5",
      projectId,
      title: "Create game engine module",
      status: "IN_PROGRESS",
      categoryId: "cat-1",
      rank: 0,
      priority: "HIGH",
      startAt: null,
      endAt: null,
      description: null,
      notes: null,
      onCalendar: false,
      assignees: [jdupont],
    },
    {
      id: "task-6",
      projectId,
      title: "Build paddle and ball system",
      status: "IN_PROGRESS",
      categoryId: "cat-1",
      rank: 1,
      priority: "HIGH",
      startAt: null,
      endAt: null,
      description: null,
      notes: null,
      onCalendar: false,
      assignees: [jdupont, mlebrun],
    },
    {
      id: "task-7",
      projectId,
      title: "Implement real-time game loop",
      status: "IN_PROGRESS",
      categoryId: "cat-3",
      rank: 2,
      priority: "HIGH",
      startAt: null,
      endAt: null,
      description: null,
      notes: null,
      onCalendar: false,
      assignees: [mlebrun],
    },
    {
      id: "task-8",
      projectId,
      title: "Leaderboard UI",
      status: "REVIEW",
      categoryId: "cat-4",
      rank: 0,
      priority: "HIGH",
      startAt: null,
      endAt: null,
      description: null,
      notes: null,
      onCalendar: false,
      assignees: [klaris, sboxd],
    },
    {
      id: "task-9",
      projectId,
      title: "Project setup (Docker + Gitflow)",
      status: "COMPLETED",
      categoryId: "cat-5",
      rank: 0,
      priority: "HIGH",
      startAt: null,
      endAt: null,
      description: null,
      notes:
        "## Notes\n\n- Compose file covers frontend/backend/auth/nginx\n- Gitflow: feature branches + PR reviews",
      onCalendar: false,
      assignees: [sboxd, mlebrun, jdupont, klaris],
    },
    {
      id: "task-10",
      projectId,
      title: "Read and understand subject PDF",
      status: "COMPLETED",
      categoryId: "cat-0",
      rank: 1,
      priority: "MEDIUM",
      startAt: null,
      endAt: null,
      description: null,
      notes: null,
      onCalendar: false,
      assignees: [sboxd],
    },
    {
      id: "task-11",
      projectId,
      title: "Basic frontend layout",
      status: "COMPLETED",
      categoryId: "cat-4",
      rank: 2,
      priority: "MEDIUM",
      startAt: null,
      endAt: null,
      description: null,
      notes: null,
      onCalendar: false,
      assignees: [klaris],
    },
  ];

  return { tasks, categories, members };
}
// --- end of mock data ---

function KanbanPage() {
  const { projectId } = Route.useParams();
  const { showToast } = useToast();

  const mock_data = useMemo(() => buildKanbanMockData(projectId), [projectId]);

  // All task changes flow through the reducer (lib/tasksReducer.ts) - the
  // future WebSocket handler will dispatch these same actions, so board
  // interactions and remote events stay one code path.
  const [tasks, dispatch] = useReducer(tasksReducer, mock_data.tasks);
  const [drawer_state, setDrawerState] = useState<DrawerState>({
    mode: "closed",
  });

  // Drawer width lives here, not in the drawer: the drawer is remounted per
  // task (its `key`), so a width held there would reset on every card.
  const [drawer_width, setDrawerWidth] = useState(DEFAULT_DRAWER_WIDTH);

  function handleMoveTask(
    taskId: string,
    toStatus: TaskStatus,
    toIndex: number
  ) {
    dispatch({ type: "task_moved", taskId, toStatus, toIndex });
    // TODO: once the backend exists, persist with
    // updateTask(projectId, taskId, { status, rank }) from lib/tasks.ts. On
    // failure: console.error + error toast + dispatch the inverse task_moved
    // to roll back. No success toast - a toast per drag would be spam, and
    // the house rule is no success toast for implicit saves.
  }

  async function handleDeleteTask(taskId: string): Promise<boolean> {
    const task = tasks.find((current) => current.id === taskId);
    if (task === undefined) {
      return false;
    }
    // TODO: once the backend exists, await deleteTask(projectId, taskId) in a
    // try/catch here; on failure console.error + error toast + return false
    // (the card keeps its confirmation open).
    dispatch({ type: "task_deleted", taskId });
    // TODO: await safeInvalidateRouter() here - after the try/catch, never
    // inside it (see the comment in hooks/useSafeRouterInvalidate.ts).
    showToast({ type: "success", message: "Task deleted" });
    return true;
  }

  function handleSubmitDrawer(draft: TaskDraft) {
    // The drawer only edits TaskDraft's fields - assignee ids are resolved
    // back to users here, and fields the form doesn't cover (dates,
    // description, onCalendar) keep their existing values (create fills
    // defaults).
    const draft_assignees = mock_data.members.filter((member) =>
      draft.assigneeIds.includes(member.id)
    );

    if (drawer_state.mode === "create") {
      dispatch({
        type: "task_created",
        task: {
          // crypto.randomUUID is a mock stand-in for the id the backend will
          // generate.
          id: crypto.randomUUID(),
          projectId,
          title: draft.title,
          status: draft.status,
          categoryId: draft.categoryId,
          rank: nextRankForStatus(tasks, draft.status),
          priority: draft.priority,
          startAt: null,
          endAt: null,
          description: null,
          notes: draft.notes === "" ? null : draft.notes,
          onCalendar: false,
          assignees: draft_assignees,
        },
      });
      // TODO: once the backend exists, await createTask(projectId, body) from
      // lib/tasks.ts in a try/catch; on failure console.error + error toast
      // and leave the drawer open.
      showToast({ type: "success", message: "Task created" });
    } else if (drawer_state.mode === "edit") {
      const submitted_task = tasks.find(
        (current) => current.id === drawer_state.taskId
      );
      if (submitted_task !== undefined) {
        dispatch({
          type: "task_updated",
          taskId: submitted_task.id,
          changes: {
            title: draft.title,
            categoryId: draft.categoryId,
            status: draft.status,
            priority: draft.priority,
            notes: draft.notes === "" ? null : draft.notes,
            assignees: draft_assignees,
            // A status change through the drawer sends the task to the end
            // of its new column (the reducer keeps both columns' ranks dense).
            ...(draft.status !== submitted_task.status
              ? { rank: nextRankForStatus(tasks, draft.status) }
              : {}),
          },
        });
      }
      // TODO: once the backend exists, await updateTask(projectId, taskId,
      // updates) from lib/tasks.ts - note that UpdateTaskDto has no
      // assigneeIds field yet (see the header comment in lib/tasks.ts), so
      // member changes need that backend fix to persist.
      showToast({ type: "success", message: "Changes saved" });
    }
    setDrawerState({ mode: "closed" });
  }

  // Resolved outside the JSX so a stale edit drawer (task deleted while its
  // id is still in drawer_state) simply renders nothing.
  const editing_task =
    drawer_state.mode === "edit"
      ? (tasks.find((current) => current.id === drawer_state.taskId) ?? null)
      : null;

  return (
    // h-full of the tab's scroll area: the board fills it and the COLUMNS
    // scroll, not the page. Deliberately NOT `relative` - the drawer has to
    // reach the tab bar's rule and the footer, so its containing block is
    // ProjectLayout's anchor one level up, not this padded box.
    <div className="flex h-full flex-col">
      <p className="mb-4 shrink-0 text-sm text-text-secondary">
        Drag tasks between columns to track progress.
      </p>

      <KanbanBoard
        tasks={tasks}
        categories={mock_data.categories}
        onMoveTask={handleMoveTask}
        onAddTask={(status) => setDrawerState({ mode: "create", status })}
        onOpenTask={(taskId) => setDrawerState({ mode: "edit", taskId })}
        onDeleteTask={handleDeleteTask}
      />

      {(drawer_state.mode === "create" || editing_task !== null) && (
        <KanBanCardDrawer
          // Remounts the drawer per task (and per create session), which is
          // what initializes its form state - no state-syncing effects inside.
          key={drawer_state.mode === "edit" ? drawer_state.taskId : "create"}
          mode={drawer_state.mode === "create" ? "create" : "edit"}
          task={editing_task}
          initialStatus={
            drawer_state.mode === "create" ? drawer_state.status : "TODO"
          }
          categories={mock_data.categories}
          members={mock_data.members}
          onClose={() => setDrawerState({ mode: "closed" })}
          onSubmit={handleSubmitDrawer}
          width={drawer_width}
          minWidth={MIN_DRAWER_WIDTH}
          maxWidth={MAX_DRAWER_WIDTH}
          onWidthChange={setDrawerWidth}
        />
      )}
    </div>
  );
}
