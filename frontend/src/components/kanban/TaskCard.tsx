// See DefenseReadiness.tsx (components/summary) for an explanation of the
// pattern every component here follows.
//
// One draggable card on the kanban board: category badge, priority dot,
// title, assignee avatars, and a "..." menu (edit/delete). Clicking the card
// body opens the detail drawer; dragging it is told apart from clicking by
// the board's PointerSensor activation distance (see KanbanBoard).
//
// The same component renders the floating copy inside the board's
// DragOverlay (isOverlay): that copy must not register itself as a sortable
// (it would collide with the real card, which keeps its place in the column
// at reduced opacity while the overlay follows the pointer).
import { Dropdown, DropdownItem } from "flowbite-react";
import {
  HiDotsHorizontal,
  HiOutlinePencil,
  HiOutlineTrash,
} from "react-icons/hi";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { STATUS_STYLES } from "@/lib/taskStatusStyles";
import { darkDropdownTheme } from "@/lib/flowbite";
import type { Task } from "@/lib/tasks";
import type { TaskCategory } from "@/lib/taskCategories";
import { TaskAssignees } from "./TaskAssignees";
import { TaskCategoryBadge } from "./TaskCategoryBadge";
import { TaskPriorityDot } from "./TaskPriorityDot";

interface TaskCardProps {
  task: Task;
  // resolved by the parent from task.categoryId (the route owns data joining)
  category: TaskCategory | null;
  onOpen: () => void;
  onDelete: () => void;
  isOverlay?: boolean;
}

export function TaskCard({
  task,
  category,
  onOpen,
  onDelete,
  isOverlay = false,
}: TaskCardProps) {
  // Hooks can't be conditional, so the overlay copy calls useSortable too but
  // disabled - it then registers nothing with the surrounding DndContext.
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: isOverlay });

  const status_style = STATUS_STYLES[task.status];

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      // Inline transform/transition is the standard dnd-kit wiring (dynamic
      // per-frame values, same exception as progress-bar widths).
      style={
        isOverlay
          ? undefined
          : { transform: CSS.Transform.toString(transform), transition }
      }
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      onClick={onOpen}
      className={`flex cursor-grab flex-col gap-2 rounded-lg border p-3 ${status_style.card} ${status_style.cardHover} ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-center gap-2">
        <TaskCategoryBadge category={category} />
        <div className="ml-auto flex items-center gap-1">
          <TaskPriorityDot priority={task.priority} />
          {/* stopPropagation on pointerdown keeps the menu from starting a
              drag, on click from opening the drawer - for the trigger and
              the menu items alike. */}
          {!isOverlay && (
            <span
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <Dropdown
                arrowIcon={false}
                inline
                placement="bottom-end"
                theme={darkDropdownTheme}
                renderTrigger={() => (
                  <button
                    type="button"
                    aria-label={`Open menu for task "${task.title}"`}
                    className="rounded p-0.5 text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
                  >
                    <HiDotsHorizontal aria-hidden="true" />
                  </button>
                )}
              >
                <DropdownItem icon={HiOutlinePencil} onClick={onOpen}>
                  Edit
                </DropdownItem>
                <DropdownItem icon={HiOutlineTrash} onClick={onDelete}>
                  Delete
                </DropdownItem>
              </Dropdown>
            </span>
          )}
        </div>
      </div>

      <p className="text-sm font-semibold text-text-primary">{task.title}</p>

      <TaskAssignees assignees={task.assignees} />
    </div>
  );
}
