// See DefenseReadiness.tsx (components/summary) for an explanation of the
// pattern every component here follows.
//
// Small colored dot signaling a task's priority (same h-2 w-2 rounded-full
// shape as the sidebar's project status dots). Colour alone carries no meaning
// for a screen reader, hence the sr-only label next to it.
import { PRIORITY_STYLES } from "@/lib/taskPriorityStyles";
import type { TaskPriority } from "@/lib/tasks";

interface TaskPriorityDotProps {
  priority: TaskPriority;
}

export function TaskPriorityDot({ priority }: TaskPriorityDotProps) {
  const priority_style = PRIORITY_STYLES[priority];

  return (
    // relative: the sr-only label below is position:absolute, and nothing would
    // clip it before ProjectLayout's anchor - see the note on AVATAR_CLASS in
    // components/common/AvatarStack.tsx.
    <span className="relative flex items-center gap-1.5">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${priority_style.dot}`}
        aria-hidden="true"
      />
      <span className="sr-only">{`${priority_style.label} priority`}</span>
    </span>
  );
}
