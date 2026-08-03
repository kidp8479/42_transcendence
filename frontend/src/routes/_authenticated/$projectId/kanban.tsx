import { useEffect, useReducer, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { KanbanCardDrawer } from "@/components/drawers/kanban/KanbanCardDrawer";
import type { TaskDraft } from "@/components/drawers/kanban/KanbanCardDrawer";
import { useSafeRouterInvalidate } from "@/hooks/useSafeRouterInvalidate";
import { useToast } from "@/hooks/useToast";
import { selectColumnTasks, tasksReducer } from "@/lib/tasksReducer";
import {
  createTask,
  deleteTask,
  listTasks,
  parseTask,
  updateTask,
  type TaskAssigneeUser,
  type TaskStatus,
  type UpdateTaskBody,
} from "@/lib/tasks";
import { STATUS_ORDER } from "@/lib/taskStatusStyles";
import { listTaskCategories } from "@/lib/taskCategories";
import { getMembers } from "@/lib/projectMembersApi";
import { getRealtimeSocket } from "@/lib/realtimeSocket";
import { ApiError } from "@/lib/apiClient";

async function loadKanbanPageData(projectId: string) {
  const [tasks, categories, members] = await Promise.all([
    listTasks(projectId),
    listTaskCategories(projectId),
    getMembers(projectId),
  ]);
  return {
    tasks: tasks,
    categories: categories,
    // Flattened to the user: ProjectMember.id is the membership row's id, and
    // assigneeIds must carry USER ids. Passing the member through would look
    // fine on screen and only fail at the API with "assigneeIds must all be
    // members of this project".
    members: members.map((member): TaskAssigneeUser => member.user),
  };
}

export const Route = createFileRoute("/_authenticated/$projectId/kanban")({
  loader: (routeContext) => loadKanbanPageData(routeContext.params.projectId),
  component: KanbanPage,
});

// What the drawer is pointed at. Edit stores the task ID (not the task), so a
// task deleted from under an open drawer resolves to null instead of a dangling
// object. Note this does NOT make the open FORM fresh: it seeds its draft once at
// mount and never resyncs, so a change arriving from elsewhere lands in `tasks`
// and on the card but not in the fields (the socket handlers below dispatch into
// `tasks`, same as a local edit, but nothing re-keys an already-open form). Save
// works around it by sending only the fields the user actually changed - see
// handleSubmitDrawer. A live-resyncing draft (like a real per-field lock, the
// way Discovery/the checklist do it) is still open - see Cricriiii #6 in
// pr34-tr49-open-findings.
type DrawerTarget =
  | { mode: "create"; status: TaskStatus }
  | { mode: "edit"; taskId: string };

// "closed" is a flag here, not a variant of the target: DrawerShell keeps the
// panel mounted so it can animate out, and a panel sliding out still has to
// render the task it was showing. Clearing the target on close would blank it
// mid-animation.
interface DrawerState {
  target: DrawerTarget;
  isOpen: boolean;
  // Bumped on every open. The drawer's form initializes when it mounts (see its
  // `key`), so reopening the same card - or the same column's "+" twice in a
  // row - has to remount it, which a key derived from the target alone wouldn't
  // do.
  session: number;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

// Never trust a socket payload's shape just because a TS annotation says so -
// same convention as every lib/*.ts file's own private isRecord.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Order-insensitive: assigneeIds is a SET server-side (it replaces the whole
// list), and toggling a member off then back on reorders it without changing it.
function sameAssignees(current: string[], previous: string[]): boolean {
  if (current.length !== previous.length) {
    return false;
  }
  const previous_ids = new Set(previous);
  return current.every((id) => previous_ids.has(id));
}

function KanbanPage() {
  const { projectId } = Route.useParams();
  const loaderData = Route.useLoaderData();
  const safeInvalidateRouter = useSafeRouterInvalidate();
  const { showToast } = useToast();

  // All task changes flow through the reducer (lib/tasksReducer.ts) - both
  // local board interactions AND the WS handler below dispatch these same
  // actions, so remote events and this client's own edits stay one code path.
  //
  // Deliberately NOT calling safeInvalidateRouter() after a successful mutation,
  // unlike discovery.tsx. Every mutation here already dispatches the task the
  // server returned, so the refetch added nothing - it just rebuilt all four
  // columns from scratch, which visibly jolted cards the user never touched. It
  // would also actively fight the realtime layer below: the loader hands back a
  // full SNAPSHOT asynchronously, so a late response could overwrite a remote
  // change that arrived over the socket in the meantime. The only survivor is
  // the 409 path below, where the local state really is worthless.
  const [tasks, dispatch] = useReducer(tasksReducer, loaderData.tasks);

  // Mirrors the loader into the reducer, the same way discovery.tsx mirrors it
  // into useState: useReducer's initial value only seeds the first render, so
  // without this a router.invalidate() would refetch and change nothing.
  useEffect(() => {
    dispatch({ type: "tasks_loaded", tasks: loaderData.tasks });
  }, [loaderData]);

  const [drawer, setDrawer] = useState<DrawerState>({
    // Arbitrary starting target: the drawer is mounted from the very first
    // render (its slide-in only animates if the panel was already there,
    // translated off-screen), but stays closed and inert until something opens
    // it.
    target: { mode: "create", status: "TODO" },
    isOpen: false,
    session: 0,
  });

  // Pulled out of the state object: TypeScript won't narrow a property path
  // like drawer.target.mode inside a callback, only a plain const.
  const drawer_target = drawer.target;

  function openDrawer(target: DrawerTarget) {
    setDrawer((current) => ({
      target,
      isOpen: true,
      session: current.session + 1,
    }));
  }

  function closeDrawer() {
    setDrawer((current) => ({ ...current, isOpen: false }));
  }

  // Live board sync: remote broadcasts from tasks.service.ts's
  // emitToProject calls dispatch into the same reducer as local edits, same
  // pattern as discovery.tsx's own socket.on/off effects. No sender
  // exclusion server-side, so this client's own actions echo back too -
  // every action tasksReducer.ts handles is idempotent against that.
  //
  // Empty dep array like discovery.tsx's: the handlers below only call
  // dispatch/setDrawer (both stable setters) via a functional updater, so
  // they never need a fresh closure over `tasks`/`drawer` to read the
  // latest state.
  useEffect(() => {
    const socket = getRealtimeSocket();

    function handleTaskCreated(payload: unknown) {
      const task = parseTask(payload);
      if (task === null) {
        return;
      }
      dispatch({ type: "task_created", task });
    }

    function handleTaskUpdated(payload: unknown) {
      if (!isRecord(payload) || typeof payload.taskId !== "string") {
        return;
      }
      const changes = parseTask(payload.changes);
      if (changes === null) {
        return;
      }
      dispatch({ type: "task_updated", taskId: payload.taskId, changes });
    }

    function handleTaskMoved(payload: unknown) {
      if (
        !isRecord(payload) ||
        typeof payload.taskId !== "string" ||
        typeof payload.toStatus !== "string" ||
        !STATUS_ORDER.includes(payload.toStatus as TaskStatus) ||
        typeof payload.toIndex !== "number"
      ) {
        return;
      }
      dispatch({
        type: "task_moved",
        taskId: payload.taskId,
        toStatus: payload.toStatus as TaskStatus,
        toIndex: payload.toIndex,
      });
    }

    function handleTaskDeleted(payload: unknown) {
      if (!isRecord(payload) || typeof payload.taskId !== "string") {
        return;
      }
      const taskId = payload.taskId;
      dispatch({ type: "task_deleted", taskId });
      // Same behavior handleDeleteTask already applies for a local delete -
      // an open drawer pointed at a task that no longer exists would
      // otherwise keep rendering a stale form with no way to save or close
      // it meaningfully.
      setDrawer((current) =>
        current.target.mode === "edit" && current.target.taskId === taskId
          ? { ...current, isOpen: false }
          : current
      );
    }

    socket.on("task:created", handleTaskCreated);
    socket.on("task:updated", handleTaskUpdated);
    socket.on("task:moved", handleTaskMoved);
    socket.on("task:deleted", handleTaskDeleted);
    return () => {
      socket.off("task:created", handleTaskCreated);
      socket.off("task:updated", handleTaskUpdated);
      socket.off("task:moved", handleTaskMoved);
      socket.off("task:deleted", handleTaskDeleted);
    };
  }, []);

  // Local-only reposition, fired by the board on every column the card crosses
  // mid-drag. Nothing is persisted here: the drop does that, once.
  function handlePreviewMove(
    taskId: string,
    toStatus: TaskStatus,
    toIndex: number
  ): void {
    dispatch({ type: "task_moved", taskId, toStatus, toIndex });
  }

  // Fired once, on drop. Optimistic: the card is already in its new column (the
  // previews above put it there) and the PATCH catches up. No success toast -
  // one per drag would be spam, and the house rule is no toast for autosaves.
  async function handleMoveTask(
    taskId: string,
    toStatus: TaskStatus,
    toIndex: number,
    from: { status: TaskStatus; index: number }
  ): Promise<void> {
    dispatch({ type: "task_moved", taskId, toStatus, toIndex });

    try {
      // rank is the destination index: the server shifts the siblings of both
      // columns to keep them dense, matching what the reducer just did locally.
      await updateTask(projectId, taskId, { status: toStatus, rank: toIndex });
    } catch (error) {
      console.error("Failed to move task", error);
      // 409 = the server hit a serialization conflict (someone else was
      // reordering the same column). Our local guess is meaningless then, so
      // reload instead of rolling back to a state that never existed.
      if (error instanceof ApiError && error.status === 409) {
        showToast({
          type: "error",
          message: "Board changed while you were dragging, reloading",
        });
        await safeInvalidateRouter();
        return;
      }
      showToast({
        type: "error",
        message: errorMessage(error, "Failed to move task"),
      });
      // Back to where the gesture started, not to where the card sat a moment
      // ago: the mid-drag previews already moved it. task_moved reindexes both
      // columns densely, so this reproduces the pre-drag arrangement exactly.
      dispatch({
        type: "task_moved",
        taskId,
        toStatus: from.status,
        toIndex: from.index,
      });
      return;
    }
  }

  // Optimistic too: the card is already behind an inline confirmation, so
  // making it linger after the user confirmed would read as a broken button.
  async function handleDeleteTask(taskId: string): Promise<boolean> {
    // The card itself, not a snapshot of the whole board - see the rollback below.
    const previous_task = tasks.find((current) => current.id === taskId);
    if (previous_task === undefined) {
      return false;
    }

    dispatch({ type: "task_deleted", taskId });
    // The drawer no longer unmounts when it closes, so it can't be left
    // pointing at a task that just disappeared - it would render an empty form.
    if (drawer_target.mode === "edit" && drawer_target.taskId === taskId) {
      closeDrawer();
    }

    try {
      await deleteTask(projectId, taskId);
    } catch (error) {
      console.error("Failed to delete task", error);
      showToast({
        type: "error",
        message: errorMessage(error, "Failed to delete task"),
      });
      // Put THIS card back, rather than reloading the board from a pre-delete
      // snapshot: that snapshot also predates anything that succeeded while the
      // delete was in flight, so restoring it would silently revert a move the
      // server had already accepted, with no error shown for it.
      // Two dispatches, because task_created alone appends the card and re-sorts
      // by rank - and deleting already pulled its old neighbour up to the freed
      // rank, so the restored card ties with it and lands one slot too low.
      // task_moved then splices it back at the exact index.
      dispatch({ type: "task_created", task: previous_task });
      dispatch({
        type: "task_moved",
        taskId,
        toStatus: previous_task.status,
        toIndex: previous_task.rank,
      });
      return false;
    }
    showToast({ type: "success", message: "Task deleted" });
    return true;
  }

  // NOT optimistic, unlike the two above: a create has no id until the server
  // answers, and on failure the drawer has to stay open with the user's input
  // intact rather than swallow it.
  async function handleSubmitDrawer(
    draft: TaskDraft,
    initial_draft: TaskDraft
  ) {
    if (draft.categoryId === null) {
      return; // the drawer already blocks this, belt and braces
    }

    if (drawer_target.mode === "create") {
      try {
        const created = await createTask(projectId, {
          title: draft.title,
          categoryId: draft.categoryId,
          status: draft.status,
          priority: draft.priority,
          // append to the end of its column; the server clamps anyway
          rank: selectColumnTasks(tasks, draft.status).length,
          notes: draft.notes === "" ? undefined : draft.notes,
          onCalendar: false,
          assigneeIds: draft.assigneeIds,
        });
        dispatch({ type: "task_created", task: created });
      } catch (error) {
        console.error("Failed to create task", error);
        showToast({
          type: "error",
          message: errorMessage(error, "Failed to create task"),
        });
        return; // drawer stays open
      }
      showToast({ type: "success", message: "Task created" });
    } else {
      const taskId = drawer_target.taskId;
      // Only the fields that actually changed, measured against the draft the
      // drawer OPENED on. Resending all six would push the form's stale copy over
      // anything that moved while it was open - the form seeds its draft once and
      // never resyncs (see DrawerTarget above) - and it contradicts this
      // endpoint's own contract, which lib/tasks.ts states as "send only what you
      // mean to change". It matters most for assigneeIds, which REPLACES the whole
      // set: an untouched member list is now simply not sent.
      const updates: UpdateTaskBody = {};
      if (draft.title !== initial_draft.title) {
        updates.title = draft.title;
      }
      if (draft.categoryId !== initial_draft.categoryId) {
        updates.categoryId = draft.categoryId;
      }
      if (draft.status !== initial_draft.status) {
        updates.status = draft.status;
      }
      if (draft.priority !== initial_draft.priority) {
        updates.priority = draft.priority;
      }
      if (draft.notes !== initial_draft.notes) {
        updates.notes = draft.notes;
      }
      if (!sameAssignees(draft.assigneeIds, initial_draft.assigneeIds)) {
        updates.assigneeIds = draft.assigneeIds;
      }

      // Save with nothing touched: close, but don't send an empty PATCH and don't
      // claim a change was saved.
      if (Object.keys(updates).length === 0) {
        closeDrawer();
        return;
      }

      try {
        const updated = await updateTask(projectId, taskId, updates);
        // The whole task from the server, not a hand-built patch: it carries
        // the resolved assignees and any rank the server reshuffled.
        dispatch({ type: "task_updated", taskId, changes: updated });
      } catch (error) {
        console.error("Failed to update task", error);
        showToast({
          type: "error",
          message: errorMessage(error, "Failed to save changes"),
        });
        return; // drawer stays open
      }
      showToast({ type: "success", message: "Changes saved" });
    }
    closeDrawer();
  }

  // Resolved outside the JSX so a stale edit target (task deleted while its id
  // is still the drawer's target) just yields null instead of throwing.
  const editing_task =
    drawer_target.mode === "edit"
      ? (tasks.find((current) => current.id === drawer_target.taskId) ?? null)
      : null;

  return (
    // md:h-full of ProjectLayout's scroller: the board exactly fills it, so that
    // scroller never overflows and the COLUMNS scroll instead of the page.
    // Below md it is left to size itself, so the columns' min height (see
    // KanbanColumn) can push past the viewport and the TAB scrolls - bounding it
    // there would make the columns row scroll on its own axis instead, stacking
    // two vertical scrollbars.
    // Deliberately NOT `relative` - DrawerShell is absolute and has to span the
    // whole tab area, so its containing block must stay ProjectLayout's anchor.
    <div className="flex flex-col md:h-full">
      <p className="mb-4 shrink-0 text-sm text-text-secondary">
        Drag tasks between columns to track progress.
      </p>

      <KanbanBoard
        tasks={tasks}
        categories={loaderData.categories}
        onPreviewMove={handlePreviewMove}
        onMoveTask={handleMoveTask}
        onAddTask={(status) => openDrawer({ mode: "create", status })}
        onOpenTask={(taskId) => openDrawer({ mode: "edit", taskId })}
        onDeleteTask={handleDeleteTask}
      />

      {/* Rendered unconditionally, and never re-keyed: DrawerShell animates on
          isOpen and needs the panel to already be in the DOM, so remounting it
          on open would kill both the slide-in and the slide-out. `session` is
          what resets the form - the drawer keys it internally. */}
      <KanbanCardDrawer
        isOpen={drawer.isOpen}
        session={drawer.session}
        mode={drawer_target.mode}
        task={editing_task}
        initialStatus={
          drawer_target.mode === "create" ? drawer_target.status : "TODO"
        }
        categories={loaderData.categories}
        members={loaderData.members}
        onClose={closeDrawer}
        onSubmit={handleSubmitDrawer}
      />
    </div>
  );
}
