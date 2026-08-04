// See DefenseReadiness.tsx (components/summary) for an explanation of the
// pattern every component here follows.
//
// One status column of the kanban board: a neutral outline, a header whose icon
// and count carry the status colour (see lib/taskStatusStyles.ts), the sortable
// card list, and a bottom "Add task" button wearing that same colour outright.
// Receives its tasks already filtered and rank-sorted (selectColumnTasks in the
// route) - this component does no data shaping of its own.
//
// The column is a bounded flex box: the header and the "Add task" footer stay
// put while the card list scrolls between them. That's the min-h-0 + flex-1 +
// overflow-y-auto trio below.
import { HiPlus } from "react-icons/hi";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { STATUS_STYLES } from "@/lib/taskStatusStyles";
import type { Task, TaskStatus } from "@/lib/tasks";
import type { TaskCategory } from "@/lib/taskCategories";
import { AddTaskButton } from "./AddTaskButton";
import { EmptyColumnState } from "./EmptyColumnState";
import { TaskCard } from "./TaskCard";

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  categoriesById: Map<string, TaskCategory>;
  onAddTask: () => void;
  onOpenTask: (taskId: string) => void;
  // resolves to true once the task is really gone (the card's inline confirm
  // stays open otherwise)
  onDeleteTask: (taskId: string) => Promise<boolean>;
}

export function KanbanColumn({
  status,
  tasks,
  categoriesById,
  onAddTask,
  onOpenTask,
  onDeleteTask,
}: KanbanColumnProps) {
  const status_style = STATUS_STYLES[status];
  const heading_id = `kanban-column-${status}`;

  // The card list is a droppable of its own (id = the status string) so a
  // card dragged over an EMPTY column still has a drop target to resolve to -
  // with no cards there are no sortable items to collide with.
  const { setNodeRef } = useDroppable({ id: status });

  return (
    <section
      aria-labelledby={heading_id}
      // min-h-96 below md: on a phone the bounded shell leaves the board barely
      // 300px, which showed a single card. The floor makes the column usable and
      // the tab scrolls to reveal it. md:min-h-0 restores the desktop rule,
      // where the column must be free to shrink so its card list scrolls.
      className="flex min-h-96 min-w-72 flex-1 flex-col gap-3 rounded-lg border border-surface-border p-3 md:min-h-0"
    >
      {/* Every edge on the board is this same neutral grey. The status shows on
          the icon and the count instead; the title stays neutral so the header
          does not become one block of colour. pb-3 matches the section's gap-3,
          so the cards start as far below the rule as the title sits above it. */}
      <div className="flex shrink-0 items-center gap-2 border-b border-surface-border pb-3">
        <status_style.icon
          className={status_style.headerIcon}
          aria-hidden="true"
        />
        <h2
          id={heading_id}
          className="font-mono text-sm font-semibold text-text-primary"
        >
          {status_style.label}
        </h2>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${status_style.statusPill}`}
        >
          {tasks.length}
        </span>
        <button
          type="button"
          onClick={onAddTask}
          aria-label={`Add task in ${status_style.label}`}
          // No hover fill on purpose: the glyph alone answers the pointer, by
          // taking the column's colour.
          className={`ml-auto rounded-md p-1 text-text-secondary transition-colors focus:ring-2 focus:ring-brand-500/40 focus:outline-none ${status_style.headerAddHover}`}
        >
          <HiPlus aria-hidden="true" />
        </button>
      </div>

      <SortableContext
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        {/* The scroller. Deliberately NOT `relative`: a positioned scroller
            would become the containing block for the cards' "..." menus
            (flowbite renders them inline, not in a portal) and clip them. */}
        <div
          ref={setNodeRef}
          className="scrollbar-thin-surface flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto"
        >
          {tasks.length === 0 ? (
            <EmptyColumnState />
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                category={
                  task.categoryId !== null
                    ? (categoriesById.get(task.categoryId) ?? null)
                    : null
                }
                onOpen={onOpenTask}
                onDelete={onDeleteTask}
              />
            ))
          )}
        </div>
      </SortableContext>

      <AddTaskButton
        onClick={onAddTask}
        statusClassName={status_style.addTask}
      />
    </section>
  );
}
