// Display metadata for each task priority: label + color classes for the
// kanban/list priority dot and the drawer's segmented selector. Uses the
// --color-priority-* tokens in index.css.
//
// Every class below is written out in full (including opacity variants) -
// Tailwind only generates CSS for classes it can see whole in the source,
// see the comment in lib/categoryColorPalette.ts.
import type { TaskPriority } from "@/lib/tasks";

// Selector render order in the drawer (matches the mockup: High first).
export const PRIORITY_ORDER: TaskPriority[] = ["HIGH", "MEDIUM", "LOW"];

interface TaskPriorityStyle {
  label: string;
  // small colored dot (h-2 w-2 rounded-full pattern, see SideBarCmp)
  dot: string;
  // drawer segmented control, selected state
  segmentActive: string;
}

// Shared inactive state for the drawer's segmented control - a single literal
// so all three buttons render identically when unselected.
export const PRIORITY_SEGMENT_INACTIVE =
  "border-surface-border bg-surface-overlay text-text-secondary hover:text-text-primary";

export const PRIORITY_STYLES: Record<TaskPriority, TaskPriorityStyle> = {
  HIGH: {
    label: "High",
    dot: "bg-priority-high",
    segmentActive:
      "border-priority-high/40 bg-priority-high/15 text-priority-high",
  },
  MEDIUM: {
    label: "Medium",
    dot: "bg-priority-medium",
    segmentActive:
      "border-priority-medium/40 bg-priority-medium/15 text-priority-medium",
  },
  LOW: {
    label: "Low",
    dot: "bg-priority-low",
    segmentActive:
      "border-priority-low/40 bg-priority-low/15 text-priority-low",
  },
};
