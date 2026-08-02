// See DefenseReadiness.tsx (components/summary) for an explanation of the
// pattern every component here follows.
//
// One draggable card on the kanban board: category badge, priority dot,
// title, assignee avatars, and a "..." menu (edit/delete). Clicking the card
// body opens the detail drawer; dragging it is told apart from clicking by
// the board's PointerSensor activation distance (see KanbanBoard).
//
// Deleting swaps the card for an inline confirmation, the same house pattern
// as ProjectCard/DiscoveryBlockCard - deliberately lighter than theirs
// though: no "type the title to confirm". A project is a whole workspace; a
// task is one row among dozens, cheap to recreate, and retyping a title for
// each one would be hostile.
//
// Keyboard note: the card can't be opened with Enter, because dnd-kit's
// sortable attributes claim Enter/Space for picking a card up. The "..."
// menu's Edit item is the keyboard path to the drawer.
//
// The same component renders the floating copy inside the board's
// DragOverlay (isOverlay): that copy must not register itself as a sortable
// (it would collide with the real card, which keeps its place in the column
// at reduced opacity while the overlay follows the pointer).
import { useEffect, useState } from "react";
import {
  Button,
  Dropdown,
  DropdownDivider,
  DropdownItem,
} from "flowbite-react";
import {
  HiDotsHorizontal,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineX,
} from "react-icons/hi";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getCategoryColor } from "@/lib/categoryColorPalette";
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
  // resolves to true once the task is really gone - the card only leaves its
  // confirmation state then, so a failed delete keeps the confirm open
  onDelete: () => Promise<boolean>;
  isOverlay?: boolean;
}

// Rounds the item hover highlight, which darkDropdownTheme leaves
// rectangular. Same local override as ProjectCard/DiscoveryBlockCard.
const roundedDropdownItemTheme = {
  container: "mx-1",
  base: "rounded-md",
};

export function TaskCard({
  task,
  category,
  onOpen,
  onDelete,
  isOverlay = false,
}: TaskCardProps) {
  const [is_confirming_delete, setIsConfirmingDelete] = useState(false);
  const [is_deleting, setIsDeleting] = useState(false);

  // Hooks can't be conditional, so the overlay copy calls useSortable too but
  // disabled - it then registers nothing with the surrounding DndContext.
  // Confirming also disables it: a card being deleted shouldn't be draggable.
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: isOverlay || is_confirming_delete,
  });

  // Escape cancels the confirmation, same as DiscoveryBlockCard's.
  useEffect(() => {
    if (!is_confirming_delete) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsConfirmingDelete(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [is_confirming_delete]);

  // An uncategorized task is a real case (Task.categoryId is nullable), and it
  // must NOT fall back to palette index 0 - that is a real category's colour,
  // and borrowing it would say something untrue about the card. A muted grey
  // instead, matching the "Uncategorized" badge's own text-text-muted.
  const hover_border =
    category !== null
      ? getCategoryColor(category.color).hoverBorder
      : "hover:border-text-muted";

  // dnd-kit's transform/transition: inline is the standard wiring for
  // per-frame values (same exception as progress-bar widths).
  const sortable_style = isOverlay
    ? undefined
    : { transform: CSS.Transform.toString(transform), transition };

  async function handleConfirmDelete() {
    setIsDeleting(true);
    try {
      if (await onDelete()) {
        setIsConfirmingDelete(false);
      }
    } finally {
      setIsDeleting(false);
    }
  }

  if (is_confirming_delete) {
    return (
      // Keeps setNodeRef so the id stays registered with the surrounding
      // SortableContext (dnd-kit warns about missing nodes otherwise), but
      // spreads no listeners/attributes and takes no onClick: while
      // confirming, the card is neither draggable nor click-to-open.
      <div
        ref={isOverlay ? undefined : setNodeRef}
        style={sortable_style}
        className="flex flex-col gap-3 rounded-lg border border-control-error bg-surface-raised p-3"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-text-primary">
            Delete task?
          </p>
          <button
            type="button"
            aria-label="Cancel delete task"
            onClick={() => setIsConfirmingDelete(false)}
            className="rounded-md p-1 text-text-muted hover:bg-surface-overlay hover:text-text-primary focus:ring-2 focus:ring-brand-500/40 focus:outline-none"
          >
            <HiOutlineX className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <p
          className="line-clamp-2 text-xs text-text-secondary"
          title={task.title}
        >
          {task.title}
        </p>

        <div className="flex gap-2">
          <Button
            type="button"
            size="xs"
            onClick={handleConfirmDelete}
            disabled={is_deleting}
            className="flex-1 bg-control-error !text-white hover:bg-red-700 focus:ring-4 focus:ring-red-300 focus:outline-none focus-visible:outline-none dark:bg-control-error dark:hover:bg-red-700 dark:focus:ring-red-800"
          >
            {is_deleting ? "Deleting..." : "Delete"}
          </Button>
          <Button
            type="button"
            size="xs"
            onClick={() => setIsConfirmingDelete(false)}
            disabled={is_deleting}
            className="flex-1 border border-control-border bg-transparent! text-text-secondary! hover:bg-surface-overlay! hover:text-text-primary! focus:ring-2 focus:ring-brand-500/40 focus:outline-none! focus-visible:outline-none"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={sortable_style}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      onClick={onOpen}
      // Neutral at rest; hovering reveals the CATEGORY's colour on the border,
      // which is the card's only tie to its category besides the badge. Nothing
      // here depends on the task's status - the column already states it.
      className={`flex cursor-grab flex-col gap-2 rounded-lg border border-surface-border bg-surface-raised p-3 transition-colors hover:bg-surface-overlay ${hover_border} ${isDragging ? "opacity-40" : ""}`}
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
                // Load-bearing: flowbite's own default theme sets
                // dark:border-none, which silently deletes the border-style
                // darkDropdownTheme sets. See the long explanation in
                // ProjectCard.tsx - border-solid specifically is what beats it.
                className="border-solid dark:border-solid"
                renderTrigger={() => (
                  <button
                    type="button"
                    aria-label={`Open menu for task "${task.title}"`}
                    className="rounded-md p-1 text-text-muted hover:bg-surface-overlay hover:text-text-primary focus:ring-2 focus:ring-brand-500/40 focus:outline-none"
                  >
                    <HiDotsHorizontal className="h-5 w-5" aria-hidden="true" />
                  </button>
                )}
              >
                <DropdownItem
                  icon={HiOutlinePencil}
                  theme={roundedDropdownItemTheme}
                  onClick={onOpen}
                >
                  Edit
                </DropdownItem>
                <DropdownDivider />
                <DropdownItem
                  icon={HiOutlineTrash}
                  theme={roundedDropdownItemTheme}
                  className="text-control-error! dark:text-control-error!"
                  onClick={() => setIsConfirmingDelete(true)}
                >
                  Delete
                </DropdownItem>
              </Dropdown>
            </span>
          )}
        </div>
      </div>

      {/* Two lines then an ellipsis, same as the confirm state above.
          wrap-break-word is what handles the pathological case: a title with no
          space in it can't wrap, so without it the clamp has no line end to put
          the ellipsis on and the string just runs past the card's edge. The full
          title stays available as a tooltip. */}
      <p
        className="line-clamp-2 text-sm font-semibold wrap-break-word text-text-primary pb-1"
        title={task.title}
      >
        {task.title}
      </p>

      <TaskAssignees assignees={task.assignees} />
    </div>
  );
}
