// See DefenseReadiness.tsx (components/summary) for an explanation of the
// pattern every component here follows.
//
// Small colored dot signaling a task's priority (same h-2 w-2 rounded-full
// shape as the sidebar's project status dots). The label is optional visually
// but always present for screen readers.
import { PRIORITY_STYLES } from "@/lib/taskPriorityStyles";
import type { TaskPriority } from "@/lib/tasks";

interface TaskPriorityDotProps {
  priority: TaskPriority;
  showLabel?: boolean;
}

export function TaskPriorityDot({
  priority,
  showLabel = false,
}: TaskPriorityDotProps) {
  const priority_style = PRIORITY_STYLES[priority];

  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${priority_style.dot}`}
        aria-hidden="true"
      />
      {showLabel ? (
        <span className={`text-xs ${priority_style.text}`}>
          {priority_style.label}
        </span>
      ) : (
        <span className="sr-only">{`${priority_style.label} priority`}</span>
      )}
    </span>
  );
}
