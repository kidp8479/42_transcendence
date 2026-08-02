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
  updateTask,
  type TaskAssigneeUser,
  type TaskStatus,
} from "@/lib/tasks";
import { listTaskCategories } from "@/lib/taskCategories";
import { getMembers } from "@/lib/projectMembersApi";
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

// What the drawer is pointed at. Edit stores the task ID (not the task): the
// rendered drawer resolves the live task from state, so it stays fresh if a
// future WebSocket update touches the task mid-edit.
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

function KanbanPage() {
  const { projectId } = Route.useParams();
  const loaderData = Route.useLoaderData();
  const safeInvalidateRouter = useSafeRouterInvalidate();
  const { showToast } = useToast();

  // All task changes flow through the reducer (lib/tasksReducer.ts) - the
  // future WebSocket handler will dispatch these same actions, so board
  // interactions and remote events stay one code path.
  //
  // Deliberately NOT calling safeInvalidateRouter() after a successful mutation,
  // unlike discovery.tsx. Every mutation here already dispatches the task the
  // server returned, so the refetch added nothing - it just rebuilt all four
  // columns from scratch, which visibly jolted cards the user never touched. It
  // is also the wrong shape for the realtime layer to come: the loader hands
  // back a full SNAPSHOT asynchronously, so once remote events start arriving a
  // late response would overwrite a change that had just been applied. The only
  // survivor is the 409 path below, where the local state really is worthless.
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
    if (!tasks.some((current) => current.id === taskId)) {
      return false;
    }
    // Snapshot, not a task_created replay: that appends the card and re-sorts
    // by rank, and since deleting already pulled its old neighbour up to the
    // freed rank, the restored card ties with it and lands one slot too low.
    const previous_tasks = tasks;

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
      dispatch({ type: "tasks_loaded", tasks: previous_tasks });
      return false;
    }
    showToast({ type: "success", message: "Task deleted" });
    return true;
  }

  // NOT optimistic, unlike the two above: a create has no id until the server
  // answers, and on failure the drawer has to stay open with the user's input
  // intact rather than swallow it.
  async function handleSubmitDrawer(draft: TaskDraft) {
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
      try {
        const updated = await updateTask(projectId, taskId, {
          title: draft.title,
          categoryId: draft.categoryId,
          status: draft.status,
          priority: draft.priority,
          notes: draft.notes,
          assigneeIds: draft.assigneeIds,
        });
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
    // h-full of ProjectLayout's scroller: the board exactly fills it, so that
    // scroller never overflows and the COLUMNS scroll instead of the page.
    // Deliberately NOT `relative` - DrawerShell is absolute and has to span the
    // whole tab area, so its containing block must stay ProjectLayout's anchor.
    <div className="flex h-full flex-col">
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
