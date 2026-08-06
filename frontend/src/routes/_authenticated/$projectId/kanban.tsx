import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  // ?task=<id> opens the board with that card's drawer already open. It exists
  // for the search results, which used to drop you on the board and leave you
  // to find the card yourself. Optional and permissive: an unknown id just
  // opens the board, it never errors.
  validateSearch: (search: Record<string, unknown>): { task?: string } =>
    typeof search.task === "string" ? { task: search.task } : {},
  loader: (routeContext) => loadKanbanPageData(routeContext.params.projectId),
  component: KanbanPage,
});

// What the drawer is pointed at. Edit stores the task ID (not the task), so a
// task deleted from under an open drawer resolves to null instead of a
// dangling object. This does NOT make the open FORM fresh: it seeds its draft
// once at mount and never resyncs, so a remote change lands in `tasks` and on
// the card but not in the open form's fields. Save works around it by only
// sending fields the user actually changed - see handleSubmitDrawer. A
// live-resyncing draft (a real per-field lock, like Discovery/the checklist
// have) would close this properly but is a bigger change, not done here.
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
  const { task: taskIdFromUrl } = Route.useSearch();
  const navigate = useNavigate();
  const safeInvalidateRouter = useSafeRouterInvalidate();
  const { showToast } = useToast();

  // All task changes flow through the reducer (lib/tasksReducer.ts) - both
  // local board interactions AND the WS handler below dispatch these same
  // actions, so remote events and this client's own edits stay one code path.
  //
  // Deliberately NOT calling safeInvalidateRouter() after a mutation, unlike
  // discovery.tsx: every mutation here already dispatches the task the server
  // returned, so a refetch just rebuilt all four columns and jolted cards the
  // user never touched. It would also fight the realtime layer below - a late
  // loader snapshot could overwrite a remote change that arrived over the
  // socket meanwhile. The only survivor is the 409 path, where local state
  // really is worthless.
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

  // Kept fresh every render, read from inside the stable callbacks below
  // instead of closing over `tasks`/`drawer_target` directly - otherwise
  // those callbacks (and anything memoized against their identity, like
  // TaskCard) would get a new reference on every board update, which now
  // includes every realtime broadcast, not just this client's own edits.
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const drawerTargetRef = useRef(drawer_target);
  drawerTargetRef.current = drawer_target;

  const openDrawer = useCallback((target: DrawerTarget) => {
    setDrawer((current) => ({
      target,
      isOpen: true,
      session: current.session + 1,
    }));
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawer((current) => ({ ...current, isOpen: false }));
  }, []);

  // ?task=<id> (a search result linking straight at a card) opens that card's
  // drawer, then drops the parameter from the URL with a replace: it has done
  // its job, and leaving it there would reopen the drawer on every reload and
  // on every Back into this page. An id that isn't on this board - a stale
  // link, another project's task - is dropped just as quietly.
  const openedFromUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!taskIdFromUrl || openedFromUrlRef.current === taskIdFromUrl) {
      return;
    }
    openedFromUrlRef.current = taskIdFromUrl;

    if (tasksRef.current.some((task) => task.id === taskIdFromUrl)) {
      openDrawer({ mode: "edit", taskId: taskIdFromUrl });
    }
    void navigate({
      to: "/$projectId/kanban",
      params: { projectId },
      search: {},
      replace: true,
      // Same route, same params - this is a URL rewrite, not a page change,
      // and jumping the board back to the top would undo the scroll the
      // drawer opening just implied.
      resetScroll: false,
    });
  }, [taskIdFromUrl, openDrawer, navigate, projectId]);

  // Live board sync: remote broadcasts from tasks.service.ts's
  // emitToProject calls dispatch into the same reducer as local edits, same
  // pattern as discovery.tsx's own socket.on/off effects. No sender
  // exclusion server-side, so this client's own actions echo back too -
  // every action tasksReducer.ts handles is idempotent against that.
  //
  // projectId in deps (unlike discovery.tsx's empty array): the handlers
  // below now filter events by it, and a stale closure would silently drop
  // every future event if this route ever re-rendered with a new project id
  // without remounting. dispatch/setDrawer are still stable setters, so
  // that's the only value actually needed here.
  useEffect(() => {
    const socket = getRealtimeSocket();

    // A socket joins every project room a user is a MEMBER of, not just the
    // one this page is showing - without the projectId check in each
    // handler below, an event from an unrelated project (open in another
    // tab, or just one you belong to) would corrupt this board.
    function handleTaskCreated(payload: unknown) {
      const task = parseTask(payload);
      if (task === null || task.projectId !== projectId) {
        return;
      }
      dispatch({ type: "task_created", task });
    }

    function handleTaskUpdated(payload: unknown) {
      if (
        !isRecord(payload) ||
        typeof payload.taskId !== "string" ||
        payload.projectId !== projectId
      ) {
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
        payload.projectId !== projectId ||
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
      if (
        !isRecord(payload) ||
        typeof payload.taskId !== "string" ||
        payload.projectId !== projectId
      ) {
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
  }, [projectId]);

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
  // Reads tasksRef/drawerTargetRef, not tasks/drawer_target directly, so
  // this callback's own identity stays stable - see the refs' own comment.
  const handleDeleteTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      // The card itself, not a snapshot of the whole board - see the rollback below.
      const previous_task = tasksRef.current.find(
        (current) => current.id === taskId
      );
      if (previous_task === undefined) {
        return false;
      }

      dispatch({ type: "task_deleted", taskId });
      // The drawer no longer unmounts when it closes, so it can't be left
      // pointing at a task that just disappeared - it would render an empty form.
      const current_drawer_target = drawerTargetRef.current;
      if (
        current_drawer_target.mode === "edit" &&
        current_drawer_target.taskId === taskId
      ) {
        closeDrawer();
      }

      try {
        await deleteTask(projectId, taskId);
      } catch (error) {
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
    },
    [projectId, dispatch, showToast, closeDrawer]
  );

  // Stable for the same reason as handleDeleteTask above - passed straight
  // through KanbanBoard/KanbanColumn to every TaskCard's onOpen.
  const handleOpenTask = useCallback(
    (taskId: string) => openDrawer({ mode: "edit", taskId }),
    [openDrawer]
  );

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

      function setIfChanged<K extends keyof UpdateTaskBody>(
        key: K,
        current: UpdateTaskBody[K],
        previous: UpdateTaskBody[K]
      ) {
        if (current !== previous) {
          updates[key] = current;
        }
      }

      // categoryId and assigneeIds stay their own explicit checks instead of
      // going through setIfChanged: categoryId is `string | null` on the
      // draft but `string | undefined` on UpdateTaskBody (draft.categoryId
      // is narrowed non-null by the guard above, initial_draft.categoryId
      // isn't), and assigneeIds needs set-equality (sameAssignees), not
      // reference/primitive comparison.
      setIfChanged("title", draft.title, initial_draft.title);
      setIfChanged("status", draft.status, initial_draft.status);
      setIfChanged("priority", draft.priority, initial_draft.priority);
      setIfChanged("notes", draft.notes, initial_draft.notes);
      if (draft.categoryId !== initial_draft.categoryId) {
        updates.categoryId = draft.categoryId;
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
        // Split in two rather than one task_updated carrying the whole
        // response: status/rank are deliberately left out of this dispatch
        // and applied separately below via task_moved when they changed -
        // the exact same action type (and shape) a remote client gets for
        // this identical change over the socket, so both converge on
        // task_moved's own reindex logic instead of two independently
        // written ones that happen to agree today.
        dispatch({
          type: "task_updated",
          taskId,
          changes: {
            title: updated.title,
            categoryId: updated.categoryId,
            priority: updated.priority,
            notes: updated.notes,
            assignees: updated.assignees,
          },
        });
        if (updates.status !== undefined) {
          dispatch({
            type: "task_moved",
            taskId,
            toStatus: updated.status,
            toIndex: updated.rank,
          });
        }
      } catch (error) {
        // Same reasoning as handleMoveTask's 409 branch: a serialization
        // conflict means the board moved under this edit, so the open
        // draft is stale - reload instead of leaving it open showing data
        // that no longer matches the server.
        if (error instanceof ApiError && error.status === 409) {
          showToast({
            type: "error",
            message: "Task changed while you were editing, reloading",
          });
          await safeInvalidateRouter();
          closeDrawer();
          return;
        }
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
    // md:h-full of ProjectLayout's scroller: the board fills it exactly, so
    // each column scrolls on its own instead of the page, as long as that
    // scroller has room (see ProjectLayout.tsx) - enough cards still grow the
    // whole page, same as any tab. Below md it sizes itself instead, so the
    // columns' min height (KanbanColumn) can push past the viewport and the
    // tab scrolls - bounding it there would stack two vertical scrollbars.
    // Deliberately NOT `relative` - DrawerShell is absolute and has to span
    // the whole tab area, so its containing block must stay ProjectLayout's
    // anchor.
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
        onOpenTask={handleOpenTask}
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
