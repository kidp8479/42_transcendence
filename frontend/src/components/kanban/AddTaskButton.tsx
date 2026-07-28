// See DefenseReadiness.tsx (components/summary) for an explanation of the
// pattern every component here follows.
//
// Full-width "Add task" button at the bottom of a kanban column. Dashed
// outline so it reads as a slot for something new, not an existing card.
import { HiPlus } from "react-icons/hi";

interface AddTaskButtonProps {
  onClick: () => void;
  // STATUS_STYLES[status].addTaskHover - the whole class string is passed in
  // and never rebuilt here: Tailwind only compiles classes it can see written
  // out in full (see lib/categoryColorPalette.ts).
  hoverClassName: string;
}

export function AddTaskButton({ onClick, hoverClassName }: AddTaskButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-dashed border-surface-border p-2 text-sm text-text-secondary transition-colors ${hoverClassName}`}
    >
      <HiPlus aria-hidden="true" />
      Add task
    </button>
  );
}
