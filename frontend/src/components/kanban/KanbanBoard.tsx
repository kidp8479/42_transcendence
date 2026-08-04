// See DefenseReadiness.tsx (components/summary) for an explanation of the
// pattern every component here follows.
//
// The kanban board: the single DndContext over the four status columns. It
// owns no data - it translates dnd-kit events into "move task X to status S at
// index I" and hands that up to the route.
//
// A horizontally-scrolling row, not a responsive grid: inside a bounded tab
// area, stacking the columns would leave all but the first unreachable.
import { useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type {
  CollisionDetection,
  DragCancelEvent,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { STATUS_ORDER } from "@/lib/taskStatusStyles";
import { selectColumnTasks } from "@/lib/tasksReducer";
import type { Task, TaskStatus } from "@/lib/tasks";
import type { TaskCategory } from "@/lib/taskCategories";
import { KanbanColumn } from "./KanbanColumn";
import { TaskCard } from "./TaskCard";

interface KanbanBoardProps {
  tasks: Task[];
  categories: TaskCategory[];
  // local-only reposition, fired repeatedly while dragging
  onPreviewMove: (
    taskId: string,
    toStatus: TaskStatus,
    toIndex: number
  ) => void;
  // The persisted move, fired once on drop. `from` is where the card sat when
  // the gesture STARTED, which the previews above have since overwritten - the
  // route needs it to roll back a failed PATCH.
  onMoveTask: (
    taskId: string,
    toStatus: TaskStatus,
    toIndex: number,
    from: { status: TaskStatus; index: number }
  ) => void;
  onAddTask: (status: TaskStatus) => void;
  onOpenTask: (taskId: string) => void;
  // resolves to true once the task is really gone (the card's inline confirm
  // stays open otherwise)
  onDeleteTask: (taskId: string) => Promise<boolean>;
}

export function KanbanBoard({
  tasks,
  categories,
  onPreviewMove,
  onMoveTask,
  onAddTask,
  onOpenTask,
  onDeleteTask,
}: KanbanBoardProps) {
  // Id of the card currently being dragged - drives the DragOverlay copy.
  const [active_task_id, setActiveTaskId] = useState<string | null>(null);

  // The columns row, and the only subtree dnd-kit may auto-scroll (see the
  // DndContext's autoScroll below).
  const board_ref = useRef<HTMLDivElement | null>(null);

  const categories_by_id = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  // resolveDropTarget/columnIndexOf call this on every dragover tick (and
  // the render loop once per column), each a filter+sort over the whole
  // board - cheap for a handful of tasks, but no reason to redo the work
  // every pointer-move instead of once per actual task-list change.
  const columns_by_status = useMemo(() => {
    const columns = new Map<TaskStatus, Task[]>();
    for (const status of STATUS_ORDER) {
      columns.set(status, selectColumnTasks(tasks, status));
    }
    return columns;
  }, [tasks]);

  function columnTasks(status: TaskStatus): Task[] {
    return columns_by_status.get(status) ?? [];
  }

  // An 8px activation distance keeps plain clicks (open the drawer) from
  // starting a drag; the keyboard sensor makes cards draggable without a
  // pointer (pick up with Space/Enter, move with arrows).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const active_task =
    active_task_id !== null
      ? (tasks.find((task) => task.id === active_task_id) ?? null)
      : null;

  // Whether the dragged card should land after (not before) the card it's
  // hovering, based on which half of that card the pointer is currently over.
  // Without this, resolveDropTarget could only ever insert before the
  // hovered card - dropping on your very next neighbour was a no-op (already
  // immediately before it), and dropping on a column's last card could never
  // reach the end of the column, only just above it.
  function isPastMidpoint(
    active_rect: { top: number; height: number } | null,
    over_rect: { top: number; height: number }
  ): boolean {
    if (active_rect === null) {
      return false;
    }
    const active_center = active_rect.top + active_rect.height / 2;
    const over_center = over_rect.top + over_rect.height / 2;
    return active_center > over_center;
  }

  // A drop target is either a card (over.id = task id -> that card's column,
  // landing just before or after it depending on insert_after) or a column's
  // droppable area (over.id = status -> append at the end, which is how
  // empty columns accept drops).
  //
  // Both branches exclude the dragged card from the column before counting:
  // the backend's moveTask() computes `nextRank` the same way (`id: { not: id
  // }` on every rank query, see tasks.service.ts), since a same-column move
  // still has the card sitting in its old slot when the target column is
  // read. Counting it here too shifted every target after the card's own
  // position one slot too far - dropping card 1 of [1,2,3,4] onto 3 landed it
  // after 3 instead of before, because index 2 (3's position with card 1
  // still in the list) is where 3 sits once card 1 is actually removed.
  function resolveDropTarget(
    active_id: string,
    over_id: string,
    insert_after: boolean
  ): { status: TaskStatus; index: number } | null {
    const over_status = STATUS_ORDER.find((status) => status === over_id);
    if (over_status !== undefined) {
      return {
        status: over_status,
        index: columnTasks(over_status).filter((task) => task.id !== active_id)
          .length,
      };
    }
    const over_task = tasks.find((task) => task.id === over_id);
    if (over_task === undefined) {
      return null;
    }
    // Hovering the dragged card's own slot - this happens crossing into a
    // column where it ends up the sole/closest item (an empty column, or one
    // it now occupies alone after a preview move), so dnd-kit reports it as
    // its own collision target. Excluding it from the column like every other
    // case would findIndex() it out of existence (-1, sent to the backend as
    // a negative rank). Its current index is already the right answer here -
    // there's no other card to land before or after.
    if (over_id === active_id) {
      return {
        status: over_task.status,
        index: columnIndexOf(active_id, over_task.status),
      };
    }
    const column = columnTasks(over_task.status).filter(
      (task) => task.id !== active_id
    );
    const over_index = column.findIndex((task) => task.id === over_task.id);
    return {
      status: over_task.status,
      index: insert_after ? over_index + 1 : over_index,
    };
  }

  // Where the dragged card sat when the gesture started. A ref, not state:
  // it must be readable inside handleDragEnd during the same gesture, and it
  // drives nothing visual. handleDragOver rewrites the board as the card
  // crosses columns, so by the drop the card's live position is no longer its
  // starting one - this is what "did anything actually change?" compares to,
  // and what a cancelled drag restores.
  const drag_origin = useRef<{ status: TaskStatus; index: number } | null>(
    null
  );

  function columnIndexOf(taskId: string, status: TaskStatus): number {
    return columnTasks(status).findIndex((task) => task.id === taskId);
  }

  function handleDragStart(event: DragStartEvent) {
    const task_id = String(event.active.id);
    setActiveTaskId(task_id);

    const dragged_task = tasks.find((task) => task.id === task_id);
    drag_origin.current =
      dragged_task === undefined
        ? null
        : {
            status: dragged_task.status,
            index: columnIndexOf(task_id, dragged_task.status),
          };
  }

  // Undoes the mid-drag previews. Every path that ends a gesture WITHOUT
  // persisting has to call this, or the card stays in the column it was merely
  // hovering while the server still has it in the old one.
  function restoreOrigin(
    taskId: string,
    origin: { status: TaskStatus; index: number } | null
  ) {
    if (origin !== null) {
      onPreviewMove(taskId, origin.status, origin.index);
    }
  }

  function handleDragCancel(event: DragCancelEvent) {
    setActiveTaskId(null);
    const origin = drag_origin.current;
    drag_origin.current = null;
    restoreOrigin(String(event.active.id), origin);
  }

  // Cross-column moves are applied live while dragging, so the card visually
  // leaves its old column as soon as it hovers a new one. Same-column
  // reordering waits for the drop (dnd-kit already previews it with
  // transforms).
  //
  // onPreviewMove, NOT onMoveTask: this fires once per column crossed, and
  // persisting here would mean several PATCHes - each followed by a route
  // invalidation that reshuffles the board mid-gesture. A drag is one PATCH,
  // sent on drop.
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (over === null || active.id === over.id) {
      return;
    }
    const dragged_task = tasks.find((task) => task.id === active.id);
    const insert_after = isPastMidpoint(
      active.rect.current.translated,
      over.rect
    );
    const target = resolveDropTarget(
      String(active.id),
      String(over.id),
      insert_after
    );
    if (dragged_task === undefined || target === null) {
      return;
    }
    if (target.status !== dragged_task.status) {
      onPreviewMove(dragged_task.id, target.status, target.index);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTaskId(null);
    const origin = drag_origin.current;
    drag_origin.current = null;

    const { active, over } = event;
    const task_id = String(active.id);
    // Released outside every droppable: not a move, so undo the previews.
    if (over === null) {
      restoreOrigin(task_id, origin);
      return;
    }
    const dragged_task = tasks.find((task) => task.id === task_id);
    const insert_after = isPastMidpoint(
      active.rect.current.translated,
      over.rect
    );
    const target = resolveDropTarget(task_id, String(over.id), insert_after);
    // Unresolvable drop (or no origin recorded at dragStart, in which case
    // restoreOrigin is a no-op): treat it as a non-move.
    if (dragged_task === undefined || target === null || origin === null) {
      restoreOrigin(task_id, origin);
      return;
    }
    // Dropped back on its starting slot - nothing to persist. Compared against
    // the origin, not the card's current position, which handleDragOver may
    // already have changed. The previews already left it there, so no restore.
    if (target.status === origin.status && target.index === origin.index) {
      return;
    }
    // The route persists this (one PATCH { status, rank }) and rolls back to
    // `origin` on failure - the board itself stays pure and prop-driven.
    onMoveTask(task_id, target.status, target.index, origin);
  }

  // closestCorners alone measures every droppable board-wide by corner
  // distance, with no notion of "which container is the pointer actually
  // over." An empty column's droppable is the whole (generously sized) card
  // list area, but a card sitting in the NEXT column over can still have a
  // numerically closer corner - especially near the boundary between
  // columns - so the empty column was sometimes unreachable, landing the
  // drop in a neighbour instead. pointerWithin checks literal containment
  // (is the pointer actually inside this rect?) first, which has no such
  // cross-column ambiguity; closestCorners is the fallback because
  // pointerWithin returns nothing for keyboard-driven drags (no pointer
  // coordinates to test).
  const collisionDetection: CollisionDetection = (args) => {
    const pointer_collisions = pointerWithin(args);
    return pointer_collisions.length > 0
      ? pointer_collisions
      : closestCorners(args);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      // Auto-scroll is confined to the board. By default dnd-kit scrolls the
      // nearest scrollable ancestor, and AuthenticatedLayout's <main> qualifies:
      // `overflow-x-hidden` still scrolls programmatically. Dragging to the
      // right edge slid the whole page sideways onto the closed drawer, which is
      // parked off-screen in `translate-x-full` and only hidden by that very
      // overflow - hence the empty area. contains() covers the row itself, so
      // the board still scrolls sideways when the columns overflow, and each
      // column's card list still scrolls vertically.
      autoScroll={{
        canScroll: (element) => board_ref.current?.contains(element) ?? false,
      }}
    >
      {/* min-h-0 is what hands a definite height down to the columns (without
          it a flex child refuses to shrink below its content). pb-2 keeps the
          horizontal scrollbar off the columns' bottom edge. dnd-kit
          auto-scrolls this container when a dragged card reaches its edge. */}
      <div
        ref={board_ref}
        className="scrollbar-thin-surface flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2"
      >
        {STATUS_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={columnTasks(status)}
            categoriesById={categories_by_id}
            onAddTask={() => onAddTask(status)}
            onOpenTask={onOpenTask}
            onDeleteTask={onDeleteTask}
          />
        ))}
      </div>

      {/* Floating copy of the dragged card. The card is opaque on its own, so
          the wrapper only adds the shadow that lifts it off the board.
          DragOverlay renders into its own position:fixed wrapper, so the row's
          overflow doesn't clip it.

          zIndex is load-bearing: dnd-kit defaults to 999, and the overlay sits
          in the same stacking context as the drawer (ProjectLayout's `isolate`
          anchor), so it painted over a drawer that only claims z-40. The click
          that opens a drawer also counts as a drag once it passes the 8px
          threshold, so the overlay's drop animation played on top of the panel.
          30 keeps it above the columns, which claim no z-index at all. */}
      <DragOverlay zIndex={30}>
        {active_task !== null && (
          <div className="rounded-lg shadow-2xl">
            <TaskCard
              task={active_task}
              category={
                active_task.categoryId !== null
                  ? (categories_by_id.get(active_task.categoryId) ?? null)
                  : null
              }
              onOpen={() => {}}
              onDelete={() => Promise.resolve(false)}
              isOverlay
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
