import { useReducer, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { KanBanCardDrawer } from "@/components/drawers/kanban/KanBanCardDrawer";
import type { TaskDraft } from "@/components/drawers/kanban/KanBanCardDrawer";
import { nextRankForStatus, tasksReducer } from "@/lib/tasksReducer";
import type { Task, TaskStatus } from "@/lib/tasks";
import type { TaskCategory } from "@/lib/taskCategories";
import type { ProjectMemberUser } from "@/lib/projectMembers";

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

function KanbanPage() {
  const { projectId } = Route.useParams();

  // --- beginning of mock data - will be replaced by calls to
  // GET /api/projects/:projectId/tasks,
  // GET /api/projects/:projectId/task-categories and
  // GET /api/projects/:projectId/members once the backend for them exists
  // (typed fetchers already ready in lib/tasks.ts, lib/taskCategories.ts and
  // lib/projectMembers.ts - they're just not wired up yet). All mutations
  // below work the same way: they update the in-memory reducer state where
  // they will later also call the API (each handler carries its TODO). ---

  // The 8 default categories every project is seeded with (prisma/seed.ts),
  // color = index into CATEGORY_COLOR_PALETTE.
  const task_categories_mock: TaskCategory[] = [
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
  const project_members_mock: ProjectMemberUser[] = [
    { id: "member-1", username: "sboxd", avatarUrl: null },
    { id: "member-2", username: "mlebrun", avatarUrl: null },
    { id: "member-3", username: "jdupont", avatarUrl: null },
    { id: "member-4", username: "klaris", avatarUrl: null },
  ];

  const member_sboxd = project_members_mock[0];
  const member_mlebrun = project_members_mock[1];
  const member_jdupont = project_members_mock[2];
  const member_klaris = project_members_mock[3];

  // Typed as Task[] (the lib/tasks.ts contract) so the mock can't drift from
  // what GET /tasks will return. rank is the 0-based position inside the
  // task's STATUS column - dense 0..n-1 per column, kept that way by
  // tasksReducer. Review is left nearly empty on purpose (drag its task away
  // to see the empty-column state).
  const initial_tasks_mock: Task[] = [
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
      assignees: [member_sboxd, member_mlebrun],
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
      assignees: [member_mlebrun],
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
      assignees: [member_sboxd, member_jdupont],
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
      assignees: [member_jdupont, member_sboxd],
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
      assignees: [member_jdupont],
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
      assignees: [member_jdupont, member_mlebrun],
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
      assignees: [member_mlebrun],
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
      assignees: [member_klaris, member_sboxd],
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
      assignees: [member_sboxd, member_mlebrun, member_jdupont, member_klaris],
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
      assignees: [member_sboxd],
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
      assignees: [member_klaris],
    },
  ];
  // --- end of mock data ---

  // All task changes flow through the reducer (lib/tasksReducer.ts) - the
  // future WebSocket handler will dispatch these same actions, so board
  // interactions and remote events stay one code path.
  const [tasks, dispatch] = useReducer(tasksReducer, initial_tasks_mock);
  const [drawer_state, setDrawerState] = useState<DrawerState>({
    mode: "closed",
  });

  function handleMoveTask(
    taskId: string,
    toStatus: TaskStatus,
    toIndex: number
  ) {
    dispatch({ type: "task_moved", taskId, toStatus, toIndex });
    // TODO: once the backend exists, persist with
    // updateTask(projectId, taskId, { status, rank }, csrfToken) from
    // lib/tasks.ts (csrfToken via getSession() in lib/auth.ts).
  }

  function handleDeleteTask(taskId: string) {
    const task = tasks.find((current) => current.id === taskId);
    if (task === undefined) {
      return;
    }
    // TODO: replace with a styled confirm modal once the modal system
    // supports non-auth modals (ModalProvider is auth-only today).
    if (!window.confirm(`Delete "${task.title}"?`)) {
      return;
    }
    dispatch({ type: "task_deleted", taskId });
    // TODO: once the backend exists, persist with
    // deleteTask(projectId, taskId, csrfToken) from lib/tasks.ts.
  }

  function handleSubmitDrawer(draft: TaskDraft) {
    // The drawer only edits TaskDraft's fields - assignee ids are resolved
    // back to users here, and fields the form doesn't cover (dates,
    // description, onCalendar) keep their existing values (create fills
    // defaults).
    const draft_assignees = project_members_mock.filter((member) =>
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
      // TODO: once the backend exists, persist with
      // createTask(projectId, body, csrfToken) from lib/tasks.ts.
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
      // TODO: once the backend exists, persist with
      // updateTask(projectId, taskId, changes, csrfToken) from lib/tasks.ts -
      // note that UpdateTaskDto has no assigneeIds field yet (see the header
      // comment in lib/tasks.ts), so member changes need that backend fix to
      // persist.
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
    <>
      <p className="mb-4 text-sm text-text-secondary">
        Drag tasks between columns to track progress.
      </p>

      <KanbanBoard
        tasks={tasks}
        categories={task_categories_mock}
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
          categories={task_categories_mock}
          members={project_members_mock}
          onClose={() => setDrawerState({ mode: "closed" })}
          onSubmit={handleSubmitDrawer}
        />
      )}
    </>
  );
}
