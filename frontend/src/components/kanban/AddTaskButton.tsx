// See DefenseReadiness.tsx (components/summary) for an explanation of the
// pattern every component here follows.
//
// Full-width "Add task" button at the bottom of a kanban column. Dashed
// outline so it reads as a slot for something new, not an existing card.
import { HiPlus } from "react-icons/hi";

interface AddTaskButtonProps {
  onClick: () => void;
}

export function AddTaskButton({ onClick }: AddTaskButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-surface-border p-2 text-sm text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
    >
      <HiPlus aria-hidden="true" />
      Add task
    </button>
  );
}
