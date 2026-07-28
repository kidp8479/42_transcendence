// See DefenseReadiness.tsx (components/summary) for an explanation of the
// pattern every component here follows.
//
// The kanban board: the outer contour around all four status columns, and
// the single DndContext coordinating drag-and-drop between them. All state
// changes go up through callbacks (the route owns the data) - this component
// only translates dnd-kit events into "move task X to status S at index I".
import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type {
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
  onMoveTask: (taskId: string, toStatus: TaskStatus, toIndex: number) => void;
  onAddTask: (status: TaskStatus) => void;
  onOpenTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}

export function KanbanBoard({
  tasks,
  categories,
  onMoveTask,
  onAddTask,
  onOpenTask,
  onDeleteTask,
}: KanbanBoardProps) {
  // Id of the card currently being dragged - drives the DragOverlay copy.
  const [active_task_id, setActiveTaskId] = useState<string | null>(null);

  const categories_by_id = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

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

  // A drop target is either a card (over.id = task id -> that card's column
  // and index) or a column's droppable area (over.id = status -> append at
  // the end, which is how empty columns accept drops).
  function resolveDropTarget(
    over_id: string
  ): { status: TaskStatus; index: number } | null {
    const over_status = STATUS_ORDER.find((status) => status === over_id);
    if (over_status !== undefined) {
      return {
        status: over_status,
        index: selectColumnTasks(tasks, over_status).length,
      };
    }
    const over_task = tasks.find((task) => task.id === over_id);
    if (over_task === undefined) {
      return null;
    }
    const column = selectColumnTasks(tasks, over_task.status);
    return {
      status: over_task.status,
      index: column.findIndex((task) => task.id === over_task.id),
    };
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveTaskId(String(event.active.id));
  }

  // Cross-column moves are applied live while dragging, so the card visually
  // leaves its old column as soon as it hovers a new one. Same-column
  // reordering waits for the drop (dnd-kit already previews it with
  // transforms). The reducer reindexes on every move, so dispatching from
  // both dragOver and dragEnd is harmless.
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (over === null || active.id === over.id) {
      return;
    }
    const dragged_task = tasks.find((task) => task.id === active.id);
    const target = resolveDropTarget(String(over.id));
    if (dragged_task === undefined || target === null) {
      return;
    }
    if (target.status !== dragged_task.status) {
      onMoveTask(dragged_task.id, target.status, target.index);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTaskId(null);
    const { active, over } = event;
    if (over === null) {
      return;
    }
    const dragged_task = tasks.find((task) => task.id === active.id);
    const target = resolveDropTarget(String(over.id));
    if (dragged_task === undefined || target === null) {
      return;
    }
    onMoveTask(dragged_task.id, target.status, target.index);
    // TODO: when the backend lands, persist here with
    // updateTask(projectId, taskId, { status, rank }, csrfToken) from
    // lib/tasks.ts - shifting the sibling ranks server-side is the backend's
    // job (the PATCH DTO only carries the moved task).
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTaskId(null)}
    >
      {/* Layer 1 of the board's colors: a neutral contour around all columns
          (layers 2 and 3 - column and card tints - live in
          lib/taskStatusStyles.ts). */}
      <div className="rounded-xl border border-surface-border bg-surface-raised/50 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STATUS_ORDER.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={selectColumnTasks(tasks, status)}
              categoriesById={categories_by_id}
              onAddTask={() => onAddTask(status)}
              onOpenTask={onOpenTask}
              onDeleteTask={onDeleteTask}
            />
          ))}
        </div>
      </div>

      {/* Floating copy of the dragged card. Cards have translucent status
          tints, so the overlay adds a solid surface behind - a see-through
          card floating over other columns would be unreadable. */}
      <DragOverlay>
        {active_task !== null && (
          <div className="rounded-lg bg-surface-overlay shadow-2xl">
            <TaskCard
              task={active_task}
              category={
                active_task.categoryId !== null
                  ? (categories_by_id.get(active_task.categoryId) ?? null)
                  : null
              }
              onOpen={() => {}}
              onDelete={() => {}}
              isOverlay
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
