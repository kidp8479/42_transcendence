// See DefenseReadiness.tsx (components/summary) for an explanation of the
// pattern every component here follows.
//
// Full-width "Add task" button at the bottom of a kanban column. Dashed
// outline so it reads as a slot for something new, not an existing card.
//
// The one element on the board that wears its column's colour outright, at rest
// and not just on hover - outline, fill and text alike.
import { HiPlus } from "react-icons/hi";

interface AddTaskButtonProps {
  onClick: () => void;
  // STATUS_STYLES[status].addTask - outline + fill + text + hover, passed in
  // whole and never rebuilt here: Tailwind only compiles classes it can see
  // written out in full (see lib/categoryColorPalette.ts).
  statusClassName: string;
}

export function AddTaskButton({
  onClick,
  statusClassName,
}: AddTaskButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      // border-dashed stays hard-coded: the prop supplies the colour, the dashes
      // are what mark this as an empty slot rather than another card.
      className={`flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-dashed p-2 text-sm transition-colors ${statusClassName}`}
    >
      <HiPlus aria-hidden="true" />
      Add task
    </button>
  );
}
